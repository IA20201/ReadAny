/**
 * ThemeTypographyScreen — edit font family strings (sans/serif/mono).
 */
import { useRoute } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeStore, useFontStore } from "@readany/core/stores";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Modal,
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
import { ChevronDownIcon } from "@/components/ui/Icon";
import { useState } from "react";

type Props = NativeStackScreenProps<RootStackParamList, "ThemeTypography">;

const FONT_FIELDS = [
  { key: "fontSans" as const, label: "Sans-serif", placeholder: "system-ui, sans-serif" },
  { key: "fontSerif" as const, label: "Serif", placeholder: "Georgia, serif" },
  { key: "fontMono" as const, label: "Monospace", placeholder: "Menlo, monospace" },
];

export function ThemeTypographyScreen() {
  const route = useRoute<Props["route"]>();
  const { t } = useTranslation();
  const colors = useColors();

  const { themeId } = route.params;
  const theme = useThemeStore((s) => s.themes.find((th) => th.id === themeId));
  const updateTheme = useThemeStore((s) => s.updateTheme);

  if (!theme) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <SettingsHeader title={t("theme.typography", "Typography")} />
        <View style={styles.center}>
          <Text style={{ color: colors.mutedForeground }}>{t("theme.notFound", "Theme not found")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isBuiltIn = theme.builtIn;
  const typo = theme.typography ?? {};
  const customFonts = useFontStore((s) => s.fonts);

  const [fontPickerVisible, setFontPickerVisible] = useState(false);
  const [activeField, setActiveField] = useState<typeof FONT_FIELDS[number]["key"] | null>(null);

  const handleChange = (key: keyof typeof typo, value: string) => {
    if (isBuiltIn) return;
    updateTheme(theme.id, {
      typography: { ...typo, [key]: value || undefined },
    });
  };

  const openFontPicker = (fieldKey: typeof FONT_FIELDS[number]["key"]) => {
    if (isBuiltIn || customFonts.length === 0) return;
    setActiveField(fieldKey);
    setFontPickerVisible(true);
  };

  const selectFont = (fontFamily: string) => {
    if (activeField) {
      handleChange(activeField, `'${fontFamily}'`);
    }
    setFontPickerVisible(false);
    setActiveField(null);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <SettingsHeader title={t("theme.typography", "Typography")} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {t(
              "theme.typographyHint",
              "Enter CSS font-family strings. These affect the web reader; native UI uses system fonts.",
            )}
          </Text>

          {FONT_FIELDS.map((field) => (
            <View key={field.key} style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>{field.label}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.foreground,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      flex: 1,
                    },
                  ]}
                  value={typo[field.key] ?? ""}
                  onChangeText={(v) => handleChange(field.key, v)}
                  editable={!isBuiltIn}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!isBuiltIn && customFonts.length > 0 && (
                  <TouchableOpacity
                    style={[styles.fontPickerBtn, { backgroundColor: colors.primary }]}
                    onPress={() => openFontPicker(field.key)}
                  >
                    <ChevronDownIcon size={20} color={colors.primaryForeground} />
                  </TouchableOpacity>
                )}
              </View>
              {/* Preview */}
              <Text
                style={[
                  styles.preview,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                  },
                ]}
              >
                The quick brown fox jumps over the lazy dog. 敏捷的棕色狐狸跳过了懒狗。
              </Text>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Font Picker Modal */}
      <Modal
        visible={fontPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFontPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFontPickerVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t("fonts.selectFont", "选择字体")}
            </Text>
            <ScrollView style={styles.fontList}>
              {customFonts.map((font) => (
                <TouchableOpacity
                  key={font.id}
                  style={styles.fontItem}
                  onPress={() => selectFont(font.fontFamily)}
                >
                  <Text style={[styles.fontItemName, { color: colors.foreground }]}>
                    {font.name}
                    {font.source === "remote" && (
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                        {" "}({t("fonts.online", "在线")})
                      </Text>
                    )}
                  </Text>
                  <Text
                    style={[
                      styles.fontItemPreview,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Aa 中文预览
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: spacing.lg, gap: 20, paddingBottom: 40 },
  hint: { fontSize: fontSize.sm, lineHeight: 20 },
  field: { gap: 8 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSize.base,
  },
  fontPickerBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  preview: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxHeight: "70%",
    borderRadius: radius.lg,
    padding: 16,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: 12,
  },
  fontList: { maxHeight: 300 },
  fontItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  fontItemName: { fontSize: fontSize.base, fontWeight: fontWeight.medium },
  fontItemPreview: { fontSize: fontSize.sm, marginTop: 4 },
});
