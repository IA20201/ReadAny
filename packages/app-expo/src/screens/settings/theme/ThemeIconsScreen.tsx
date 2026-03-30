/**
 * ThemeIconsScreen — manage 8 SVG/PNG icon overrides.
 *
 * Each row: preview (default or custom icon) + slot name + edit/reset buttons.
 * Edit opens a modal with TextInput for pasting SVG + live preview + file upload.
 */
import {
  BookOpenIcon,
  MessageSquareIcon,
  NotebookPenIcon,
  UserIcon,
  PuzzleIcon,
  BarChart3Icon,
  HelpCircleIcon,
  CpuIcon,
  PlusIcon,
} from "@/components/ui/Icon";
import { useRoute } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeStore } from "@readany/core/stores";
import { getIconOverride, validateSvgDetailed } from "@readany/core/theme/icon-overrides";
import type { IconSlot, ThemeIcons } from "@readany/core/types";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { SettingsHeader } from "@/screens/settings/SettingsHeader";
import { useColors } from "@/styles/theme";
import { fontSize, fontWeight, radius, spacing } from "@/styles/theme";

const ICON_SIZE_LIMIT = 50 * 1024; // 50KB

type Props = NativeStackScreenProps<RootStackParamList, "ThemeIcons">;

/** Map icon slot to default icon component */
const DEFAULT_ICON_MAP: Record<IconSlot, typeof BookOpenIcon> = {
  bookOpen: BookOpenIcon,
  messageSquare: MessageSquareIcon,
  notebookPen: NotebookPenIcon,
  user: UserIcon,
  puzzle: PuzzleIcon,
  barChart3: BarChart3Icon,
  helpCircle: HelpCircleIcon,
  settings: CpuIcon,
};

const MOBILE_ICON_SLOTS: { slot: IconSlot; labelKey: string; fallback: string }[] = [
  { slot: "bookOpen", labelKey: "theme.iconSlot_bookOpen", fallback: "书库" },
  { slot: "messageSquare", labelKey: "theme.iconSlot_messageSquare", fallback: "聊天" },
  { slot: "notebookPen", labelKey: "theme.iconSlot_notebookPen", fallback: "笔记" },
  { slot: "user", labelKey: "theme.iconSlot_user", fallback: "我的" },
];

const DESKTOP_ICON_SLOTS: { slot: IconSlot; labelKey: string; fallback: string }[] = [
  { slot: "puzzle", labelKey: "theme.iconSlot_puzzle", fallback: "技能" },
  { slot: "barChart3", labelKey: "theme.iconSlot_barChart3", fallback: "统计" },
  { slot: "helpCircle", labelKey: "theme.iconSlot_helpCircle", fallback: "帮助" },
  { slot: "settings", labelKey: "theme.iconSlot_settings", fallback: "设置" },
];

export function ThemeIconsScreen() {
  const route = useRoute<Props["route"]>();
  const { t } = useTranslation();
  const colors = useColors();

  const { themeId } = route.params;
  const theme = useThemeStore((s) => s.themes.find((th) => th.id === themeId));
  const updateTheme = useThemeStore((s) => s.updateTheme);

  const [editSlot, setEditSlot] = useState<IconSlot | null>(null);
  const [svgInput, setSvgInput] = useState("");

  if (!theme) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <SettingsHeader title={t("theme.icons", "自定义图标")} />
        <View style={styles.center}>
          <Text style={{ color: colors.mutedForeground }}>{t("theme.notFound", "未找到主题")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isBuiltIn = theme.builtIn;
  const icons = theme.icons ?? {};

  const handleEdit = (slot: IconSlot) => {
    setSvgInput(icons[slot] ?? "");
    setEditSlot(slot);
  };

  const handleSave = () => {
    if (!editSlot || isBuiltIn) return;
    const trimmed = svgInput.trim();
    if (trimmed) {
      const result = validateSvgDetailed(trimmed);
      if (!result.valid) {
        Alert.alert(
          t("theme.invalidSvg", "无效的 SVG"),
          result.error || t("theme.invalidSvgDesc", "请粘贴有效的 SVG 字符串。"),
        );
        return;
      }
    }
    const updated: ThemeIcons = { ...icons, [editSlot]: trimmed || undefined };
    updateTheme(theme.id, { icons: updated });
    setEditSlot(null);
  };

  const handleReset = (slot: IconSlot) => {
    if (isBuiltIn) return;
    const updated: ThemeIcons = { ...icons };
    delete updated[slot];
    updateTheme(theme.id, { icons: updated });
  };

  const handleUpload = async () => {
    if (!editSlot || isBuiltIn) return;
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/svg+xml", "image/png"],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled || !result.assets?.[0]) return;
      
      const file = result.assets[0];
      
      if (file.size && file.size > ICON_SIZE_LIMIT) {
        Alert.alert(t("theme.iconTooLarge", "图标文件过大"), t("theme.iconSizeLimit", "最大支持 50KB"));
        return;
      }
      
      const ext = file.name?.split(".").pop()?.toLowerCase();
      
      if (ext === "svg") {
        const content = await FileSystem.readAsStringAsync(file.uri);
        const validationResult = validateSvgDetailed(content);
        if (validationResult.valid) {
          setSvgInput(content);
        } else {
          Alert.alert(t("theme.invalidSvg", "无效的 SVG"), validationResult.error);
        }
      } else if (ext === "png") {
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: "base64",
        });
        const dataUri = `data:image/png;base64,${base64}`;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><image href="${dataUri}" width="24" height="24"/></svg>`;
        setSvgInput(svg);
      } else {
        Alert.alert(t("theme.unsupportedIconFormat", "不支持的格式"), t("theme.useSvgOrPng", "请使用 SVG 或 PNG 文件"));
      }
    } catch (err) {
      console.error("Icon upload error:", err);
    }
  };

  const renderSlotRow = (slot: IconSlot, labelKey: string, fallback: string, idx: number, total: number) => {
    const customSvg = getIconOverride(icons, slot);
    const hasCustom = !!customSvg;
    const DefaultIcon = DEFAULT_ICON_MAP[slot];

    return (
      <View
        key={slot}
        style={[
          styles.row,
          idx < total - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        ]}
      >
        {/* Icon preview — show custom SVG or default icon */}
        <View style={[styles.iconBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          {customSvg ? (
            <SvgXml xml={customSvg} width={24} height={24} color={colors.foreground} />
          ) : (
            <DefaultIcon size={24} color={colors.foreground} />
          )}
        </View>
        <View style={styles.rowInfo}>
          <Text style={[styles.rowLabel, { color: colors.foreground }]}>{t(labelKey, fallback)}</Text>
          <Text style={[styles.rowStatus, { color: hasCustom ? colors.primary : colors.mutedForeground }]}>
            {hasCustom ? t("theme.customIcon", "自定义") : t("theme.defaultIcon", "默认")}
          </Text>
        </View>
        {!isBuiltIn && (
          <View style={styles.rowActions}>
            <TouchableOpacity onPress={() => handleEdit(slot)} style={styles.rowBtn}>
              <Text style={{ color: colors.primary, fontSize: fontSize.sm }}>
                {t("common.edit", "编辑")}
              </Text>
            </TouchableOpacity>
            {hasCustom && (
              <TouchableOpacity onPress={() => handleReset(slot)} style={styles.rowBtn}>
                <Text style={{ color: colors.destructive, fontSize: fontSize.sm }}>
                  {t("theme.resetIcon", "恢复默认")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <SettingsHeader title={t("theme.icons", "自定义图标")} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
        {/* Mobile slots */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            {t("theme.mobileIcons", "移动端标签栏")}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {MOBILE_ICON_SLOTS.map((s, i) =>
              renderSlotRow(s.slot, s.labelKey, s.fallback, i, MOBILE_ICON_SLOTS.length),
            )}
          </View>
        </View>
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={!!editSlot} transparent animationType="slide" onRequestClose={() => setEditSlot(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditSlot(null)} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
            {t("theme.editIcon", "编辑图标 SVG")}
          </Text>

          {/* SVG preview — larger area with both default and custom side by side */}
          <View style={styles.previewRow}>
            {/* Default icon */}
            <View style={styles.previewColumn}>
              <View style={[styles.previewBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                {editSlot && (() => {
                  const DefaultIcon = DEFAULT_ICON_MAP[editSlot];
                  return <DefaultIcon size={36} color={colors.foreground} />;
                })()}
              </View>
              <Text style={[styles.previewLabel, { color: colors.mutedForeground }]}>
                {t("theme.defaultIcon", "默认")}
              </Text>
            </View>

            {/* Custom preview */}
            <View style={styles.previewColumn}>
              <View style={[styles.previewBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                {svgInput.trim() && validateSvgDetailed(svgInput.trim()).valid ? (
                  <SvgXml xml={svgInput.trim()} width={36} height={36} color={colors.foreground} />
                ) : svgInput.trim() ? (
                  <Text style={{ color: colors.destructive, fontSize: 20 }}>✕</Text>
                ) : (
                  <PlusIcon size={28} color={colors.mutedForeground} />
                )}
              </View>
              <Text style={[styles.previewLabel, { color: colors.mutedForeground }]}>
                {t("theme.customIcon", "自定义")}
              </Text>
            </View>
          </View>

          <TextInput
            style={[
              styles.svgInput,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
            value={svgInput}
            onChangeText={setSvgInput}
            multiline
            numberOfLines={6}
            placeholder='<svg viewBox="0 0 24 24" ...>...</svg>'
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.uploadBtn, { borderColor: colors.border, borderWidth: 1 }]}
            onPress={handleUpload}
          >
            <Text style={{ color: colors.primary, fontWeight: fontWeight.medium }}>
              {t("theme.uploadIcon", "上传文件 (SVG/PNG)")}
            </Text>
          </TouchableOpacity>

          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={[styles.sheetBtn, { borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => setEditSlot(null)}
            >
              <Text style={{ color: colors.foreground, fontWeight: fontWeight.medium }}>
                {t("common.cancel", "取消")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
            >
              <Text style={{ color: colors.primaryForeground, fontWeight: fontWeight.medium }}>
                {t("common.save", "保存")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: spacing.lg, gap: 24, paddingBottom: 40 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  card: { borderRadius: radius.xl, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  rowInfo: { flex: 1, gap: 1 },
  rowLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  rowStatus: { fontSize: fontSize.xs },
  rowActions: { flexDirection: "row", gap: 8 },
  rowBtn: { padding: 4 },
  // Modal
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: 32,
    gap: 16,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  sheetTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: "center" },
  previewRow: { flexDirection: "row", gap: 16, justifyContent: "center" },
  previewColumn: { alignItems: "center", gap: 6 },
  previewBox: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  previewLabel: { fontSize: fontSize.xs },
  svgInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    fontSize: fontSize.sm,
    minHeight: 100,
    textAlignVertical: "top",
  },
  uploadBtn: {
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  sheetActions: { flexDirection: "row", gap: 12 },
  sheetBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
});
