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
const LOG_RETENTION_MS = 24 * 60 * 60 * 1000;
const LOG_SUBMISSION_WINDOW_MS = 60 * 60 * 1000;

interface LogEntry {
  createdAt: number;
  text: string;
}

const _logBuffer: LogEntry[] = [];
const CONSOLE_LEVELS = ["debug", "info", "log", "warn", "error"] as const;

let _logCaptureCleanup: (() => void) | null = null;

function getEventTarget(): Pick<Window, "addEventListener" | "removeEventListener"> | null {
  if (typeof window === "undefined") return null;
  if (typeof window.addEventListener !== "function") return null;
  if (typeof window.removeEventListener !== "function") return null;
  return window;
}

function formatLogArg(arg: unknown): string {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ""}`;
  }
  if (typeof arg === "string") return arg;
  if (typeof arg === "number" || typeof arg === "boolean" || arg == null) return String(arg);

  try {
    return JSON.stringify(arg);
  } catch {
    return Object.prototype.toString.call(arg);
  }
}

function formatErrorEvent(event: ErrorEvent): string {
  if (event.error instanceof Error) {
    return formatLogArg(event.error);
  }
  return `${event.message || "Unhandled error"}${event.filename ? ` at ${event.filename}` : ""}${
    event.lineno ? `:${event.lineno}` : ""
  }`;
}

function pruneLogs(now = Date.now()): void {
  const oldestAllowedAt = now - LOG_RETENTION_MS;
  while (_logBuffer.length > 0 && _logBuffer[0].createdAt < oldestAllowedAt) {
    _logBuffer.shift();
  }
  while (_logBuffer.length > LOG_BUFFER_SIZE) {
    _logBuffer.shift();
  }
}

/** Call this to capture log entries into the ring buffer */
export function appendLog(entry: string): void {
  const now = Date.now();
  pruneLogs(now);
  if (_logBuffer.length >= LOG_BUFFER_SIZE) {
    _logBuffer.shift();
  }
  _logBuffer.push({
    createdAt: now,
    text: `[${new Date(now).toISOString()}] ${entry}`,
  });
}

/** Capture a structured app event into the feedback log buffer. */
export function appendStructuredLog(
  event: string,
  data?: Record<string, unknown>,
  level: "info" | "warn" | "error" = "info",
): void {
  const payload = data ? ` ${formatLogArg(data)}` : "";
  appendLog(`[${level}] [event:${event}]${payload}`);
}

/** Get recent logs as a single string. Defaults to the last hour. */
export function collectLogs(options?: { sinceMs?: number }): string {
  const now = Date.now();
  pruneLogs(now);
  const sinceMs = options?.sinceMs ?? LOG_SUBMISSION_WINDOW_MS;
  const since = now - sinceMs;
  return _logBuffer
    .filter((entry) => entry.createdAt >= since)
    .map((entry) => entry.text)
    .join("\n");
}

/** Clear the log buffer */
export function clearLogs(): void {
  _logBuffer.length = 0;
}

/** Install console/error capture into the feedback log buffer. Safe to call more than once. */
export function installFeedbackLogCapture(): () => void {
  if (_logCaptureCleanup) return _logCaptureCleanup;

  const originalConsole = new Map<(typeof CONSOLE_LEVELS)[number], (...args: unknown[]) => void>();

  for (const level of CONSOLE_LEVELS) {
    const original = console[level]?.bind(console);
    if (!original) continue;

    originalConsole.set(level, original);
    console[level] = ((...args: unknown[]) => {
      original(...args);
      appendLog(`[${level}] ${args.map(formatLogArg).join(" ")}`);
    }) as (typeof console)[typeof level];
  }

  const onError = (event: ErrorEvent) => {
    appendLog(`[error] ${formatErrorEvent(event)}`);
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    appendLog(`[unhandledrejection] ${formatLogArg(event.reason)}`);
  };

  const eventTarget = getEventTarget();
  if (eventTarget) {
    eventTarget.addEventListener("error", onError);
    eventTarget.addEventListener("unhandledrejection", onUnhandledRejection);
  }

  _logCaptureCleanup = () => {
    for (const [level, original] of originalConsole.entries()) {
      console[level] = original as (typeof console)[typeof level];
    }
    if (eventTarget) {
      eventTarget.removeEventListener("error", onError);
      eventTarget.removeEventListener("unhandledrejection", onUnhandledRejection);
    }
    _logCaptureCleanup = null;
  };

  return _logCaptureCleanup;
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
    appendStructuredLog("feedback.submit.start", {
      type: submission.type,
      includeLogs: submission.includeLogs,
      platform: submission.deviceInfo.platform,
    });

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

    try {
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
    } catch (error) {
      appendStructuredLog("feedback.submit.failed", { error: formatLogArg(error) }, "error");
      throw error;
    }

    appendStructuredLog("feedback.submit.success", { issueNumber: result.issueNumber });
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

  try {
    await saveFeedbackRecord(record);
  } catch (error) {
    appendStructuredLog("feedback.local_save.failed", { error: formatLogArg(error) }, "error");
    throw error;
  }
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
    has_new_reply?: number | null;
    comment_count?: number | null;
  }>(
    `SELECT id, issue_number, issue_url, title, type, status, created_at, updated_at, has_new_reply, comment_count
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
    hasNewReply: Boolean(row.has_new_reply),
  }));
}

export async function markFeedbackReplySeen(issueNumber: number): Promise<void> {
  const db = await getDB();
  await db.execute("UPDATE feedback SET has_new_reply = 0, updated_at = ? WHERE issue_number = ?", [
    Date.now(),
    issueNumber,
  ]);
}

// ─── Status Refresh ────────────────────────────────────────────────────────

export async function refreshFeedbackStatus(issueNumbers: number[]): Promise<FeedbackStatusItem[]> {
  if (!_workerBaseUrl || issueNumbers.length === 0) return [];

  const params = issueNumbers.join(",");
  let response: Response;
  try {
    response = await fetch(`${_workerBaseUrl}/api/feedback/status?issues=${params}`);
  } catch (error) {
    appendStructuredLog("feedback.status_refresh.failed", { error: formatLogArg(error) }, "warn");
    return [];
  }

  if (!response.ok) {
    appendStructuredLog("feedback.status_refresh.failed", { status: response.status }, "warn");
    return [];
  }

  const items = (await response.json()) as FeedbackStatusItem[];
  appendStructuredLog("feedback.status_refresh.success", { count: items.length });

  // Update local DB
  const db = await getDB();
  for (const item of items) {
    const existingRows = await db.select<{
      comment_count?: number | null;
      has_new_reply?: number | null;
    }>("SELECT comment_count, has_new_reply FROM feedback WHERE issue_number = ?", [item.number]);
    const existing = existingRows[0];
    const previousCommentCount = existing?.comment_count ?? 0;
    const commentCount = item.commentCount ?? (item.hasNewComment ? 1 : 0);
    const hasNewReply = Boolean(existing?.has_new_reply) || commentCount > previousCommentCount;

    await db.execute(
      "UPDATE feedback SET status = ?, has_new_reply = ?, comment_count = ?, updated_at = ? WHERE issue_number = ?",
      [item.state, hasNewReply ? 1 : 0, commentCount, Date.now(), item.number],
    );
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
