/**
 * Feedback service — handles submission, local storage, and status tracking.
 *
 * API calls go through a Cloudflare Worker that creates GitHub Issues
 * via a GitHub App installation token. The Worker URL is configurable.
 */

import { getDB } from "../db/db-core";
import type {
  DeviceInfo,
  FeedbackRecord,
  FeedbackStatusItem,
  FeedbackSubmission,
  FeedbackSubmitResult,
} from "./feedback-types";

// Worker API base URL — will be configured when Worker is deployed
let _workerBaseUrl = "";

export function setFeedbackWorkerUrl(url: string): void {
  _workerBaseUrl = url.replace(/\/+$/, "");
}

/** Max submissions per device per day */
const MAX_DAILY_SUBMISSIONS = 3;

// ─── Log Collection ────────────────────────────────────────────────────────

const LOG_BUFFER_SIZE = 500;
const _logBuffer: string[] = [];

/** Call this to capture log entries into the ring buffer */
export function appendLog(entry: string): void {
  if (_logBuffer.length >= LOG_BUFFER_SIZE) {
    _logBuffer.shift();
  }
  _logBuffer.push(`[${new Date().toISOString()}] ${entry}`);
}

/** Get collected logs as a single string */
export function collectLogs(): string {
  return _logBuffer.join("\n");
}

/** Clear the log buffer */
export function clearLogs(): void {
  _logBuffer.length = 0;
}

// ─── Rate Limiting (local) ─────────────────────────────────────────────────

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10); // "2026-05-07"
}

let _dailyCount = 0;
let _dailyKey = "";

function loadDailyCount(): number {
  const today = getTodayKey();
  if (_dailyKey !== today) {
    _dailyKey = today;
    _dailyCount = 0;
  }
  return _dailyCount;
}

export function getRemainingSubmissions(): number {
  return Math.max(0, MAX_DAILY_SUBMISSIONS - loadDailyCount());
}

function incrementDailyCount(): void {
  loadDailyCount();
  _dailyCount++;
}

// ─── Submit Feedback ───────────────────────────────────────────────────────

export async function submitFeedback(
  submission: FeedbackSubmission,
): Promise<FeedbackSubmitResult> {
  if (getRemainingSubmissions() <= 0) {
    throw new Error("今日反馈次数已用完，请明天再试");
  }

  let result: FeedbackSubmitResult;

  if (_workerBaseUrl) {
    // Real API call
    const body: Record<string, unknown> = {
      type: submission.type,
      title: submission.title,
      description: submission.description,
      deviceInfo: submission.deviceInfo,
    };
    if (submission.includeLogs && submission.logs) {
      body.logs = submission.logs;
    }

    const response = await fetch(`${_workerBaseUrl}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`提交失败: ${response.status} ${text}`);
    }

    result = (await response.json()) as FeedbackSubmitResult;
  } else {
    // Mock mode — for development before Worker is deployed
    const mockNumber = Math.floor(Math.random() * 9000) + 1000;
    result = {
      issueNumber: mockNumber,
      issueUrl: `https://github.com/codedogQBY/ReadAny/issues/${mockNumber}`,
    };
  }

  // Save to local DB
  const id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record: FeedbackRecord = {
    id,
    issueNumber: result.issueNumber,
    issueUrl: result.issueUrl,
    title: submission.title,
    type: submission.type,
    status: "open",
    createdAt: Date.now(),
  };

  await saveFeedbackRecord(record);
  incrementDailyCount();

  return result;
}

// ─── Local Storage ─────────────────────────────────────────────────────────

async function saveFeedbackRecord(record: FeedbackRecord): Promise<void> {
  const db = await getDB();
  await db.execute(
    `INSERT OR REPLACE INTO feedback (id, issue_number, issue_url, title, type, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.issueNumber,
      record.issueUrl,
      record.title,
      record.type,
      record.status,
      record.createdAt,
      record.updatedAt ?? null,
    ],
  );
}

export async function getFeedbackHistory(): Promise<FeedbackRecord[]> {
  const db = await getDB();
  const rows = await db.select<{
    id: string;
    issue_number: number;
    issue_url: string;
    title: string;
    type: string;
    status: string;
    created_at: number;
    updated_at: number | null;
  }>(
    `SELECT id, issue_number, issue_url, title, type, status, created_at, updated_at
     FROM feedback ORDER BY created_at DESC`,
  );
  return rows.map((row) => ({
    id: row.id,
    issueNumber: row.issue_number,
    issueUrl: row.issue_url,
    title: row.title,
    type: row.type as FeedbackRecord["type"],
    status: row.status as FeedbackRecord["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  }));
}

// ─── Status Refresh ────────────────────────────────────────────────────────

export async function refreshFeedbackStatus(issueNumbers: number[]): Promise<FeedbackStatusItem[]> {
  if (!_workerBaseUrl || issueNumbers.length === 0) return [];

  const params = issueNumbers.join(",");
  const response = await fetch(`${_workerBaseUrl}/api/feedback/status?issues=${params}`);

  if (!response.ok) return [];

  const items = (await response.json()) as FeedbackStatusItem[];

  // Update local DB
  const db = await getDB();
  for (const item of items) {
    await db.execute("UPDATE feedback SET status = ?, updated_at = ? WHERE issue_number = ?", [
      item.state,
      Date.now(),
      item.number,
    ]);
  }

  return items;
}

// ─── Device Info Collection ────────────────────────────────────────────────

export function collectDeviceInfo(overrides?: Partial<DeviceInfo>): DeviceInfo {
  // Base info — platform-specific code will override these
  return {
    platform: "macos",
    osVersion: "unknown",
    appVersion: "unknown",
    locale: "unknown",
    ...overrides,
  };
}
