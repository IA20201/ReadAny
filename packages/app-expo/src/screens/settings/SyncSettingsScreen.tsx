/**
 * SyncSettingsScreen — WebDAV sync configuration and status panel (mobile).
 * Uses the shared core sync store with whole-database overwrite sync.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSyncStore } from "@readany/core/stores";
import { getPlatformService } from "@readany/core/services";
import { PasswordInput } from "../../components/ui/PasswordInput";
import {
  type ThemeColors,
  fontSize,
  fontWeight,
  radius,
  spacing,
  useColors,
  withOpacity,
} from "../../styles/theme";
import { SettingsHeader } from "./SettingsHeader";

export default function SyncSettingsScreen() {
  const colors = useColors();
  const styles = makeStyles(colors);
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

  const isBusy = status !== "idle" && status !== "error";

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Load saved password from KV when config changes
  useEffect(() => {
    if (config) {
      setUrl(config.url);
      setUsername(config.username);
      getPlatformService()
        .kvGetItem("sync_password")
        .then((pw) => {
          if (pw) setPassword(pw);
        });
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

  const handleConflict = useCallback(
    (direction: "upload" | "download") => {
      syncNow(direction);
    },
    [syncNow],
  );

  const handleReset = useCallback(() => {
    Alert.alert(
      t("settings.syncReset"),
      t("settings.syncResetConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.confirm"),
          style: "destructive",
          onPress: () => resetSync(),
        },
      ],
    );
  }, [t, resetSync]);

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
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <SettingsHeader title={t("settings.syncTitle")} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Connection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("settings.syncConnection")}</Text>
            <View style={styles.card}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t("settings.syncUrl")}</Text>
                <TextInput
                  style={styles.input}
                  value={url}
                  onChangeText={setUrl}
                  placeholder={t("settings.syncUrlPlaceholder")}
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t("settings.syncUsername")}</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder={t("settings.syncUsername")}
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t("settings.syncPassword")}</Text>
                <PasswordInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t("settings.syncPassword")}
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.outlineBtn, (!url || testing) && styles.btnDisabled]}
                  onPress={handleTest}
                  disabled={testing || !url}
                  activeOpacity={0.7}
                >
                  <Text style={styles.outlineBtnText}>
                    {testing ? t("settings.syncTesting") : t("settings.syncTestConnection")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, (saving || !url || !username) && styles.btnDisabled]}
                  onPress={handleSave}
                  disabled={saving || !url || !username}
                  activeOpacity={0.7}
                >
                  <Text style={styles.primaryBtnText}>{t("settings.syncSave")}</Text>
                </TouchableOpacity>
              </View>

              {testResult === "success" && (
                <Text style={styles.successText}>{t("settings.syncTestSuccess")}</Text>
              )}
              {testResult === "error" && (
                <Text style={styles.errorText}>
                  {t("settings.syncTestFailed", { error: testError })}
                </Text>
              )}
            </View>
          </View>

          {/* Conflict Resolution */}
          {pendingDirection === "conflict" && (
            <View style={styles.section}>
              <View style={styles.conflictCard}>
                <Text style={styles.conflictTitle}>{t("settings.syncConflictTitle")}</Text>
                <Text style={styles.conflictDesc}>{t("settings.syncConflictDesc")}</Text>
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={styles.uploadBtn}
                    onPress={() => handleConflict("upload")}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.uploadBtnText}>{t("settings.syncConflictUpload")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.downloadBtn}
                    onPress={() => handleConflict("download")}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.downloadBtnText}>{t("settings.syncConflictDownload")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Sync Status */}
          {isConfigured && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("settings.syncStatus")}</Text>
              <View style={styles.card}>
                <View style={styles.syncRow}>
                  <View>
                    <Text style={styles.syncLabel}>{t("settings.syncLastSync")}</Text>
                    <Text style={styles.syncValue}>{formatLastSync(lastSyncAt)}</Text>
                    {statusLabel() && (
                      <Text style={styles.statusText}>{statusLabel()}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.syncBtn, isBusy && styles.btnDisabled]}
                    onPress={handleSync}
                    disabled={isBusy}
                    activeOpacity={0.7}
                  >
                    {isBusy && (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    )}
                    <Text style={styles.syncBtnText}>
                      {isBusy ? t("settings.syncSyncing") : t("settings.syncNow")}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Last result */}
                {lastResult && (
                  <View style={styles.resultCard}>
                    {lastResult.success ? (
                      <>
                        <Text style={styles.resultText}>
                          {t("settings.syncDirection", { direction: lastResult.direction })}
                        </Text>
                        {lastResult.filesUploaded > 0 && (
                          <Text style={styles.resultText}>
                            {t("settings.syncFilesUp", { count: lastResult.filesUploaded })}
                          </Text>
                        )}
                        {lastResult.filesDownloaded > 0 && (
                          <Text style={styles.resultText}>
                            {t("settings.syncFilesDown", { count: lastResult.filesDownloaded })}
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.errorText}>
                        {t("settings.syncFailed", { error: lastResult.error })}
                      </Text>
                    )}
                  </View>
                )}

                {/* Error */}
                {error && !lastResult && (
                  <Text style={styles.errorText}>{error}</Text>
                )}

                {/* Auto sync toggle */}
                <View style={styles.autoSyncRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.autoSyncLabel}>{t("settings.syncAutoSync")}</Text>
                    <Text style={styles.autoSyncDesc}>{t("settings.syncAutoSyncDesc")}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggle, config?.autoSync && styles.toggleActive]}
                    onPress={() => setAutoSync(!config?.autoSync)}
                  >
                    <View
                      style={[styles.toggleThumb, config?.autoSync && styles.toggleThumbActive]}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Advanced */}
          {isConfigured && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.advancedHeader}
                onPress={() => setShowAdvanced(!showAdvanced)}
              >
                <Text style={styles.sectionTitle}>{t("settings.syncAdvanced")}</Text>
                <Text style={styles.chevron}>{showAdvanced ? "▲" : "▼"}</Text>
              </TouchableOpacity>
              {showAdvanced && (
                <View style={styles.card}>
                  <TouchableOpacity
                    style={styles.resetBtn}
                    onPress={handleReset}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.resetBtnText}>{t("settings.syncReset")}</Text>
                  </TouchableOpacity>
                  <Text style={styles.resetDesc}>{t("settings.syncResetDesc")}</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    keyboardView: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.lg, gap: 24 },
    section: { gap: 12 },
    sectionTitle: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    card: {
      borderRadius: radius.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: 12,
    },
    conflictCard: {
      borderRadius: radius.xl,
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: withOpacity("#f59e0b", 0.5),
      padding: spacing.lg,
      gap: 12,
    },
    conflictTitle: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.foreground,
    },
    conflictDesc: {
      fontSize: fontSize.xs,
      color: colors.mutedForeground,
    },
    uploadBtn: {
      flex: 1,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      paddingVertical: 8,
      alignItems: "center",
    },
    uploadBtnText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.primaryForeground,
    },
    downloadBtn: {
      flex: 1,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingVertical: 8,
      alignItems: "center",
    },
    downloadBtnText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.foreground,
    },
    fieldGroup: { gap: 4 },
    fieldLabel: { fontSize: fontSize.sm, color: colors.mutedForeground },
    input: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: fontSize.sm,
      color: colors.foreground,
    },
    btnRow: { flexDirection: "row", gap: 12, paddingTop: 4 },
    outlineBtn: {
      flex: 1,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 8,
      alignItems: "center",
    },
    outlineBtnText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.foreground,
    },
    primaryBtn: {
      flex: 1,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      paddingVertical: 8,
      alignItems: "center",
    },
    primaryBtnText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.primaryForeground,
    },
    btnDisabled: { opacity: 0.4 },
    successText: { fontSize: fontSize.sm, color: colors.emerald },
    errorText: { fontSize: fontSize.sm, color: colors.destructive },
    syncRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    syncLabel: { fontSize: fontSize.sm, color: colors.mutedForeground },
    syncValue: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.foreground,
      marginTop: 2,
    },
    statusText: {
      fontSize: fontSize.xs,
      color: colors.primary,
      marginTop: 2,
    },
    syncBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    syncBtnText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.primaryForeground,
    },
    resultCard: {
      borderRadius: radius.lg,
      backgroundColor: colors.background,
      padding: 12,
      gap: 2,
    },
    resultText: {
      fontSize: fontSize.xs,
      color: colors.mutedForeground,
    },
    autoSyncRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    autoSyncLabel: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.foreground,
    },
    autoSyncDesc: {
      fontSize: fontSize.xs,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    toggle: {
      width: 44,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.muted,
      justifyContent: "center",
      padding: 2,
    },
    toggleActive: { backgroundColor: colors.primary },
    toggleThumb: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.card,
    },
    toggleThumbActive: { alignSelf: "flex-end" },
    advancedHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    chevron: { fontSize: 12, color: colors.mutedForeground },
    resetBtn: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: withOpacity(colors.destructive, 0.3),
      paddingVertical: 8,
      alignItems: "center",
    },
    resetBtnText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.destructive,
    },
    resetDesc: {
      fontSize: fontSize.xs,
      color: colors.mutedForeground,
    },
  });
