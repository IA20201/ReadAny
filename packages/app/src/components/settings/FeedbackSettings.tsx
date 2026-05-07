/**
 * FeedbackSettings — Desktop feedback form + history list in Settings dialog.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  collectDeviceInfo,
  collectLogs,
  getFeedbackHistory,
  getRemainingSubmissions,
  markFeedbackReplySeen,
  refreshFeedbackStatus,
  submitFeedback,
} from "@readany/core/feedback";
import type { DeviceInfo, FeedbackRecord, FeedbackType } from "@readany/core/feedback";
import { cn } from "@readany/core/utils";
import {
  AlertCircle,
  Bug,
  Check,
  CheckCircle2,
  ExternalLink,
  Lightbulb,
  Loader2,
  MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const FEEDBACK_TYPES: {
  key: FeedbackType;
  labelKey: string;
  fallback: string;
  Icon: LucideIcon;
}[] = [
  { key: "bug", labelKey: "feedback.typeBug", fallback: "Bug", Icon: Bug },
  { key: "feature", labelKey: "feedback.typeFeature", fallback: "建议", Icon: Lightbulb },
  { key: "other", labelKey: "feedback.typeOther", fallback: "其他", Icon: MessageSquare },
];

type SubmitResult = { kind: "success" | "error"; message: string } | null;

export function FeedbackSettings() {
  const { t } = useTranslation();
  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [includeLogs, setIncludeLogs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult>(null);
  const [records, setRecords] = useState<FeedbackRecord[]>([]);
  const remaining = getRemainingSubmissions();

  const deviceInfo: DeviceInfo = useMemo(
    () =>
      collectDeviceInfo({
        platform: "macos",
        osVersion: navigator.userAgent,
        appVersion: "1.2.1",
        locale: navigator.language,
      }),
    [],
  );

  const loadRecords = useCallback(async (refreshStatus = false) => {
    const history = await getFeedbackHistory();
    setRecords(history);

    if (!refreshStatus || history.length === 0) return;

    await refreshFeedbackStatus(history.map((record) => record.issueNumber));
    setRecords(await getFeedbackHistory());
  }, []);

  useEffect(() => {
    loadRecords(true).catch(() => {});
  }, [loadRecords]);

  const canSubmit = title.trim().length > 0 && description.trim().length > 0 && remaining > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const logs = includeLogs ? collectLogs() : undefined;
      const result = await submitFeedback({
        type,
        title: title.trim(),
        description: description.trim(),
        includeLogs,
        deviceInfo,
        logs,
      });
      setSubmitResult({
        kind: "success",
        message: t("feedback.submitSuccessDesc", "感谢你的反馈！Issue #{{number}} 已创建。", {
          number: result.issueNumber,
        }),
      });
      setTitle("");
      setDescription("");
      setIncludeLogs(false);
      loadRecords().catch(() => {});
    } catch (err) {
      setSubmitResult({
        kind: "error",
        message:
          err instanceof Error
            ? err.message
            : t("feedback.submitFailedUnknown", "提交失败，请稍后重试"),
      });
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, submitting, type, title, description, includeLogs, deviceInfo, loadRecords, t]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-5">
      <div className="mb-5 border-b border-border/70 pb-4">
        <h2 className="mb-1 text-sm font-semibold text-foreground">
          {t("feedback.title", "反馈建议")}
        </h2>
        <p className="text-xs leading-5 text-muted-foreground">
          {t("feedback.desc", "提交 bug 报告或功能建议，我们会尽快处理")}
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <span className="text-xs font-medium text-foreground">{t("feedback.type", "类型")}</span>
          <div className="grid max-w-md grid-cols-3 gap-2">
            {FEEDBACK_TYPES.map((ft) => (
              <Button
                key={ft.key}
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 justify-start gap-2 text-xs",
                  type === ft.key &&
                    "border-primary bg-primary/10 text-primary shadow-sm hover:bg-primary/15 hover:text-primary",
                )}
                onClick={() => setType(ft.key)}
              >
                <ft.Icon className="h-3.5 w-3.5" />
                {t(ft.labelKey, ft.fallback)}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="feedback-title" className="text-xs font-medium text-foreground">
            {t("feedback.titleLabel", "标题")} *
          </label>
          <Input
            id="feedback-title"
            placeholder={t("feedback.titlePlaceholder", "简要描述问题或建议")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="feedback-description" className="text-xs font-medium text-foreground">
            {t("feedback.descLabel", "详细描述")} *
          </label>
          <Textarea
            id="feedback-description"
            placeholder={t("feedback.descPlaceholder", "请详细描述你遇到的问题或建议...")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="resize-none text-sm"
          />
        </div>

        <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <button
              type="button"
              aria-pressed={includeLogs}
              aria-labelledby="include-logs-label"
              onClick={() => setIncludeLogs((checked) => !checked)}
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                includeLogs
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-primary/60",
              )}
            >
              {includeLogs && <Check className="h-3 w-3" />}
            </button>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                id="include-logs-label"
                className="cursor-pointer text-xs font-medium text-foreground"
                onClick={() => setIncludeLogs((checked) => !checked)}
              >
                {t("feedback.uploadLogs", "上传应用日志")}
              </button>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                {t("feedback.logsHint", "仅在勾选时附带最近 1 小时诊断日志，帮助定位问题。")}
              </p>
            </div>
          </div>
          <div className="mt-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            {t("feedback.deviceInfo", "{{platform}} · v{{version}} · {{locale}}", {
              platform: deviceInfo.platform,
              version: deviceInfo.appVersion,
              locale: deviceInfo.locale,
            })}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t("feedback.remaining", "今日还可提交 {{count}} 次", { count: remaining })}
          </span>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting} size="sm">
            {submitting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            {submitting ? t("feedback.submitting", "提交中...") : t("feedback.submit", "提交反馈")}
          </Button>
        </div>

        {submitResult && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-xs",
              submitResult.kind === "success"
                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {submitResult.kind === "success" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5" />
            )}
            <span>{submitResult.message}</span>
          </div>
        )}
      </div>

      {records.length > 0 && (
        <div className="mt-7 space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("feedback.historyTab", "我的反馈")}
          </h3>
          <div className="max-h-48 divide-y overflow-y-auto rounded-md border border-border/70">
            {records.map((record) => (
              <div key={record.id} className="flex items-center justify-between px-3 py-2.5">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-xs font-medium text-foreground truncate">{record.title}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <p className="text-[10px] text-muted-foreground">
                      #{record.issueNumber} · {new Date(record.createdAt).toLocaleDateString()}
                    </p>
                    {record.hasNewReply && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                        {t("feedback.newReply", "有新回复")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      record.status === "open"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {record.status === "open"
                      ? t("feedback.statusOpen", "处理中")
                      : t("feedback.statusClosed", "已关闭")}
                  </span>
                  <a
                    href={record.issueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    title={t("feedback.openIssue", "打开 Issue")}
                    onClick={() => {
                      markFeedbackReplySeen(record.issueNumber)
                        .then(() => loadRecords())
                        .catch(() => {});
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
