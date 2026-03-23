/**
 * ThemeTypographyScreen — edit font family strings (sans/serif/mono).
 */
import { useRoute } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeStore } from "@readany/core/stores";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { SettingsHeader } from "@/screens/settings/SettingsHeader";
import { useColors } from "@/styles/theme";
import { fontSize, fontWeight, radius, spacing } from "@/styles/theme";

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

  const handleChange = (key: keyof typeof typo, value: string) => {
    if (isBuiltIn) return;
    updateTheme(theme.id, {
      typography: { ...typo, [key]: value || undefined },
    });
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
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
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
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSize.base,
  },
  preview: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
