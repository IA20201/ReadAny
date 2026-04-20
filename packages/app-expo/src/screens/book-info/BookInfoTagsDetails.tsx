/**
 * BookInfoTagsDetails — Tags management + file metadata
 * Elevated cards, colored icon bubbles, semantic styling
 */
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { useColors, spacing, radius, fontSize, fontWeight, withOpacity } from "@/styles/theme";
import { useLibraryStore } from "@/stores/library-store";
import type { Book } from "@readany/core/types";
import { Calendar, CalendarPlus, Clock, Database, FileText, Globe, Hash, Layers, Plus, Tag, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  book: Book;
  isEditing: boolean;
}

export function BookInfoTagsDetails({ book, isEditing }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const updateBook = useLibraryStore((s) => s.updateBook);
  const meta = book.meta;

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

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  // Detail items with semantic icon colors
  const details: { icon: typeof FileText; label: string; value: string; color: string }[] = [
    { icon: FileText, label: t("bookInfo.format"), value: book.format.toUpperCase(), color: "#3b82f6" },
  ];
  if (meta.language) details.push({ icon: Globe, label: t("bookInfo.language"), value: meta.language, color: "#8b5cf6" });
  if (meta.totalPages) details.push({ icon: Layers, label: t("bookInfo.pages"), value: `${meta.totalPages}`, color: "#10b981" });
  if (meta.isbn) details.push({ icon: Hash, label: t("bookInfo.isbn"), value: meta.isbn, color: "#6366f1" });
  details.push({ icon: CalendarPlus, label: t("bookInfo.addedAt"), value: formatDate(book.addedAt), color: "#f59e0b" });
  if (book.lastOpenedAt) details.push({ icon: Clock, label: t("bookInfo.lastOpened"), value: formatDate(book.lastOpenedAt), color: "#ef4444" });
  if (book.isVectorized) details.push({ icon: Database, label: "AI", value: t("bookInfo.vectorized"), color: "#10b981" });

  return (
    <View style={styles.container}>
      {/* ─ Tags ─ */}
      <View style={styles.section}>
        <Text style={[styles.header, { color: colors.mutedForeground }]}>{t("bookInfo.subjects")}</Text>
        <View style={styles.tagsRow}>
          {book.tags.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: withOpacity(colors.primary, 0.12), borderColor: withOpacity(colors.primary, 0.15) }]}>
              <Tag size={10} color={colors.primary} />
              <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
              {isEditing && (
                <Pressable onPress={() => handleRemoveTag(tag)} hitSlop={8}>
                  <View style={[styles.tagRemoveBg, { backgroundColor: withOpacity(colors.primary, 0.15) }]}>
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
            <View style={[styles.tagInputWrap, { backgroundColor: withOpacity(colors.primary, 0.05), borderColor: withOpacity(colors.primary, 0.3) }]}>
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
      </View>

      {/* ─ File Details ─ */}
      <View style={styles.section}>
        <Text style={[styles.header, { color: colors.mutedForeground }]}>{t("bookInfo.fileInfo")}</Text>
        <View style={styles.detailsGrid}>
          {details.map((d) => {
            const Icon = d.icon;
            return (
              <View key={d.label} style={[styles.detailCard, { backgroundColor: withOpacity(colors.card, 0.9), borderColor: withOpacity(colors.border, 0.3), shadowColor: colors.foreground }]}>
                <View style={[styles.detailIconBubble, { backgroundColor: withOpacity(d.color, 0.08) }]}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  section: {},
  header: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing.sm },

  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 0.5 },
  tagText: { fontSize: 11, fontWeight: fontWeight.medium },
  tagRemoveBg: { width: 14, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center", marginLeft: 2 },
  tagInputWrap: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 2 },
  tagInputText: { fontSize: 11, minWidth: 80, paddingVertical: 3 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1, borderStyle: "dashed" },
  addBtnText: { fontSize: 11, fontWeight: fontWeight.medium },

  detailsGrid: { gap: spacing.sm },
  detailCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    borderWidth: 1, borderRadius: radius.xl,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  detailIconBubble: { width: 28, height: 28, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  detailLabel: { fontSize: 9, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: fontSize.sm, marginTop: 1 },
});
