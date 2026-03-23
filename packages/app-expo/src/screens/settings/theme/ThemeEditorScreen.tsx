/**
 * ThemeEditorScreen — main hub for editing a theme.
 *
 * Sections: name/author, mode toggles, preview strip, navigation to sub-pages,
 * built-in protection banner, delete button.
 */
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeStore } from "@readany/core/stores";
import type { ThemeConfig } from "@readany/core/types";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
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
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { SettingsHeader } from "@/screens/settings/SettingsHeader";
import { useColors } from "@/styles/theme";
import { fontSize, fontWeight, radius, spacing } from "@/styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ThemeEditor">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ThemeEditorScreen() {
  const route = useRoute<Props["route"]>();
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const colors = useColors();

  const themeId = route.params?.themeId;
  const theme = useThemeStore((s) => s.themes.find((th) => th.id === themeId));
  const updateTheme = useThemeStore((s) => s.updateTheme);
  const deleteTheme = useThemeStore((s) => s.deleteTheme);
  const duplicateTheme = useThemeStore((s) => s.duplicateTheme);
  const setActiveTheme = useThemeStore((s) => s.setActiveTheme);

  if (!theme) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <SettingsHeader title={t("theme.editor", "Theme Editor")} />
        <View style={styles.center}>
          <Text style={{ color: colors.mutedForeground }}>
            {t("theme.notFound", "Theme not found")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isBuiltIn = theme.builtIn;

  const handleNameChange = (name: string) => {
    if (!isBuiltIn) updateTheme(theme.id, { name });
  };
  const handleAuthorChange = (author: string) => {
    if (!isBuiltIn) updateTheme(theme.id, { author });
  };

  const handleDelete = () => {
    Alert.alert(
      t("theme.deleteTitle", "Delete Theme"),
      t("theme.deleteMessage", "Are you sure you want to delete this theme?"),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("common.delete", "Delete"),
          style: "destructive",
          onPress: () => {
            deleteTheme(theme.id);
            navigation.goBack();
          },
        },
      ],
    );
  };

  const handleDuplicate = () => {
    const newId = duplicateTheme(theme.id);
    setActiveTheme(newId);
    navigation.replace("ThemeEditor", { themeId: newId });
  };

  // Preview color strip: L0-L3 + primary + accent
  const previewMode = theme.modes.light ? "light" : "dark";
  const previewColors = theme.modes[previewMode]!;
  const stripColors = [
    previewColors.background,
    previewColors.card,
    previewColors.muted,
    previewColors.primary,
    previewColors.accent,
    previewColors.border,
  ];

  const sections = [
    {
      label: t("theme.colors", "Colors"),
      subtitle: t("theme.colorsDesc", "Background, text, accent colors"),
      onPress: () => navigation.navigate("ThemeColorEditor", { themeId: theme.id, mode: previewMode }),
    },
    {
      label: t("theme.typography", "Typography"),
      subtitle: t("theme.typographyDesc", "Font families"),
      onPress: () => navigation.navigate("ThemeTypography", { themeId: theme.id }),
    },
    {
      label: t("theme.background", "Background"),
      subtitle: t("theme.backgroundDesc", "Background image & overlay"),
      onPress: () => navigation.navigate("ThemeBackground", { themeId: theme.id }),
    },
    {
      label: t("theme.icons", "Icons"),
      subtitle: t("theme.iconsDesc", "Custom icon overrides"),
      onPress: () => navigation.navigate("ThemeIcons", { themeId: theme.id }),
    },
    {
      label: t("theme.share", "Share"),
      subtitle: t("theme.shareDesc", "Export & import theme code"),
      onPress: () => navigation.navigate("ThemeShare", { themeId: theme.id }),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <SettingsHeader title={t("theme.editor", "Theme Editor")} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
          {/* Built-in protection */}
          {isBuiltIn && (
            <View style={[styles.banner, { backgroundColor: colors.muted }]}>
              <Text style={[styles.bannerText, { color: colors.mutedForeground }]}>
                {t("theme.builtInHint", "Built-in themes cannot be edited directly.")}
              </Text>
              <TouchableOpacity
                style={[styles.bannerBtn, { backgroundColor: colors.primary }]}
                onPress={handleDuplicate}
              >
                <Text style={[styles.bannerBtnText, { color: colors.primaryForeground }]}>
                  {t("theme.duplicateAsCustom", "Copy as Custom")}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Name & author */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              {t("theme.name", "Name")}
            </Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={theme.name}
              onChangeText={handleNameChange}
              editable={!isBuiltIn}
              placeholder={t("theme.namePlaceholder", "Theme name")}
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 12 }]}>
              {t("theme.author", "Author")}
            </Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={theme.author ?? ""}
              onChangeText={handleAuthorChange}
              editable={!isBuiltIn}
              placeholder={t("theme.authorPlaceholder", "Author name")}
              placeholderTextColor={colors.mutedForeground}
            />
          </View>

          {/* Mode indicators */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              {t("theme.modes", "Modes")}
            </Text>
            <View style={styles.modeRow}>
              {(["light", "dark"] as const).map((m) => (
                <View
                  key={m}
                  style={[
                    styles.modeBadge,
                    {
                      backgroundColor: theme.modes[m] ? colors.primary + "20" : colors.muted,
                      borderColor: theme.modes[m] ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: theme.modes[m] ? colors.primary : colors.mutedForeground,
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.medium,
                    }}
                  >
                    {m === "light" ? t("settings.light", "Light") : t("settings.dark", "Dark")}
                    {theme.modes[m] ? " ✓" : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Preview strip */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              {t("theme.preview", "Preview")}
            </Text>
            <View style={styles.stripRow}>
              {stripColors.map((c, i) => (
                <View
                  key={i}
                  style={[styles.stripSwatch, { backgroundColor: c, borderColor: colors.border }]}
                />
              ))}
            </View>
          </View>

          {/* Section navigation */}
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {sections.map((sec, idx) => (
              <TouchableOpacity
                key={sec.label}
                style={[
                  styles.listItem,
                  idx < sections.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                ]}
                onPress={sec.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.listItemContent}>
                  <Text style={[styles.listItemLabel, { color: colors.foreground }]}>{sec.label}</Text>
                  <Text style={[styles.listItemSub, { color: colors.mutedForeground }]}>{sec.subtitle}</Text>
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Delete */}
          {!isBuiltIn && (
            <TouchableOpacity style={[styles.deleteBtn, { borderColor: colors.destructive }]} onPress={handleDelete}>
              <Text style={{ color: colors.destructive, fontWeight: fontWeight.medium }}>
                {t("theme.delete", "Delete Theme")}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: spacing.lg, gap: 20, paddingBottom: 40 },
  banner: { borderRadius: radius.xl, padding: spacing.lg, gap: 12, alignItems: "center" },
  bannerText: { fontSize: fontSize.sm, textAlign: "center" },
  bannerBtn: { borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 16 },
  bannerBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  section: { gap: 8 },
  sectionTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, textTransform: "uppercase", letterSpacing: 1 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSize.base,
  },
  modeRow: { flexDirection: "row", gap: 8 },
  modeBadge: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stripRow: { flexDirection: "row", gap: 6 },
  stripSwatch: {
    flex: 1,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  listCard: { borderRadius: radius.xl, borderWidth: 1, overflow: "hidden" },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  listItemContent: { flex: 1, gap: 2 },
  listItemLabel: { fontSize: fontSize.base, fontWeight: fontWeight.medium },
  listItemSub: { fontSize: fontSize.xs },
  deleteBtn: {
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
});
