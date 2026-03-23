/**
 * LanguageSettingsScreen — standalone language selection page.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingsHeader } from "./SettingsHeader";
import { useColors } from "@/styles/theme";
import { fontSize, fontWeight, radius, spacing } from "@/styles/theme";

const LANGUAGES = [
  { code: "zh", labelKey: "settings.simplifiedChinese", fallback: "简体中文" },
  { code: "en", labelKey: "settings.english", fallback: "English" },
] as const;

export default function LanguageSettingsScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const [lang, setLang] = useState(() => (i18n.language?.startsWith("zh") ? "zh" : "en"));

  useEffect(() => {
    const newLang = i18n.language?.startsWith("zh") ? "zh" : "en";
    setLang(newLang);
  }, [i18n.language]);

  const handleLangChange = useCallback(async (code: string) => {
    setLang(code);
    try {
      const { changeAndPersistLanguage } = await import("@readany/core/i18n");
      await changeAndPersistLanguage(code);
    } catch {
      // fallback
    }
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <SettingsHeader
        title={t("settings.languageTitle", "Language")}
        subtitle={t("settings.languagePageDesc", "Choose the display language")}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {LANGUAGES.map((l, idx) => (
            <TouchableOpacity
              key={l.code}
              style={[
                styles.listItem,
                idx < LANGUAGES.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
              onPress={() => handleLangChange(l.code)}
              activeOpacity={0.7}
            >
              <Text style={[styles.listItemText, { color: colors.foreground }]}>
                {t(l.labelKey, l.fallback)}
              </Text>
              {lang === l.code && (
                <Text style={[styles.checkPrimary, { color: colors.primary }]}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: 24 },
  listCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  listItemText: { fontSize: fontSize.md },
  checkPrimary: { fontSize: 14 },
});
