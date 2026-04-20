/**
 * BookInfoActionBar — Primary CTA + secondary action buttons
 * Rich shadows, tactile press states
 */
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useColors, spacing, radius, fontSize, fontWeight, withOpacity } from "@/styles/theme";
import { BookOpen, Headphones, Sparkles, MessageCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { Book } from "@readany/core/types";

interface Props {
  book: Book;
  onOpenBook: () => void;
}

export function BookInfoActionBar({ book, onOpenBook }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const progressPct = Math.round(book.progress * 100);

  const ctaLabel =
    book.readingStatus === "finished"
      ? t("bookInfo.reread")
      : book.progress > 0
        ? t("bookInfo.continueReading")
        : t("bookInfo.startReading");

  return (
    <View style={styles.container}>
      {/* Primary CTA with shadow */}
      <Pressable
        onPress={onOpenBook}
        style={({ pressed }) => [
          styles.primaryBtn,
          { backgroundColor: colors.primary, shadowColor: colors.primary },
          pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
        ]}
      >
        <BookOpen size={18} color={colors.primaryForeground} />
        <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>
          {ctaLabel}{progressPct > 0 && progressPct < 100 ? ` · ${progressPct}%` : ""}
        </Text>
      </Pressable>

      {/* Secondary row */}
      <View style={styles.secondaryRow}>
        <Pressable style={({ pressed }) => [
          styles.secBtn,
          { backgroundColor: withOpacity(colors.card, 0.9), borderColor: withOpacity(colors.border, 0.4), shadowColor: colors.foreground },
          pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
        ]}>
          <Headphones size={15} color={colors.foreground} />
          <Text style={[styles.secText, { color: colors.foreground }]}>{t("bookInfo.listenBook")}</Text>
        </Pressable>

        <Pressable
          disabled={!book.isVectorized}
          style={({ pressed }) => [
            styles.secBtn,
            {
              backgroundColor: book.isVectorized ? withOpacity(colors.card, 0.9) : withOpacity(colors.muted, 0.4),
              borderColor: book.isVectorized ? withOpacity(colors.border, 0.4) : withOpacity(colors.border, 0.2),
              shadowColor: colors.foreground,
              opacity: book.isVectorized ? (pressed ? 0.8 : 1) : 0.5,
            },
            pressed && book.isVectorized && { transform: [{ scale: 0.97 }] },
          ]}
        >
          {book.isVectorized ? (
            <Sparkles size={15} color="#f59e0b" />
          ) : (
            <MessageCircle size={15} color={colors.mutedForeground} />
          )}
          <Text style={[styles.secText, { color: book.isVectorized ? colors.foreground : colors.mutedForeground }]}>
            {t("bookInfo.askAI")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, borderRadius: radius.xl, paddingVertical: 14,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
  primaryText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  secondaryRow: { flexDirection: "row", gap: spacing.sm },
  secBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.xs, borderWidth: 1, borderRadius: radius.xl, paddingVertical: 10,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  secText: { fontSize: fontSize.sm },
});
