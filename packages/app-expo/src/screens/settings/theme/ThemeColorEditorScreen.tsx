/**
 * ThemeColorEditorScreen — edit color slots for a given theme.
 *
 * Light/Dark mode as in-page tab (state), not navigation.
 * Groups: Background layers (L0-L3), Functional, Reader.
 * Each slot: color swatch + label + hex. Tap to open color picker.
 */
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeStore } from "@readany/core/stores";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { SettingsHeader } from "@/screens/settings/SettingsHeader";
import { ColorSlotRow } from "@/components/theme/ColorSlotRow";
import { ColorPickerSheet } from "@/components/theme/ColorPickerSheet";
import { useColors } from "@/styles/theme";
import { fontSize, fontWeight, radius, spacing } from "@/styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ThemeColorEditor">;

interface SlotDef {
  key: string;
  path: string[];
  labelKey: string;
  fallback: string;
}

const BACKGROUND_SLOTS: SlotDef[] = [
  { key: "background", path: ["background"], labelKey: "theme.slot.background", fallback: "背景色 (L0)" },
  { key: "foreground", path: ["foreground"], labelKey: "theme.slot.foreground", fallback: "前景色 (L0)" },
  { key: "card", path: ["card"], labelKey: "theme.slot.card", fallback: "卡片 (L2)" },
  { key: "cardForeground", path: ["cardForeground"], labelKey: "theme.slot.cardForeground", fallback: "卡片前景" },
  { key: "muted", path: ["muted"], labelKey: "theme.slot.muted", fallback: "弱化色 (L3)" },
  { key: "mutedForeground", path: ["mutedForeground"], labelKey: "theme.slot.mutedForeground", fallback: "弱化前景" },
  { key: "sidebar", path: ["sidebar"], labelKey: "theme.slot.sidebar", fallback: "侧栏 (L1)" },
  { key: "sidebarForeground", path: ["sidebarForeground"], labelKey: "theme.slot.sidebarForeground", fallback: "侧栏前景" },
];

const FUNCTIONAL_SLOTS: SlotDef[] = [
  { key: "primary", path: ["primary"], labelKey: "theme.slot.primary", fallback: "主色" },
  { key: "primaryForeground", path: ["primaryForeground"], labelKey: "theme.slot.primaryForeground", fallback: "主色前景" },
  { key: "accent", path: ["accent"], labelKey: "theme.slot.accent", fallback: "强调色" },
  { key: "accentForeground", path: ["accentForeground"], labelKey: "theme.slot.accentForeground", fallback: "强调前景" },
  { key: "border", path: ["border"], labelKey: "theme.slot.border", fallback: "边框" },
];

const READER_SLOTS: SlotDef[] = [
  { key: "reader.background", path: ["reader", "background"], labelKey: "theme.slot.readerBg", fallback: "阅读器背景" },
  { key: "reader.foreground", path: ["reader", "foreground"], labelKey: "theme.slot.readerFg", fallback: "阅读器前景" },
  { key: "reader.linkColor", path: ["reader", "linkColor"], labelKey: "theme.slot.readerLink", fallback: "阅读器链接" },
];

function getNestedValue(obj: any, path: string[]): string {
  let val = obj;
  for (const p of path) {
    val = val?.[p];
  }
  return (val as string) ?? "#000000";
}

function setNestedValue(obj: any, path: string[], value: string): any {
  if (path.length === 1) {
    return { ...obj, [path[0]]: value };
  }
  return {
    ...obj,
    [path[0]]: setNestedValue(obj[path[0]] ?? {}, path.slice(1), value),
  };
}

export function ThemeColorEditorScreen() {
  const route = useRoute<Props["route"]>();
  const { t } = useTranslation();
  const uiColors = useColors();

  const { themeId, mode: initialMode } = route.params;
  const theme = useThemeStore((s) => s.themes.find((th) => th.id === themeId));
  const updateTheme = useThemeStore((s) => s.updateTheme);

  const [activeMode, setActiveMode] = useState<"light" | "dark">(initialMode);
  const [pickerSlot, setPickerSlot] = useState<SlotDef | null>(null);
  const [pickerColor, setPickerColor] = useState("#000000");

  const modeColors = theme?.modes[activeMode];

  const handleSlotPress = useCallback(
    (slot: SlotDef) => {
      if (!modeColors || theme?.builtIn) return;
      const current = getNestedValue(modeColors, slot.path);
      setPickerColor(current);
      setPickerSlot(slot);
    },
    [modeColors, theme?.builtIn],
  );

  const handleColorComplete = useCallback(
    (hex: string) => {
      if (!pickerSlot || !theme || theme.builtIn || !modeColors) return;
      const updated = setNestedValue(modeColors, pickerSlot.path, hex);
      updateTheme(theme.id, {
        modes: { ...theme.modes, [activeMode]: updated },
      });
    },
    [pickerSlot, theme, activeMode, modeColors, updateTheme],
  );

  const handlePickerClose = useCallback(() => {
    setPickerSlot(null);
  }, []);

  if (!theme) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: uiColors.background }]} edges={["top"]}>
        <SettingsHeader title={t("theme.colorEditor", "颜色编辑器")} />
        <View style={styles.center}>
          <Text style={{ color: uiColors.mutedForeground }}>
            {t("theme.notFound", "主题未找到")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderGroup = (title: string, slots: SlotDef[]) => (
    <View style={styles.group} key={title}>
      <Text style={[styles.groupTitle, { color: uiColors.mutedForeground }]}>{title}</Text>
      <View style={[styles.groupCard, { backgroundColor: uiColors.card, borderColor: uiColors.border }]}>
        {slots.map((slot, idx) => (
          <ColorSlotRow
            key={slot.key}
            label={t(slot.labelKey, slot.fallback)}
            color={modeColors ? getNestedValue(modeColors, slot.path) : "#000000"}
            onPress={() => handleSlotPress(slot)}
            isLast={idx === slots.length - 1}
            disabled={theme.builtIn || !modeColors}
          />
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: uiColors.background }]} edges={["top"]}>
      <SettingsHeader title={t("theme.colorEditor", "颜色编辑器")} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
          {/* Mode tab — in-page state switch */}
          <View style={[styles.modeToggle, { backgroundColor: uiColors.muted, borderRadius: radius.lg }]}>
            {(["light", "dark"] as const).map((m) => {
              const available = !!theme.modes[m];
              const active = m === activeMode;
              return (
                <TouchableOpacity
                  key={m}
                  disabled={!available}
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor: active ? uiColors.card : "transparent",
                      borderRadius: radius.md,
                      opacity: available ? 1 : 0.4,
                    },
                    active && {
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 2,
                    },
                  ]}
                  onPress={() => available && setActiveMode(m)}
                >
                  <Text
                    style={{
                      color: active ? uiColors.foreground : uiColors.mutedForeground,
                      fontWeight: active ? fontWeight.semibold : fontWeight.normal,
                      fontSize: fontSize.sm,
                    }}
                  >
                    {m === "light" ? t("settings.light", "浅色") : t("settings.dark", "深色")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!modeColors ? (
            <View style={styles.center}>
              <Text style={{ color: uiColors.mutedForeground }}>
                {t("theme.modeNotAvailable", "此模式不可用")}
              </Text>
            </View>
          ) : (
            <>
              {renderGroup(t("theme.backgrounds", "背景色"), BACKGROUND_SLOTS)}
              {renderGroup(t("theme.functional", "功能色"), FUNCTIONAL_SLOTS)}
              {renderGroup(t("theme.reader", "阅读器"), READER_SLOTS)}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {pickerSlot && (
        <ColorPickerSheet
          visible={!!pickerSlot}
          initialColor={pickerColor}
          onComplete={handleColorComplete}
          onClose={handlePickerClose}
          label={t(pickerSlot.labelKey, pickerSlot.fallback)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40 },
  scrollContent: { padding: spacing.lg, gap: 20, paddingBottom: 40 },
  modeToggle: { flexDirection: "row", padding: 3 },
  modeBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  group: { gap: 8 },
  groupTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, textTransform: "uppercase", letterSpacing: 1 },
  groupCard: { borderRadius: radius.xl, borderWidth: 1, overflow: "hidden" },
});
