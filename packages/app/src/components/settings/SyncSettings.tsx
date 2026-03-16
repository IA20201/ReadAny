/**
 * SyncSettings — WebDAV sync configuration and status panel.
 * Uses the shared core sync store with whole-database overwrite sync.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSyncStore } from "@/stores/sync-store";
import { Switch } from "@/components/ui/switch";
import { PasswordInput } from "@/components/ui/password-input";
import { getPlatformService } from "@readany/core/services";

export function SyncSettings() {
  const { t } = useTranslation();
  const {
    config,
    isConfigured,
    status,
    lastSyncAt,
    lastResult,
    error,
    progress,
    pendingDirection,
    loadConfig,
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

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Load saved password from KV when config changes
  useEffect(() => {
    if (config) {
      setUrl(config.url);
      setUsername(config.username);
      // Load password from secure KV
      getPlatformService()
        .kvGetItem("sync_password")
        .then((pw) => {
          if (pw) setPassword(pw);
        });
    }
  }, [config]);

  const isBusy = status !== "idle" && status !== "error";

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

  const handleConflict = useCallback(
    async (direction: "upload" | "download") => {
      await syncNow(direction);
    },
    [syncNow],
  );

  const handleReset = useCallback(async () => {
    if (window.confirm(t("settings.syncResetConfirm"))) {
      await resetSync();
    }
  }, [resetSync, t]);

  const formatLastSync = (ts: number | null) => {
    if (!ts) return t("settings.syncNever");
    return new Date(ts).toLocaleString();
  };

  const statusLabel = () => {
    switch (status) {
      case "checking":
        return t("settings.syncChecking");
      case "uploading":
        return t("settings.syncUploading");
      case "downloading":
        return t("settings.syncDownloading");
      case "syncing-files":
        return t("settings.syncSyncingFiles");
      case "error":
        return t("settings.syncError");
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 p-4 pt-3">
      {/* Connection Section */}
      <section className="rounded-lg bg-muted/60 p-4">
        <h2 className="mb-4 text-sm font-medium text-foreground">
          {t("settings.syncConnection")}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-foreground">
              {t("settings.syncUrl")}
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("settings.syncUrlPlaceholder")}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-foreground">
                {t("settings.syncUsername")}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-foreground">
                {t("settings.syncPassword")}
              </label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleTest}
              disabled={testing || !url}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {testing ? t("settings.syncTesting") : t("settings.syncTestConnection")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !url || !username}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {t("settings.syncSave")}
            </button>
            {testResult === "success" && (
              <span className="text-xs text-green-600">{t("settings.syncTestSuccess")}</span>
            )}
            {testResult === "error" && (
              <span className="text-xs text-red-500">
                {t("settings.syncTestFailed", { error: testError })}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Conflict Resolution Dialog */}
      {pendingDirection === "conflict" && (
        <section className="rounded-lg border-2 border-orange-400/60 bg-orange-50/40 p-4 dark:bg-orange-950/20">
          <h2 className="mb-2 text-sm font-medium text-foreground">
            {t("settings.syncConflictTitle")}
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            {t("settings.syncConflictDesc")}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleConflict("upload")}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("settings.syncConflictUpload")}
            </button>
            <button
              onClick={() => handleConflict("download")}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
            >
              {t("settings.syncConflictDownload")}
            </button>
          </div>
        </section>
      )}

      {/* Sync Status Section */}
      {isConfigured && (
        <section className="rounded-lg bg-muted/60 p-4">
          <h2 className="mb-4 text-sm font-medium text-foreground">
            {t("settings.syncStatus")}
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-foreground">{t("settings.syncLastSync")}</span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatLastSync(lastSyncAt)}
                </p>
                {statusLabel() && (
                  <p className="mt-0.5 text-xs text-primary">{statusLabel()}</p>
                )}
              </div>
              <button
                onClick={handleSync}
                disabled={isBusy}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isBusy ? t("settings.syncSyncing") : t("settings.syncNow")}
              </button>
            </div>

            {/* Last sync result */}
            {lastResult && (
              <div className="rounded-md bg-background/60 p-3 text-xs text-muted-foreground">
                {lastResult.success ? (
                  <div className="space-y-0.5">
                    <p>{t("settings.syncDirection", { direction: lastResult.direction })}</p>
                    {lastResult.filesUploaded > 0 && (
                      <p>{t("settings.syncFilesUp", { count: lastResult.filesUploaded })}</p>
                    )}
                    {lastResult.filesDownloaded > 0 && (
                      <p>{t("settings.syncFilesDown", { count: lastResult.filesDownloaded })}</p>
                    )}
                    <p className="text-muted-foreground/60">
                      {t("settings.syncDuration", { ms: lastResult.durationMs })}
                    </p>
                  </div>
                ) : (
                  <p className="text-red-500">
                    {t("settings.syncFailed", { error: lastResult.error })}
                  </p>
                )}
              </div>
            )}

            {/* Error display */}
            {error && !lastResult && (
              <div className="rounded-md bg-red-50/60 p-3 text-xs text-red-500 dark:bg-red-950/20">
                {error}
              </div>
            )}

            {/* Auto sync toggle */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-sm text-foreground">{t("settings.syncAutoSync")}</span>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("settings.syncAutoSyncDesc")}</p>
              </div>
              <Switch
                checked={config?.autoSync ?? false}
                onCheckedChange={(checked) => setAutoSync(checked)}
              />
            </div>
          </div>
        </section>
      )}

      {/* Advanced Section */}
      {isConfigured && (
        <section className="rounded-lg bg-muted/60 p-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="mb-2 text-sm font-medium text-foreground"
          >
            {t("settings.syncAdvanced")} {showAdvanced ? "−" : "+"}
          </button>

          {showAdvanced && (
            <div className="space-y-3">
              <div className="pt-2">
                <button
                  onClick={handleReset}
                  className="rounded-md border border-destructive/30 px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
                >
                  {t("settings.syncReset")}
                </button>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("settings.syncResetDesc")}
                </p>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
