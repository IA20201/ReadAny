/**
 * ThemeColorEditorScreen — the main theme editor screen.
 *
 * Combines color editing with quick links to typography, background, icons.
 * Uses the proven ColorPickerSheet (Modal-based) for color editing.
 *
 * Real-time preview:
 *   - Finger-up (onComplete) fires → writes to Zustand store → useColors()
 *     re-renders the entire app with new colors.
 *   - We intentionally do NOT use onChange (during drag) because writing to the
 *     store on every frame causes cascading re-renders that freeze the UI.
 */
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeStore } from "@readany/core/stores";
import { encodeThemeCode } from "@readany/core/theme/theme-codec";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { SettingsHeader } from "@/screens/settings/SettingsHeader";
import { ColorSlotRow } from "@/components/theme/ColorSlotRow";
import { ColorPickerSheet } from "@/components/theme/ColorPickerSheet";
import { useColors } from "@/styles/theme";
import { fontSize, fontWeight, radius, spacing } from "@/styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ThemeColorEditor">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

interface SlotDef {
  key: string;
  path: string[];
  labelKey: string;
  fallback: string;
  descKey: string;
  descFallback: string;
}

const BACKGROUND_SLOTS: SlotDef[] = [
  { key: "background", path: ["background"], labelKey: "theme.slot.background", fallback: "背景色 (L0)", descKey: "theme.slotDesc.background", descFallback: "页面底层背景" },
  { key: "foreground", path: ["foreground"], labelKey: "theme.slot.foreground", fallback: "前景色 (L0)", descKey: "theme.slotDesc.foreground", descFallback: "主要文字颜色" },
  { key: "card", path: ["card"], labelKey: "theme.slot.card", fallback: "卡片 (L2)", descKey: "theme.slotDesc.card", descFallback: "卡片、弹窗等容器背景" },
  { key: "muted", path: ["muted"], labelKey: "theme.slot.muted", fallback: "弱化色 (L3)", descKey: "theme.slotDesc.muted", descFallback: "标签栏、分隔区域背景" },
  { key: "mutedForeground", path: ["mutedForeground"], labelKey: "theme.slot.mutedForeground", fallback: "弱化前景", descKey: "theme.slotDesc.mutedForeground", descFallback: "次要文字、占位符" },
];

const FUNCTIONAL_SLOTS: SlotDef[] = [
  { key: "primary", path: ["primary"], labelKey: "theme.slot.primary", fallback: "主色", descKey: "theme.slotDesc.primary", descFallback: "按钮、链接、高亮" },
  { key: "primaryForeground", path: ["primaryForeground"], labelKey: "theme.slot.primaryForeground", fallback: "主色前景", descKey: "theme.slotDesc.primaryForeground", descFallback: "主色按钮上的文字" },
  { key: "border", path: ["border"], labelKey: "theme.slot.border", fallback: "边框", descKey: "theme.slotDesc.border", descFallback: "分割线、输入框边框" },
];

const READER_SLOTS: SlotDef[] = [
  { key: "reader.background", path: ["reader", "background"], labelKey: "theme.slot.readerBg", fallback: "阅读器背景", descKey: "theme.slotDesc.readerBg", descFallback: "阅读页面背景" },
  { key: "reader.foreground", path: ["reader", "foreground"], labelKey: "theme.slot.readerFg", fallback: "阅读器前景", descKey: "theme.slotDesc.readerFg", descFallback: "阅读页面正文" },
  { key: "reader.linkColor", path: ["reader", "linkColor"], labelKey: "theme.slot.readerLink", fallback: "阅读器链接", descKey: "theme.slotDesc.readerLink", descFallback: "阅读页面中的链接" },
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
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const uiColors = useColors();

  const { themeId, mode: initialMode } = route.params;
  const theme = useThemeStore((s) => s.themes.find((th) => th.id === themeId));
  const updateTheme = useThemeStore((s) => s.updateTheme);
  const setPreferredMode = useThemeStore((s) => s.setPreferredMode);
  const setActiveTheme = useThemeStore((s) => s.setActiveTheme);
  const savedPreferredMode = useThemeStore((s) => s.activeSelection.preferredMode);
  const savedActiveThemeId = useThemeStore((s) => s.activeSelection.themeId);

  const [activeMode, setActiveMode] = useState<"light" | "dark">(initialMode);
  const [activeSlot, setActiveSlot] = useState<SlotDef | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const originalPreferredModeRef = useRef(savedPreferredMode);
  const originalThemeIdRef = useRef(savedActiveThemeId);

  const modeColors = theme?.modes[activeMode];

  // Switch active theme to the one being edited
  useEffect(() => {
    setActiveTheme(themeId);
  }, [themeId, setActiveTheme]);

  // Sync app mode with editing tab
  useEffect(() => {
    setPreferredMode(activeMode);
  }, [activeMode, setPreferredMode]);

  // Restore original theme + mode when leaving
  useEffect(() => {
    const originalThemeId = originalThemeIdRef.current;
    const originalMode = originalPreferredModeRef.current;
    return () => {
      setActiveTheme(originalThemeId);
      setPreferredMode(originalMode);
    };
  }, [setActiveTheme, setPreferredMode]);

  // Android back: close picker first, then navigate back
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (activeSlot) {
        setActiveSlot(null);
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [activeSlot]);

  const handleSlotPress = useCallback(
    (slot: SlotDef) => {
      if (theme?.builtIn || !modeColors) return;
      setActiveSlot((prev) => (prev?.key === slot.key ? null : slot));
    },
    [modeColors, theme?.builtIn],
  );

  // Write color to store
  const flushColor = useCallback(
    (hex: string) => {
      if (!activeSlot || !theme || theme.builtIn || !modeColors) return;
      const updated = setNestedValue(modeColors, activeSlot.path, hex);
      updateTheme(theme.id, {
        modes: { ...theme.modes, [activeMode]: updated },
      });
    },
    [activeSlot, theme, activeMode, modeColors, updateTheme],
  );

  // Cancel → restore original color and close
  const handlePickerCancel = useCallback(
    (originalColor: string) => {
      if (!activeSlot || !theme || theme.builtIn || !modeColors) return;
      const restored = setNestedValue(modeColors, activeSlot.path, originalColor);
      updateTheme(theme.id, {
        modes: { ...theme.modes, [activeMode]: restored },
      });
    },
    [activeSlot, theme, activeMode, modeColors, updateTheme],
  );

  const handlePickerClose = useCallback(() => {
    setActiveSlot(null);
  }, []);

  // Copy theme code to clipboard
  const handleCopyThemeCode = useCallback(async () => {
    if (!theme) return;
    try {
      const code = await encodeThemeCode(theme);
      await Clipboard.setStringAsync(code);
      Alert.alert(t("theme.copied", "已复制"), t("theme.copiedDesc", "主题码已复制到剪贴板"));
    } catch {
      Alert.alert(t("common.failed", "失败"), t("theme.copyFailed", "复制失败，请重试"));
    }
  }, [theme, t]);

  if (!theme) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: uiColors.background }]} edges={["top"]}>
        <SettingsHeader title={t("theme.themeEditor", "主题编辑器")} />
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
            description={t(slot.descKey, slot.descFallback)}
            color={modeColors ? getNestedValue(modeColors, slot.path) : "#000000"}
            onPress={() => handleSlotPress(slot)}
            isLast={idx === slots.length - 1}
            disabled={theme.builtIn || !modeColors}
            expanded={activeSlot?.key === slot.key}
          />
        ))}
      </View>
    </View>
  );

  // Get the current color for the active slot (for picker initial value)
  const activeSlotColor = activeSlot && modeColors
    ? getNestedValue(modeColors, activeSlot.path)
    : "#000000";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: uiColors.background }]} edges={["top"]}>
      <SettingsHeader title={t("theme.themeEditor", "主题编辑器")} />

      {/* Scrollable slot list */}
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Mode tab */}
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
                onPress={() => {
                  if (available) {
                    setActiveMode(m);
                    setActiveSlot(null);
                  }
                }}
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

        {/* More settings — direct navigation rows */}
        {!theme.builtIn && (
          <View style={styles.group}>
            <Text style={[styles.groupTitle, { color: uiColors.mutedForeground }]}>
              {t("theme.moreSettings", "更多设置")}
            </Text>
            <View style={[styles.groupCard, { backgroundColor: uiColors.card, borderColor: uiColors.border }]}>
              {([
                { label: t("theme.typography", "字体"), icon: "text-outline" as const, screen: "ThemeTypography" as const },
                { label: t("theme.background", "背景"), icon: "image-outline" as const, screen: "ThemeBackground" as const },
                { label: t("theme.icons", "图标"), icon: "shapes-outline" as const, screen: "ThemeIcons" as const },
              ]).map((item, idx, arr) => (
                <TouchableOpacity
                  key={item.screen}
                  style={[
                    styles.navRow,
                    idx < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: uiColors.border },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate(item.screen, { themeId: theme.id })}
                >
                  <Ionicons name={item.icon} size={18} color={uiColors.foreground} />
                  <Text style={[styles.navRowLabel, { color: uiColors.foreground }]}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={uiColors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Copy theme code button */}
        {!theme.builtIn && (
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: uiColors.muted }]}
            activeOpacity={0.7}
            onPress={handleCopyThemeCode}
          >
            <Ionicons name="copy-outline" size={18} color={uiColors.foreground} />
            <Text style={[styles.shareBtnText, { color: uiColors.foreground }]}>
              {t("theme.copyThemeCode", "复制主题码")}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Color picker with real-time preview */}
      <ColorPickerSheet
        visible={!!activeSlot}
        initialColor={activeSlotColor}
        onComplete={flushColor}
        onCancel={handlePickerCancel}
        onClose={handlePickerClose}
        label={activeSlot ? t(activeSlot.labelKey, activeSlot.fallback) : undefined}
      />
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
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    gap: 12,
  },
  navRowLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.xl,
  },
  shareBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});
