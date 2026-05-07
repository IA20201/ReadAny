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
  submitFeedback,
} from "@readany/core/feedback";
import type { DeviceInfo, FeedbackRecord, FeedbackType } from "@readany/core/feedback";
import { ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const FEEDBACK_TYPES: { key: FeedbackType; emoji: string; label: string }[] = [
  { key: "bug", emoji: "🐛", label: "Bug" },
  { key: "feature", emoji: "💡", label: "建议" },
  { key: "other", emoji: "📝", label: "其他" },
];

export function FeedbackSettings() {
  const { t } = useTranslation();
  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [includeLogs, setIncludeLogs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);
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

  useEffect(() => {
    getFeedbackHistory().then(setRecords).catch(() => {});
  }, [submitResult]);

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
        contact: contact.trim() || undefined,
        includeLogs,
        deviceInfo,
        logs,
      });
      setSubmitResult(`✅ 提交成功！Issue #${result.issueNumber} 已创建`);
      setTitle("");
      setDescription("");
      setContact("");
      setIncludeLogs(false);
    } catch (err) {
      setSubmitResult(`❌ ${err instanceof Error ? err.message : "提交失败"}`);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, submitting, type, title, description, contact, includeLogs, deviceInfo]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-sm font-medium text-foreground mb-1">{t("feedback.title", "反馈建议")}</h2>
        <p className="text-xs text-muted-foreground">{t("feedback.desc", "提交 bug 报告或功能建议，我们会尽快处理")}</p>
      </div>

      {/* Submit form */}
      <div className="space-y-4 rounded-lg border p-4">
        {/* Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium">{t("feedback.type", "类型")}</label>
          <div className="flex gap-2">
            {FEEDBACK_TYPES.map((ft) => (
              <Button
                key={ft.key}
                variant={type === ft.key ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => setType(ft.key)}
              >
                {ft.emoji} {ft.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium">{t("feedback.titleLabel", "标题")} *</label>
          <Input
            placeholder={t("feedback.titlePlaceholder", "简要描述问题或建议")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="h-8 text-sm"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium">{t("feedback.descLabel", "详细描述")} *</label>
          <Textarea
            placeholder={t("feedback.descPlaceholder", "请详细描述你遇到的问题或建议...")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="text-sm resize-none"
          />
        </div>

        {/* Contact */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium">{t("feedback.contactLabel", "联系方式（选填）")}</label>
          <Input
            placeholder={t("feedback.contactPlaceholder", "邮箱或微信，方便我们联系你")}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {/* Logs */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="include-logs"
            checked={includeLogs}
            onChange={(e) => setIncludeLogs(e.target.checked)}
            className="rounded border-border"
          />
          <label htmlFor="include-logs" className="text-xs cursor-pointer">
            {t("feedback.uploadLogs", "上传应用日志")}
          </label>
          <span className="text-[10px] text-muted-foreground">
            {t("feedback.logsHint", "日志有助于定位问题，不含隐私信息")}
          </span>
        </div>

        {/* Device info */}
        <div className="rounded bg-muted/50 px-3 py-2">
          <p className="text-[10px] text-muted-foreground">
            {deviceInfo.platform} · v{deviceInfo.appVersion} · {deviceInfo.locale}
          </p>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {t("feedback.remaining", "今日还可提交 {{count}} 次", { count: remaining })}
          </span>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting} size="sm">
            {submitting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            {t("feedback.submit", "提交反馈")}
          </Button>
        </div>

        {submitResult && (
          <p className={`text-xs ${submitResult.startsWith("✅") ? "text-green-600" : "text-destructive"}`}>
            {submitResult}
          </p>
        )}
      </div>

      {/* History */}
      {records.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">{t("feedback.historyTab", "我的反馈")}</h3>
          <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
            {records.map((record) => (
              <div key={record.id} className="flex items-center justify-between px-3 py-2.5">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-xs font-medium text-foreground truncate">{record.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    #{record.issueNumber} · {new Date(record.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      record.status === "open"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {record.status === "open" ? "处理中" : "已关闭"}
                  </span>
                  <a
                    href={record.issueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
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
