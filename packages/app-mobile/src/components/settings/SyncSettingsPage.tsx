/**
 * SyncSettingsPage — Mobile WebDAV sync configuration and status page.
 * Follows the standard mobile settings sub-page pattern.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useSyncStore } from "@/stores/sync-store";
import { useKeyboardAwareScroll } from "@/lib/use-keyboard-aware-scroll";

export function SyncSettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    config,
    status,
    isSyncing,
    loadConfig,
    loadStatus,
    testConnection,
    saveConfig,
    syncNow,
    setAutoSync,
    resetSync,
  } = useSyncStore();

  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [testError, setTestError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useKeyboardAwareScroll(scrollRef);

  useEffect(() => {
    loadConfig();
    loadStatus();
  }, [loadConfig, loadStatus]);

  useEffect(() => {
    if (config) {
      setUrl(config.url);
      setUsername(config.username);
      setPassword(config.password);
    }
  }, [config]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await testConnection(url, username, password);
      setTestResult("success");
    } catch (e) {
      setTestResult("error");
      setTestError(String(e));
    } finally {
      setTesting(false);
    }
  }, [url, username, password, testConnection]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveConfig(url, username, password);
    } finally {
      setSaving(false);
    }
  }, [url, username, password, saveConfig]);

  const handleSync = useCallback(async () => {
    await syncNow();
  }, [syncNow]);

  const handleReset = useCallback(async () => {
    if (window.confirm(t("settings.syncResetConfirm"))) {
      await resetSync();
    }
  }, [resetSync, t]);

  const formatLastSync = (ts: number | null) => {
    if (!ts) return t("settings.syncNever");
    return new Date(ts).toLocaleString();
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header
        className="shrink-0 flex items-center gap-3 px-4 pb-3 border-b border-border bg-background"
        style={{ paddingTop: "calc(var(--safe-area-top) + 12px)" }}
      >
        <button type="button" className="p-1 -ml-1" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">{t("settings.syncTitle")}</h1>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Connection Section */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {t("settings.syncConnection")}
          </h2>
          <div className="space-y-3 rounded-xl bg-card border border-border p-4">
            {/* URL */}
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                {t("settings.syncUrl")}
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t("settings.syncUrlPlaceholder")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            {/* Username */}
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                {t("settings.syncUsername")}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("settings.syncUsername")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                {t("settings.syncPassword")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("settings.syncPassword")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !url}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors active:bg-muted disabled:opacity-40"
              >
                {testing ? t("settings.syncTesting") : t("settings.syncTestConnection")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !url || !username}
                className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors active:opacity-80 disabled:opacity-40"
              >
                {t("settings.syncSave")}
              </button>
            </div>

            {/* Test result */}
            {testResult === "success" && (
              <p className="text-sm text-green-600">{t("settings.syncTestSuccess")}</p>
            )}
            {testResult === "error" && (
              <p className="text-sm text-red-500">
                {t("settings.syncTestFailed", { error: testError })}
              </p>
            )}
          </div>
        </section>

        {/* Sync Status Section */}
        {status.is_configured && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t("settings.syncStatus")}
            </h2>
            <div className="space-y-3 rounded-xl bg-card border border-border p-4">
              {/* Last sync + Sync Now */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("settings.syncLastSync")}</p>
                  <p className="text-sm font-medium">{formatLastSync(status.last_sync_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors active:opacity-80 disabled:opacity-40"
                >
                  {isSyncing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isSyncing ? t("settings.syncSyncing") : t("settings.syncNow")}
                </button>
              </div>

              {/* Last result details */}
              {status.last_result && (
                <div className="border-t border-border pt-3">
                  {status.last_result.success ? (
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>{t("settings.syncRecordsUp", { count: status.last_result.records_uploaded })}</p>
                      <p>{t("settings.syncRecordsDown", { count: status.last_result.records_downloaded })}</p>
                      {status.last_result.files_uploaded > 0 && (
                        <p>{t("settings.syncFilesUp", { count: status.last_result.files_uploaded })}</p>
                      )}
                      {status.last_result.files_downloaded > 0 && (
                        <p>{t("settings.syncFilesDown", { count: status.last_result.files_downloaded })}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-red-500">
                      {t("settings.syncFailed", { error: status.last_result.error })}
                    </p>
                  )}
                </div>
              )}

              {/* Auto sync toggle */}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <div>
                  <p className="text-sm font-medium">{t("settings.syncAutoSync")}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.syncAutoSyncDesc")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoSync(!config?.auto_sync)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${config?.auto_sync ? "bg-primary" : "bg-muted"
                    }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${config?.auto_sync ? "translate-x-5" : ""
                      }`}
                  />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Advanced Section */}
        {status.is_configured && (
          <section>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between py-2"
            >
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t("settings.syncAdvanced")}
              </h2>
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {showAdvanced && (
              <div className="space-y-3 rounded-xl bg-card border border-border p-4">
                {/* Device ID */}
                {status.device_id && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t("settings.syncDeviceId")}</p>
                    <p className="font-mono text-sm">{status.device_id.slice(0, 8)}...</p>
                  </div>
                )}

                {/* Reset */}
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors active:bg-red-50"
                >
                  {t("settings.syncReset")}
                </button>
                <p className="text-xs text-muted-foreground">{t("settings.syncResetDesc")}</p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
