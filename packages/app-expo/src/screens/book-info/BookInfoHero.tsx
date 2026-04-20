/**
 * BookInfoHero — Horizontal layout: Cover left + metadata right
 * Rich blurred background, deep shadows, visual depth
 */
import { View, Text, StyleSheet, Image, Pressable } from "react-native";
import { useColors, spacing, radius, fontSize, fontWeight, withOpacity } from "@/styles/theme";
import type { Book, ReadingStatus } from "@readany/core/types";
import { Camera, Pencil } from "lucide-react-native";
import { MobileStarRating } from "./MobileStarRating";
import { MobileStatusPill } from "./MobileStatusPill";
import { useTranslation } from "react-i18next";

interface Props {
  book: Book;
  resolvedCoverUrl?: string;
  isEditing: boolean;
  onCoverPress: () => void;
  onTitlePress: () => void;
  onStatusChange: (status: ReadingStatus) => void;
  onRatingChange: (rating: number | undefined) => void;
}

export function BookInfoHero({
  book, resolvedCoverUrl, isEditing,
  onCoverPress, onTitlePress, onStatusChange, onRatingChange,
}: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const progressPct = Math.round(book.progress * 100);

  return (
    <View style={styles.container}>
      {/* ─ Blurred cover background ─ */}
      {resolvedCoverUrl ? (
        <Image
          source={{ uri: resolvedCoverUrl }}
          style={[styles.bgImage, { opacity: 0.25 }]}
          blurRadius={30}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.bgImage, { backgroundColor: withOpacity(colors.muted, 0.5) }]} />
      )}
      {/* Gradient fade to background */}
      <View style={[styles.bgGradientTop, { backgroundColor: colors.background }]} />
      <View style={[styles.bgGradientBottom, { backgroundColor: colors.background }]} />

      {/* ─ Horizontal: Cover + Info ─ */}
      <View style={styles.content}>
        {/* Cover with deep shadow */}
        <Pressable
          onPress={isEditing ? onCoverPress : undefined}
          disabled={!isEditing}
          style={({ pressed }) => [styles.coverWrap, pressed && isEditing && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
        >
          <View style={[styles.coverOuter, { shadowColor: colors.foreground }]}>
            <View style={styles.coverInner}>
              {resolvedCoverUrl ? (
                <Image source={{ uri: resolvedCoverUrl }} style={styles.coverImg} resizeMode="cover" />
              ) : (
                <View style={[styles.coverImg, { backgroundColor: withOpacity(colors.muted, 0.8) }]}>
                  {/* Decorative lines + title */}
                  <View style={[styles.fallbackLine, { backgroundColor: withOpacity(colors.foreground, 0.1) }]} />
                  <Text style={[styles.coverFallback, { color: withOpacity(colors.foreground, 0.7) }]} numberOfLines={3}>
                    {book.meta.title}
                  </Text>
                  {book.meta.author ? (
                    <Text style={[styles.fallbackAuthor, { color: withOpacity(colors.foreground, 0.4) }]} numberOfLines={1}>
                      {book.meta.author}
                    </Text>
                  ) : null}
                  <View style={[styles.fallbackLine, { backgroundColor: withOpacity(colors.foreground, 0.1) }]} />
                </View>
              )}
              {/* Top shine reflection */}
              <View style={styles.coverShine} />
            </View>
          </View>
          {/* Edit mode overlay */}
          {isEditing && (
            <View style={styles.coverEditOverlay}>
              <View style={[styles.coverEditBubble, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
                <Camera size={18} color="#fff" />
              </View>
              <Text style={styles.coverEditHint}>{t("bookInfo.changeCover")}</Text>
            </View>
          )}
        </Pressable>

        {/* Right info column */}
        <View style={styles.infoCol}>
          {/* Title + Author */}
          <Pressable
            onPress={isEditing ? onTitlePress : undefined}
            disabled={!isEditing}
            style={({ pressed }) => [pressed && isEditing && { opacity: 0.7 }]}
          >
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
                {book.meta.title}
              </Text>
              {isEditing && (
                <View style={[styles.editHint, { backgroundColor: withOpacity(colors.primary, 0.1) }]}>
                  <Pencil size={10} color={colors.primary} />
                </View>
              )}
            </View>
            {book.meta.author ? (
              <Text style={[styles.author, { color: colors.mutedForeground }]} numberOfLines={1}>
                {book.meta.author}
              </Text>
            ) : null}
          </Pressable>

          {/* Rating — always interactive */}
          <MobileStarRating value={book.rating} onChange={onRatingChange} size={16} />

          {/* Status — always interactive */}
          <MobileStatusPill status={book.readingStatus} onChange={onStatusChange} />
        </View>
      </View>

      {/* ─ Progress bar ─ */}
      {progressPct > 0 && (
        <View style={styles.progressWrap}>
          <View style={[styles.progressTrack, { backgroundColor: withOpacity(colors.muted, 0.6) }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progressPct}%` as `${number}%` }]} />
          </View>
          <Text style={[styles.progressLabel, { color: colors.foreground }]}>{progressPct}%</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative", overflow: "hidden", paddingBottom: spacing.md },
  bgImage: { position: "absolute", top: -20, left: -20, right: -20, height: 320 },
  bgGradientTop: { position: "absolute", top: 0, left: 0, right: 0, height: 60, opacity: 0.6 },
  bgGradientBottom: { position: "absolute", top: 160, left: 0, right: 0, height: 160, opacity: 0.85 },

  content: { flexDirection: "row", paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: 16 },

  coverWrap: { position: "relative" },
  coverOuter: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
    borderRadius: 6,
  },
  coverInner: { borderRadius: 6, overflow: "hidden" },
  coverImg: { width: 120, height: 176 },
  coverShine: {
    position: "absolute", top: 0, left: 0, right: 0, height: 50,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  coverFallback: {
    fontSize: 13, fontWeight: fontWeight.semibold, textAlign: "center",
    paddingHorizontal: spacing.md, lineHeight: 18,
  },
  fallbackAuthor: { fontSize: 9, textAlign: "center", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  fallbackLine: { width: 40, height: 1, alignSelf: "center", marginVertical: spacing.sm },
  coverEditOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 6, backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center", justifyContent: "center", gap: 6,
  },
  coverEditBubble: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  coverEditHint: { fontSize: 10, color: "rgba(255,255,255,0.8)", fontWeight: "500" },

  infoCol: { flex: 1, paddingTop: 2, gap: 10 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  title: { fontSize: 18, fontWeight: "700", lineHeight: 24, flex: 1 },
  editHint: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 2 },
  author: { fontSize: fontSize.sm, marginTop: 1 },

  progressWrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.sm },
  progressTrack: { flex: 1, height: 6, borderRadius: radius.full, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: radius.full },
  progressLabel: { fontSize: 11, fontWeight: "700", width: 34, textAlign: "right" },
});
