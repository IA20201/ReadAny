/**
 * BookInfoDescription — Expandable description with subtle card treatment
 */
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useColors, spacing, radius, fontSize, fontWeight, withOpacity } from "@/styles/theme";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  description: string;
}

export function BookInfoDescription({ description }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const needsExpand = description.length > 200;

  return (
    <View style={styles.container}>
      <Text style={[styles.header, { color: colors.mutedForeground }]}>{t("bookInfo.description")}</Text>
      <View style={[styles.card, { backgroundColor: withOpacity(colors.card, 0.5), borderColor: withOpacity(colors.border, 0.2) }]}>
        <Text
          style={[styles.text, { color: colors.mutedForeground }]}
          numberOfLines={expanded ? undefined : 4}
        >
          {description}
        </Text>
        {needsExpand && (
          <Pressable onPress={() => setExpanded(!expanded)} style={styles.expandRow}>
            <Text style={[styles.expandBtn, { color: colors.primary }]}>
              {expanded ? t("bookInfo.collapse") : t("bookInfo.expand")}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg },
  header: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing.sm },
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  text: { fontSize: fontSize.sm, lineHeight: 22 },
  expandRow: { marginTop: spacing.xs },
  expandBtn: { fontSize: 12, fontWeight: fontWeight.medium },
});
