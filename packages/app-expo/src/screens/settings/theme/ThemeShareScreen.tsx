/**
 * ThemeShareScreen — export/import theme codes.
 */
import { useRoute } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeStore } from "@readany/core/stores";
import { decodeThemeCode, encodeThemeCode } from "@readany/core/theme/theme-codec";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { SettingsHeader } from "@/screens/settings/SettingsHeader";
import { useColors } from "@/styles/theme";
import { fontSize, fontWeight, radius, spacing } from "@/styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ThemeShare">;

export function ThemeShareScreen() {
  const route = useRoute<Props["route"]>();
  const { t } = useTranslation();
  const colors = useColors();

  const { themeId } = route.params;
  const theme = useThemeStore((s) => s.themes.find((th) => th.id === themeId));
  const addTheme = useThemeStore((s) => s.addTheme);
  const setActiveTheme = useThemeStore((s) => s.setActiveTheme);

  const [exportCode, setExportCode] = useState("");
  const [importInput, setImportInput] = useState("");
  const [exporting, setExporting] = useState(false);

  if (!theme) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <SettingsHeader title={t("theme.share", "Share")} />
        <View style={styles.center}>
          <Text style={{ color: colors.mutedForeground }}>{t("theme.notFound", "Theme not found")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleExport = useCallback(async () => {
    if (!theme) return;
    setExporting(true);
    try {
      const code = await encodeThemeCode(theme);
      setExportCode(code);
    } catch (e) {
      Alert.alert(t("theme.exportError", "Export Error"), String(e));
    } finally {
      setExporting(false);
    }
  }, [theme, t]);

  const handleCopy = useCallback(async () => {
    if (!exportCode) return;
    await Clipboard.setStringAsync(exportCode);
    Alert.alert(t("theme.copied", "Copied!"), t("theme.copiedDesc", "Theme code copied to clipboard."));
  }, [exportCode, t]);

  const handleShare = useCallback(async () => {
    if (!exportCode) return;
    try {
      const Sharing = await import("expo-sharing");
      if (await Sharing.isAvailableAsync()) {
        // Write to temp file for sharing
        const FileSystem = await import("expo-file-system/legacy");
        const path = `${FileSystem.cacheDirectory}theme-code.txt`;
        await FileSystem.writeAsStringAsync(path, exportCode);
        await Sharing.shareAsync(path, { mimeType: "text/plain" });
      } else {
        // Fallback: just copy
        await handleCopy();
      }
    } catch {
      await handleCopy();
    }
  }, [exportCode, handleCopy]);

  const handleImport = useCallback(async () => {
    const trimmed = importInput.trim();
    if (!trimmed) return;

    const decoded = await decodeThemeCode(trimmed);
    if (!decoded) {
      Alert.alert(
        t("theme.importError", "Import Error"),
        t("theme.importErrorDesc", "Invalid theme code. Please check and try again."),
      );
      return;
    }

    Alert.alert(
      t("theme.importConfirm", "Import Theme"),
      t("theme.importConfirmDesc", 'Import "{{name}}" by {{author}}?').replace("{{name}}", decoded.name).replace("{{author}}", decoded.author ?? "Unknown"),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("theme.import", "Import"),
          onPress: () => {
            const { id, builtIn, createdAt, updatedAt, ...rest } = decoded;
            const newId = addTheme(rest);
            setActiveTheme(newId);
            setImportInput("");
            Alert.alert(t("theme.imported", "Imported!"), t("theme.importedDesc", "Theme has been imported and activated."));
          },
        },
      ],
    );
  }, [importInput, addTheme, setActiveTheme, t]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <SettingsHeader title={t("theme.share", "Share")} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
        {/* Export */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            {t("theme.export", "Export")}
          </Text>
          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: colors.primary }]}
            onPress={handleExport}
            disabled={exporting}
          >
            <Text style={{ color: colors.primaryForeground, fontWeight: fontWeight.medium }}>
              {exporting
                ? t("theme.generating", "Generating...")
                : t("theme.generateCode", "Generate Theme Code")}
            </Text>
          </TouchableOpacity>

          {exportCode ? (
            <View style={styles.codeBlock}>
              <TextInput
                style={[
                  styles.codeInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
                value={exportCode}
                multiline
                editable={false}
                selectTextOnFocus
              />
              <View style={styles.codeActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.muted }]}
                  onPress={handleCopy}
                >
                  <Text style={{ color: colors.foreground, fontWeight: fontWeight.medium }}>
                    {t("theme.copy", "Copy")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.muted }]}
                  onPress={handleShare}
                >
                  <Text style={{ color: colors.foreground, fontWeight: fontWeight.medium }}>
                    {t("theme.shareAction", "Share")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        {/* Import */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            {t("theme.import", "Import")}
          </Text>
          <TextInput
            style={[
              styles.importInput,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
            value={importInput}
            onChangeText={setImportInput}
            multiline
            numberOfLines={4}
            placeholder={t("theme.importPlaceholder", "Paste theme code here...")}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[
              styles.importBtn,
              {
                backgroundColor: importInput.trim() ? colors.primary : colors.muted,
              },
            ]}
            onPress={handleImport}
            disabled={!importInput.trim()}
          >
            <Text
              style={{
                color: importInput.trim() ? colors.primaryForeground : colors.mutedForeground,
                fontWeight: fontWeight.medium,
              }}
            >
              {t("theme.importAction", "Import Theme")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: spacing.lg, gap: 24, paddingBottom: 40 },
  section: { gap: 12 },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  exportBtn: {
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  codeBlock: { gap: 8 },
  codeInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    fontSize: fontSize.xs,
    minHeight: 80,
    textAlignVertical: "top",
  },
  codeActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  importInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    fontSize: fontSize.sm,
    minHeight: 80,
    textAlignVertical: "top",
  },
  importBtn: {
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
});
