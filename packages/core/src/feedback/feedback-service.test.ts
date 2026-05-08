import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appendLog, appendStructuredLog, clearLogs, collectLogs } from "./feedback-service";

describe("feedback log buffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T00:00:00.000Z"));
    clearLogs();
  });

  afterEach(() => {
    clearLogs();
    vi.useRealTimers();
  });

  it("collects the last hour by default", () => {
    appendLog("old log");

    vi.setSystemTime(new Date("2026-05-08T01:00:01.000Z"));
    appendLog("recent log");

    const logs = collectLogs();

    expect(logs).toContain("recent log");
    expect(logs).not.toContain("old log");
  });

  it("prunes logs older than one day", () => {
    appendLog("expired log");

    vi.setSystemTime(new Date("2026-05-09T00:00:01.000Z"));
    appendLog("fresh log");

    const logs = collectLogs({ sinceMs: 25 * 60 * 60 * 1000 });

    expect(logs).toContain("fresh log");
    expect(logs).not.toContain("expired log");
  });

  it("stores structured app events", () => {
    appendStructuredLog("feedback.submit.start", { type: "bug" });

    const logs = collectLogs();

    expect(logs).toContain("[event:feedback.submit.start]");
    expect(logs).toContain('"type":"bug"');
  });
});
