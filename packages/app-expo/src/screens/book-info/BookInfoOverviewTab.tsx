/**
 * BookInfoOverviewTab — 概览: 书评 + 标签 + 描述 + 文件信息
 */
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { useColors, spacing, radius, fontSize, fontWeight, withOpacity } from "@/styles/theme";
import { useLibraryStore } from "@/stores/library-store";
import type { Book } from "@readany/core/types";
import {
  BookOpen, Calendar, CalendarPlus, Clock, Database, FileText,
  Globe, Hash, Layers, Plus, Quote, Tag, X,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  book: Book;
  isEditing: boolean;
  onReviewPress: () => void;
}

export function BookInfoOverviewTab({ book, isEditing, onReviewPress }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const updateBook = useLibraryStore((s) => s.updateBook);
  const meta = book.meta;

  // Tag management
  const [newTag, setNewTag] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);

  const handleAddTag = useCallback(() => {
    const trimmed = newTag.trim();
    if (trimmed && !book.tags.includes(trimmed)) {
      updateBook(book.id, { tags: [...book.tags, trimmed] } as Partial<Book>);
    }
    setNewTag(""); setIsAddingTag(false);
  }, [book.id, book.tags, newTag, updateBook]);

  const handleRemoveTag = useCallback((tag: string) => {
    updateBook(book.id, { tags: book.tags.filter((t) => t !== tag) } as Partial<Book>);
  }, [book.id, book.tags, updateBook]);

  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  // File info items
  const details: { icon: typeof FileText; label: string; value: string; color: string }[] = [
    { icon: FileText, label: t("bookInfo.format"), value: book.format.toUpperCase(), color: "#3b82f6" },
  ];
  if (meta.language) details.push({ icon: Globe, label: t("bookInfo.language"), value: meta.language, color: "#8b5cf6" });
  if (meta.publisher) details.push({ icon: BookOpen, label: t("bookInfo.publisher"), value: meta.publisher, color: "#06b6d4" });
  if (meta.totalPages) details.push({ icon: Layers, label: t("bookInfo.pages"), value: `${meta.totalPages}`, color: "#10b981" });
  if (meta.isbn) details.push({ icon: Hash, label: t("bookInfo.isbn"), value: meta.isbn, color: "#6366f1" });
  if (meta.publishDate) details.push({ icon: Calendar, label: t("bookInfo.publishDate"), value: meta.publishDate, color: "#f97316" });
  details.push({ icon: CalendarPlus, label: t("bookInfo.addedAt"), value: fmtDate(book.addedAt), color: "#f59e0b" });
  if (book.lastOpenedAt) details.push({ icon: Clock, label: t("bookInfo.lastOpened"), value: fmtDate(book.lastOpenedAt), color: "#ef4444" });
  if (book.isVectorized) details.push({ icon: Database, label: "AI", value: t("bookInfo.vectorized"), color: "#10b981" });

  return (
    <View style={styles.container}>
      {/* ─ Short Review Card ─ */}
      <Pressable
        onPress={onReviewPress}
        style={({ pressed }) => [
          styles.reviewCard,
          { backgroundColor: withOpacity(colors.card, 0.9), borderColor: withOpacity(colors.border, 0.35), borderLeftColor: book.shortReview ? colors.primary : withOpacity(colors.primary, 0.3), shadowColor: colors.foreground },
          pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        ]}
      >
        <View style={[styles.reviewIcon, { backgroundColor: withOpacity(colors.primary, 0.08) }]}>
          <Quote size={13} color={withOpacity(colors.primary, 0.5)} />
        </View>
        <Text
          style={[styles.reviewText, { color: book.shortReview ? colors.foreground : withOpacity(colors.mutedForeground, 0.4) }]}
          numberOfLines={2}
        >
          {book.shortReview ? `\u201C${book.shortReview}\u201D` : t("bookInfo.shortReviewPlaceholder")}
        </Text>
      </Pressable>

      {/* ─ Tags ─ */}
      <Section title={t("bookInfo.subjects")} colors={colors}>
        <View style={styles.tagsRow}>
          {book.tags.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: withOpacity(colors.primary, 0.12), borderColor: withOpacity(colors.primary, 0.15) }]}>
              <Tag size={10} color={colors.primary} />
              <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
              {isEditing && (
                <Pressable onPress={() => handleRemoveTag(tag)} hitSlop={8}>
                  <View style={[styles.tagX, { backgroundColor: withOpacity(colors.primary, 0.15) }]}>
                    <X size={8} color={colors.primary} />
                  </View>
                </Pressable>
              )}
            </View>
          ))}
          {meta.subjects?.filter((s) => !book.tags.includes(s)).map((subj) => (
            <View key={subj} style={[styles.tag, { backgroundColor: withOpacity(colors.muted, 0.5) }]}>
              <Text style={[styles.tagText, { color: colors.mutedForeground }]}>{subj}</Text>
            </View>
          ))}
          {isAddingTag ? (
            <View style={[styles.tagInputWrap, { borderColor: withOpacity(colors.primary, 0.3) }]}>
              <TextInput
                value={newTag} onChangeText={setNewTag} onSubmitEditing={handleAddTag}
                onBlur={() => { if (!newTag.trim()) setIsAddingTag(false); }}
                placeholder={t("bookInfo.tagPlaceholder")}
                placeholderTextColor={withOpacity(colors.mutedForeground, 0.4)}
                style={[styles.tagInputText, { color: colors.foreground }]}
                autoFocus returnKeyType="done"
              />
            </View>
          ) : (
            <Pressable onPress={() => setIsAddingTag(true)} style={[styles.addBtn, { borderColor: withOpacity(colors.primary, 0.3), backgroundColor: withOpacity(colors.primary, 0.04) }]}>
              <Plus size={10} color={colors.primary} />
              <Text style={[styles.addBtnText, { color: colors.primary }]}>{t("bookInfo.addTag")}</Text>
            </Pressable>
          )}
        </View>
      </Section>

      {/* ─ Description ─ */}
      {meta.description ? (
        <Section title={t("bookInfo.description")} colors={colors}>
          <ExpandableText text={meta.description} colors={colors} />
        </Section>
      ) : null}

      {/* ─ File Info ─ */}
      <Section title={t("bookInfo.fileInfo")} colors={colors}>
        <View style={styles.detailsGrid}>
          {details.map((d) => {
            const Icon = d.icon;
            return (
              <View key={d.label} style={[styles.detailCard, { backgroundColor: withOpacity(colors.card, 0.9), borderColor: withOpacity(colors.border, 0.3), shadowColor: colors.foreground }]}>
                <View style={[styles.detailBubble, { backgroundColor: withOpacity(d.color, 0.08) }]}>
                  <Icon size={12} color={d.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailLabel, { color: withOpacity(colors.mutedForeground, 0.6) }]}>{d.label}</Text>
                  <Text style={[styles.detailValue, { color: colors.foreground }]} numberOfLines={1}>{d.value}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </Section>

      {/* ─ Sync ─ */}
      <View style={[styles.syncRow, { backgroundColor: withOpacity(colors.muted, 0.12) }]}>
        <View style={[styles.syncDot, { backgroundColor: book.syncStatus === "local" ? "#10b981" : book.syncStatus === "remote" ? "#3b82f6" : "#f59e0b" }]} />
        <Text style={[styles.syncText, { color: withOpacity(colors.mutedForeground, 0.7) }]}>
          {book.syncStatus === "local" ? t("bookInfo.syncLocal") : book.syncStatus === "remote" ? t("bookInfo.syncRemote") : "Syncing..."}
        </Text>
        {book.fileHash ? <Text style={[styles.syncHash, { color: withOpacity(colors.mutedForeground, 0.3) }]}>{book.fileHash.slice(0, 8)}</Text> : null}
      </View>
    </View>
  );
}

/* ─── Helpers ─── */

type C = ReturnType<typeof useColors>;

function Section({ title, colors, children }: { title: string; colors: C; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: withOpacity(colors.mutedForeground, 0.6) }]}>{title}</Text>
      {children}
    </View>
  );
}

function ExpandableText({ text, colors }: { text: string; colors: C }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const needsExpand = text.length > 200;
  return (
    <View style={[styles.descCard, { backgroundColor: withOpacity(colors.card, 0.5), borderColor: withOpacity(colors.border, 0.2) }]}>
      <Text style={[styles.descText, { color: colors.mutedForeground }]} numberOfLines={expanded ? undefined : 4}>{text}</Text>
      {needsExpand && (
        <Pressable onPress={() => setExpanded(!expanded)}>
          <Text style={[styles.expandBtn, { color: colors.primary }]}>{expanded ? t("bookInfo.collapse") : t("bookInfo.expand")}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xl },

  // Review card
  reviewCard: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.xl, borderWidth: 1, borderLeftWidth: 3,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  reviewIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 1 },
  reviewText: { flex: 1, fontSize: fontSize.sm, fontStyle: "italic", lineHeight: 20 },

  // Section
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 },

  // Tags
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 0.5 },
  tagText: { fontSize: 11, fontWeight: fontWeight.medium },
  tagX: { width: 14, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center", marginLeft: 2 },
  tagInputWrap: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 2 },
  tagInputText: { fontSize: 11, minWidth: 80, paddingVertical: 3 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1, borderStyle: "dashed" },
  addBtnText: { fontSize: 11, fontWeight: fontWeight.medium },

  // Description
  descCard: { borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  descText: { fontSize: fontSize.sm, lineHeight: 22 },
  expandBtn: { fontSize: 12, fontWeight: fontWeight.medium, marginTop: spacing.xs },

  // Details
  detailsGrid: { gap: spacing.sm },
  detailCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    borderWidth: 1, borderRadius: radius.xl,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  detailBubble: { width: 28, height: 28, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  detailLabel: { fontSize: 9, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: fontSize.sm, marginTop: 1 },

  // Sync
  syncRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  syncDot: { width: 6, height: 6, borderRadius: radius.full },
  syncText: { fontSize: 10, flex: 1 },
  syncHash: { fontSize: 9, fontFamily: "monospace" },
});
