/**
 * AppearanceSettingsScreen — dynamic theme management hub.
 *
 * Shows all available themes as cards, mode selector, create/import actions.
 */
import { BookOpenIcon, MoonIcon, SunIcon, Trash2Icon, EditIcon } from "@/components/ui/Icon";
import { useTheme } from "@/styles/theme";
import { fontSize, fontWeight, radius, spacing } from "@/styles/theme";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { useThemeStore } from "@readany/core/stores";
import { decodeThemeCode } from "@readany/core/theme/theme-codec";
import { BUILT_IN_THEMES } from "@readany/core/theme/built-in-themes";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingsHeader } from "./SettingsHeader";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type PreferredMode = "light" | "dark" | "auto";

const MODE_OPTIONS: { id: PreferredMode; labelKey: string; fallback: string; Icon: typeof SunIcon }[] = [
  { id: "light", labelKey: "settings.light", fallback: "Light", Icon: SunIcon },
  { id: "dark", labelKey: "settings.dark", fallback: "Dark", Icon: MoonIcon },
  { id: "auto", labelKey: "settings.auto", fallback: "Auto", Icon: BookOpenIcon },
];

export default function AppearanceSettingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();

  const themes = useThemeStore((s) => s.themes);
  const activeThemeId = useThemeStore((s) => s.activeSelection.themeId);
  const preferredMode = useThemeStore((s) => s.activeSelection.preferredMode);
  const setActiveTheme = useThemeStore((s) => s.setActiveTheme);
  const setPreferredMode = useThemeStore((s) => s.setPreferredMode);
  const addTheme = useThemeStore((s) => s.addTheme);
  const deleteTheme = useThemeStore((s) => s.deleteTheme);
  const duplicateTheme = useThemeStore((s) => s.duplicateTheme);

  const [importInput, setImportInput] = useState("");

  const handleThemeSelect = useCallback(
    (themeId: string) => {
      setActiveTheme(themeId);
    },
    [setActiveTheme],
  );

  const handleThemeLongPress = useCallback(
    (themeId: string, isBuiltIn: boolean) => {
      const options = isBuiltIn
        ? [
            { text: t("theme.duplicate", "Duplicate"), onPress: () => {
              const newId = duplicateTheme(themeId);
              navigation.navigate("ThemeEditor", { themeId: newId });
            }},
            { text: t("common.cancel", "Cancel"), style: "cancel" as const },
          ]
        : [
            { text: t("common.edit", "Edit"), onPress: () => navigation.navigate("ThemeEditor", { themeId }) },
            { text: t("theme.duplicate", "Duplicate"), onPress: () => {
              const newId = duplicateTheme(themeId);
              navigation.navigate("ThemeEditor", { themeId: newId });
            }},
            { text: t("theme.share", "Share"), onPress: () => navigation.navigate("ThemeShare", { themeId }) },
            { text: t("common.delete", "Delete"), style: "destructive" as const, onPress: () => {
              Alert.alert(
                t("theme.deleteTitle", "Delete Theme"),
                t("theme.deleteMessage", "Are you sure?"),
                [
                  { text: t("common.cancel", "Cancel"), style: "cancel" },
                  { text: t("common.delete", "Delete"), style: "destructive", onPress: () => deleteTheme(themeId) },
                ],
              );
            }},
            { text: t("common.cancel", "Cancel"), style: "cancel" as const },
          ];
      Alert.alert(t("theme.actions", "Theme Actions"), undefined, options);
    },
    [duplicateTheme, deleteTheme, navigation, t],
  );

  const handleDeleteTheme = useCallback(
    (themeId: string, themeName: string) => {
      Alert.alert(
        t("theme.deleteTitle", "Delete Theme"),
        t("theme.deleteConfirm", "Are you sure you want to delete \"{{name}}\"?", { name: themeName }),
        [
          { text: t("common.cancel", "Cancel"), style: "cancel" },
          { text: t("common.delete", "Delete"), style: "destructive", onPress: () => deleteTheme(themeId) },
        ],
      );
    },
    [deleteTheme, t],
  );

  const handleCreateTheme = useCallback(() => {
    const newId = addTheme({
      name: t("theme.newTheme", "My Theme"),
      modes: {
        light: { ...BUILT_IN_THEMES[0].modes.light! },
        dark: { ...BUILT_IN_THEMES[0].modes.dark! },
      },
    });
    navigation.navigate("ThemeEditor", { themeId: newId });
  }, [addTheme, navigation, t]);

  const handleImport = useCallback(async () => {
    const trimmed = importInput.trim();
    if (!trimmed) return;
    const decoded = await decodeThemeCode(trimmed);
    if (!decoded) {
      Alert.alert(t("theme.importError", "Import Error"), t("theme.importErrorDesc", "Invalid theme code."));
      return;
    }
    const { id, builtIn, createdAt, updatedAt, ...rest } = decoded;
    const newId = addTheme(rest);
    setImportInput("");
    Alert.alert(t("theme.imported", "Imported!"), `"${decoded.name}" ${t("theme.importedDesc", "has been imported.")}`);
  }, [importInput, addTheme, t]);

  const s = makeStyles(colors);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <SettingsHeader
        title={t("settings.appearance", "外观设置")}
        subtitle={t("settings.realtimeHint")}
      />

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* Mode selector */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>
            {t("settings.mode", "Mode")}
          </Text>
          <View style={s.modeGrid}>
            {MODE_OPTIONS.map((item) => {
              const active = preferredMode === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    s.modeCard,
                    { borderColor: colors.border, backgroundColor: colors.card },
                    active && {
                      borderColor: colors.primary,
                      backgroundColor: colors.primary + "0D",
                    },
                  ]}
                  onPress={() => setPreferredMode(item.id)}
                  activeOpacity={0.7}
                >
                  <item.Icon size={24} color={active ? colors.primary : colors.mutedForeground} />
                  <Text
                    style={[
                      s.modeLabel,
                      { color: colors.foreground },
                      active && { fontWeight: fontWeight.medium, color: colors.primary },
                    ]}
                  >
                    {t(item.labelKey, item.fallback)}
                  </Text>
                  {active && (
                    <View style={s.checkBadge}>
                      <Text style={[s.checkMark, { color: colors.primary }]}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Theme cards */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>
            {t("settings.theme", "主题")}
          </Text>
          <View style={s.themeGrid}>
            {themes.map((theme) => {
              const active = activeThemeId === theme.id;
              const isCustom = !theme.builtIn;
              // Preview strip from first available mode
              const previewMode = theme.modes.light ? "light" : "dark";
              const pc = theme.modes[previewMode]!;
              const stripColors = [pc.background, pc.card, pc.muted, pc.primary, pc.accent, pc.border];

              return (
                <TouchableOpacity
                  key={theme.id}
                  style={[
                    s.themeCard,
                    { borderColor: colors.border, backgroundColor: colors.card },
                    active && { borderColor: colors.primary, borderWidth: 2 },
                  ]}
                  onPress={() => handleThemeSelect(theme.id)}
                  onLongPress={() => handleThemeLongPress(theme.id, theme.builtIn)}
                  activeOpacity={0.7}
                >
                  {/* Color strip */}
                  <View style={s.stripRow}>
                    {stripColors.map((c, i) => (
                      <View
                        key={i}
                        style={[s.stripSwatch, { backgroundColor: c }]}
                      />
                    ))}
                  </View>
                  <View style={s.themeCardFooter}>
                    {active && (
                      <Text style={[s.checkMark, { color: colors.primary }]}>✓</Text>
                    )}
                    <Text
                      style={[
                        s.themeName,
                        { color: colors.foreground },
                        active && { color: colors.primary, fontWeight: fontWeight.semibold },
                      ]}
                      numberOfLines={1}
                    >
                      {theme.name}
                    </Text>
                    <View style={s.themeActions}>
                      {isCustom && (
                        <>
                          <TouchableOpacity
                            style={s.themeActionBtn}
                            onPress={() => navigation.navigate("ThemeEditor", { themeId: theme.id })}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <EditIcon size={16} color={colors.mutedForeground} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={s.themeActionBtn}
                            onPress={() => handleDeleteTheme(theme.id, theme.name)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Trash2Icon size={16} color={colors.destructive} />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Create button */}
          <TouchableOpacity
            style={[s.createBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={handleCreateTheme}
            activeOpacity={0.7}
          >
            <Text style={{ color: colors.primary, fontWeight: fontWeight.medium }}>
              + {t("theme.createCustom", "Create Custom Theme")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Import */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>
            {t("theme.import", "Import")}
          </Text>
          <TextInput
            style={[
              s.importInput,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
            value={importInput}
            onChangeText={setImportInput}
            placeholder={t("theme.importPlaceholder", "Paste theme code (RA-THEME:...)")}
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={2}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[
              s.importBtn,
              { backgroundColor: importInput.trim() ? colors.primary : colors.muted },
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
              {t("theme.importAction", "Import")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(_colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.lg, gap: 24, paddingBottom: 48 },
    section: { gap: 12 },
    sectionTitle: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    // Mode
    modeGrid: { flexDirection: "row", gap: 12 },
    modeCard: {
      flex: 1,
      alignItems: "center",
      gap: 8,
      borderRadius: radius.xl,
      borderWidth: 1,
      padding: 16,
      position: "relative",
    },
    modeLabel: { fontSize: fontSize.sm },
    checkBadge: { position: "absolute", top: 8, right: 8 },
    checkMark: { fontSize: 14 },
    // Theme cards
    themeGrid: { gap: 12 },
    themeCard: {
      borderRadius: radius.xl,
      borderWidth: 1,
      padding: 12,
      gap: 8,
      position: "relative",
    },
    stripRow: { flexDirection: "row", gap: 4 },
    stripSwatch: { flex: 1, height: 24, borderRadius: 4, borderWidth: 0.5, borderColor: "rgba(0,0,0,0.1)" },
    themeCardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 6,
    },
    themeName: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, flex: 1 },
    themeActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    themeActionBtn: { padding: 4 },
    createBtn: {
      borderRadius: radius.xl,
      borderWidth: 1,
      borderStyle: "dashed",
      paddingVertical: 14,
      alignItems: "center",
    },
    // Import
    importInput: {
      borderWidth: 1,
      borderRadius: radius.md,
      padding: 12,
      fontSize: fontSize.sm,
      minHeight: 48,
      textAlignVertical: "top",
    },
    importBtn: {
      borderRadius: radius.md,
      paddingVertical: 12,
      alignItems: "center",
    },
  });
}
