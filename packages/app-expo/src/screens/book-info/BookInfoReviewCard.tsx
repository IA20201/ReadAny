/**
 * BookInfoReviewCard — Short review with accent border, elevated card
 */
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useColors, spacing, radius, fontSize, fontWeight, withOpacity } from "@/styles/theme";
import { Quote } from "lucide-react-native";
import { useTranslation } from "react-i18next";

interface Props {
  review?: string;
  onPress: () => void;
}

export function BookInfoReviewCard({ review, onPress }: Props) {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: withOpacity(colors.card, 0.9),
          borderColor: withOpacity(colors.border, 0.35),
          borderLeftColor: review ? colors.primary : withOpacity(colors.primary, 0.3),
          shadowColor: colors.foreground,
        },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}
    >
      {/* Quote icon bubble */}
      <View style={[styles.iconBubble, { backgroundColor: withOpacity(colors.primary, 0.08) }]}>
        <Quote size={14} color={withOpacity(colors.primary, 0.5)} />
      </View>
      <View style={styles.textCol}>
        <Text
          style={[
            styles.text,
            { color: review ? colors.foreground : withOpacity(colors.mutedForeground, 0.4) },
          ]}
          numberOfLines={2}
        >
          {review ? `\u201C${review}\u201D` : t("bookInfo.shortReviewPlaceholder")}
        </Text>
        {!review && (
          <Text style={[styles.hint, { color: withOpacity(colors.mutedForeground, 0.3) }]}>
            {t("bookInfo.shortReview")}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderLeftWidth: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  iconBubble: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
    marginTop: 1,
  },
  textCol: { flex: 1 },
  text: { fontSize: fontSize.sm, fontStyle: "italic", lineHeight: 20 },
  hint: { fontSize: 10, marginTop: 4 },
});
