/**
 * BookCard — Touch-optimized book card matching Tauri mobile MobileBookCard exactly.
 * Cover (28:41), progress bar, vectorization overlay, tag badges, long-press action sheet.
 */
import type { Book } from "@readany/core/types";
import { getPlatformService } from "@readany/core/services";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  Pressable,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { type ThemeColors, radius, fontSize, fontWeight, useColors } from "@/styles/theme";
import { HashIcon, DatabaseIcon, Trash2Icon, LoaderIcon } from "@/components/ui/Icon";

const SCREEN_PADDING = 16;
const NUM_COLUMNS = 3;
const GRID_GAP = 12;
const screenWidth = Dimensions.get("window").width;
const coverWidth = (screenWidth - SCREEN_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const coverHeight = coverWidth * (41 / 28);

interface BookCardProps {
  book: Book;
  onOpen: (book: Book) => void;
  onDelete: (bookId: string) => void;
  onManageTags?: (book: Book) => void;
  onVectorize?: (book: Book) => void;
  isVectorizing?: boolean;
  vectorProgress?: { status: string; processedChunks: number; totalChunks: number } | null;
}

export const BookCard = memo(function BookCard({
  book,
  onOpen,
  onDelete,
  onManageTags,
  onVectorize,
  isVectorizing,
  vectorProgress,
}: BookCardProps) {
  const colors = useColors();
  const s = makeStyles(colors);
  const { t } = useTranslation();
  const [imageError, setImageError] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [resolvedCoverUrl, setResolvedCoverUrl] = useState<string | undefined>(undefined);

  // Resolve relative coverUrl to absolute path
  useEffect(() => {
    const raw = book.meta.coverUrl;
    if (!raw) {
      setResolvedCoverUrl(undefined);
      return;
    }
    if (raw.startsWith("http") || raw.startsWith("blob") || raw.startsWith("file")) {
      setResolvedCoverUrl(raw);
      return;
    }
    (async () => {
      try {
        const platform = getPlatformService();
        const appData = await platform.getAppDataDir();
        const absPath = await platform.joinPath(appData, raw);
        setResolvedCoverUrl(absPath);
      } catch {
        setResolvedCoverUrl(undefined);
      }
    })();
  }, [book.meta.coverUrl]);

  const progressPct = Math.round(book.progress * 100);
  const hasCover = resolvedCoverUrl && !imageError;

  const vecPct = vectorProgress
    ? vectorProgress.totalChunks > 0
      ? Math.round((vectorProgress.processedChunks / vectorProgress.totalChunks) * 100)
      : 0
    : 0;

  return (
    <>
      <TouchableOpacity
        style={s.container}
        onPress={() => onOpen(book)}
        onLongPress={() => setShowActions(true)}
        delayLongPress={500}
        activeOpacity={0.7}
      >
        {/* Cover — 28:41 aspect ratio */}
        <View style={s.coverWrap}>
          {resolvedCoverUrl && !imageError ? (
            <Image
              source={{ uri: resolvedCoverUrl }}
              style={s.coverImage}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={s.fallbackCover}>
              <View style={s.fallbackTitleWrap}>
                <Text style={s.fallbackTitle} numberOfLines={3}>
                  {book.meta.title}
                </Text>
              </View>
              <View style={s.fallbackDivider} />
              {book.meta.author ? (
                <View style={s.fallbackAuthorWrap}>
                  <Text style={s.fallbackAuthor} numberOfLines={1}>
                    {book.meta.author}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Progress bar */}
          {progressPct > 0 && progressPct < 100 && (
            <View style={s.progressBarBg}>
              <View style={[s.progressBarFill, { width: `${progressPct}%` }]} />
            </View>
          )}

          {/* Vectorization progress overlay */}
          {isVectorizing && (
            <View style={s.vecOverlay}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={s.vecOverlayText}>
                {vectorProgress?.status === "chunking"
                  ? t("home.vec_chunking", "分块中")
                  : vectorProgress?.status === "embedding"
                    ? `${vecPct}%`
                    : vectorProgress?.status === "indexing"
                      ? t("home.vec_indexing", "索引中")
                      : t("home.vec_processing", "处理中")}
              </Text>
            </View>
          )}

          {/* Vectorized badge */}
          {book.isVectorized && !isVectorizing && (
            <View style={s.vecBadge}>
              <DatabaseIcon size={8} color="#fff" />
              <Text style={s.vecBadgeText}>{t("home.vec_indexed", "已索引")}</Text>
            </View>
          )}
        </View>

        {/* Info below cover */}
        <View style={s.infoWrap}>
          <Text style={s.bookTitle} numberOfLines={1}>
            {book.meta.title}
          </Text>

          {/* Tag badges */}
          {book.tags.length > 0 ? (
            <View style={s.tagsRow}>
              {book.tags.slice(0, 2).map((tag) => (
                <View key={tag} style={s.tagBadge}>
                  <Text style={s.tagText}>{tag}</Text>
                </View>
              ))}
              {book.tags.length > 2 && (
                <Text style={s.tagOverflow}>+{book.tags.length - 2}</Text>
              )}
            </View>
          ) : (
            <View style={s.tagsRow}>
              <View style={s.tagBadgeUncategorized}>
                <Text style={s.tagTextUncategorized}>{t("sidebar.uncategorized", "未分类")}</Text>
              </View>
            </View>
          )}

          {/* Status row */}
          <View style={s.statusRow}>
            {progressPct > 0 && progressPct < 100 ? (
              <Text style={s.progressText}>{progressPct}%</Text>
            ) : progressPct >= 100 ? (
              <Text style={s.completeText}>{t("home.complete", "已完成")}</Text>
            ) : (
              <View style={s.newBadge}>
                <Text style={s.newText}>{t("home.new", "新")}</Text>
              </View>
            )}
            <Text style={s.formatText}>{book.format || "epub"}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Action Sheet (long-press menu) — matches Tauri exactly */}
      <Modal visible={showActions} transparent animationType="slide" onRequestClose={() => setShowActions(false)}>
        <Pressable style={s.overlay} onPress={() => setShowActions(false)} />
        <View style={s.actionSheet}>
          {/* Handle bar */}
          <View style={s.actionHandle} />

          {/* Book info header */}
          <View style={s.actionHeader}>
            <Text style={s.actionTitle} numberOfLines={1}>{book.meta.title}</Text>
            {book.meta.author ? <Text style={s.actionAuthor}>{book.meta.author}</Text> : null}
          </View>
          <View style={s.actionDivider} />

          {/* Manage tags */}
          {onManageTags && (
            <TouchableOpacity
              style={s.actionItem}
              onPress={() => { setShowActions(false); onManageTags(book); }}
            >
              <HashIcon size={20} color={colors.mutedForeground} />
              <Text style={s.actionLabel}>{t("home.manageTags", "管理标签")}</Text>
            </TouchableOpacity>
          )}

          {/* Vectorize */}
          {onVectorize && (
            <TouchableOpacity
              style={s.actionItem}
              onPress={() => { setShowActions(false); onVectorize(book); }}
            >
              <DatabaseIcon size={20} color={colors.mutedForeground} />
              <Text style={s.actionLabel}>
                {book.isVectorized ? t("home.vec_reindex", "重新索引") : t("home.vec_vectorize", "向量化")}
              </Text>
            </TouchableOpacity>
          )}

          {/* Delete */}
          <TouchableOpacity
            style={s.actionItemDestructive}
            onPress={() => { setShowActions(false); onDelete(book.id); }}
          >
            <Trash2Icon size={20} color={colors.destructive} />
            <Text style={s.actionLabelDestructive}>{t("common.remove", "删除")}</Text>
          </TouchableOpacity>

          <View style={s.actionDivider} />
          {/* Cancel */}
          <TouchableOpacity style={s.actionCancel} onPress={() => setShowActions(false)}>
            <Text style={s.actionCancelText}>{t("common.cancel", "取消")}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
});

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { width: coverWidth },
  coverWrap: {
    width: coverWidth,
    height: coverHeight,
    borderRadius: radius.sm,
    overflow: "hidden",
    position: "relative",
  },
  coverImage: {
    width: "100%",
    height: "100%",
    borderRadius: radius.sm,
  },
  fallbackCover: {
    flex: 1,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.stone200,
    borderRadius: radius.sm,
  },
  fallbackTitleWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackTitle: {
    textAlign: "center",
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.stone500,
    lineHeight: 16,
  },
  fallbackDivider: {
    width: 24,
    height: 1,
    backgroundColor: "rgba(168,162,158,0.4)",
    marginVertical: 4,
  },
  fallbackAuthorWrap: {
    height: "25%",
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackAuthor: {
    textAlign: "center",
    fontSize: 8,
    color: colors.stone400,
  },
  progressBarBg: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  progressBarFill: {
    height: 2,
    backgroundColor: colors.primary,
    opacity: 0.8,
  },
  // Vectorization overlay
  vecOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  vecOverlayText: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: fontWeight.medium,
    color: "#fff",
  },
  vecBadge: {
    position: "absolute",
    top: 2,
    left: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(22,163,74,0.8)",
    borderRadius: radius.sm,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  vecBadgeText: { fontSize: 7, fontWeight: fontWeight.medium, color: "#fff" },
  infoWrap: { paddingTop: 6 },
  bookTitle: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.foreground,
    lineHeight: 14,
  },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 2, marginTop: 2 },
  tagBadge: {
    backgroundColor: "rgba(245,245,244,0.1)",
    borderRadius: radius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tagText: { fontSize: 8, color: colors.mutedForeground },
  tagBadgeUncategorized: {
    backgroundColor: "rgba(245,245,244,0.05)",
    borderRadius: radius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tagTextUncategorized: { fontSize: 8, color: "rgba(124,124,130,0.6)" },
  tagOverflow: { fontSize: 8, color: "rgba(124,124,130,0.6)" },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    minHeight: 12,
  },
  progressText: { fontSize: 9, color: colors.mutedForeground, fontVariant: ["tabular-nums"] },
  completeText: { fontSize: 9, fontWeight: fontWeight.medium, color: "#16a34a" },
  newBadge: {
    backgroundColor: "rgba(224,224,230,0.08)",
    borderRadius: radius.full,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  newText: { fontSize: 8, fontWeight: fontWeight.medium, color: colors.primary },
  formatText: {
    fontSize: 8,
    color: "rgba(124,124,130,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Action Sheet
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  actionSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  actionHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.muted,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  actionHeader: { paddingHorizontal: 20, paddingBottom: 12 },
  actionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.foreground },
  actionAuthor: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },
  actionDivider: { height: 0.5, backgroundColor: colors.border },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  actionLabel: { fontSize: fontSize.base, color: colors.foreground },
  actionItemDestructive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  actionLabelDestructive: { fontSize: fontSize.base, color: colors.destructive },
  actionCancel: {
    alignItems: "center",
    paddingVertical: 14,
  },
  actionCancelText: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.foreground },
});
