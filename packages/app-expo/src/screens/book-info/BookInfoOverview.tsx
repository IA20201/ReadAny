/**
 * BookInfoOverview — Mobile overview tab (description, tags, file info)
 * Rich metadata display with visual hierarchy + tag management
 */
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { useColors, spacing, radius, fontSize, fontWeight, withOpacity } from "@/styles/theme";
import { useLibraryStore } from "@/stores/library-store";
import type { Book } from "@readany/core/types";
import { FileText, BookOpen, Globe, Hash, Database, Tag, Calendar, CalendarPlus, Clock, Layers, Plus, X } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  book: Book;
}

export function BookInfoOverview({ book }: Props) {
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
    setNewTag("");
    setIsAddingTag(false);
  }, [book.id, book.tags, newTag, updateBook]);

  const handleRemoveTag = useCallback((tag: string) => {
    updateBook(book.id, { tags: book.tags.filter((t) => t !== tag) } as Partial<Book>);
  }, [book.id, book.tags, updateBook]);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <View style={styles.container}>
      {/* Description */}
      {meta.description ? (
        <Section title={t("bookInfo.description")} colors={colors}>
          <ExpandableText text={meta.description} colors={colors} />
        </Section>
      ) : null}

      {/* Tags & Subjects — with management */}
      <Section title={t("bookInfo.subjects")} colors={colors}>
        <View style={styles.tagsRow}>
          {book.tags.map((tag) => (
            <View key={`t-${tag}`} style={[styles.tagPrimary, { backgroundColor: withOpacity(colors.primary, 0.08) }]}>
              <Tag size={10} color={colors.primary} />
              <Text style={[styles.tagPrimaryText, { color: colors.primary }]}>{tag}</Text>
              <Pressable onPress={() => handleRemoveTag(tag)} hitSlop={8}>
                <X size={10} color={withOpacity(colors.primary, 0.6)} />
              </Pressable>
            </View>
          ))}
          {meta.subjects?.filter((s) => !book.tags.includes(s)).map((subj) => (
            <View key={`s-${subj}`} style={[styles.tag, { backgroundColor: withOpacity(colors.muted, 0.5) }]}>
              <Text style={[styles.tagText, { color: colors.mutedForeground }]}>{subj}</Text>
            </View>
          ))}
          {/* Add tag */}
          {isAddingTag ? (
            <View style={[styles.tagInput, { backgroundColor: withOpacity(colors.primary, 0.05), borderColor: withOpacity(colors.primary, 0.3) }]}>
              <TextInput
                value={newTag}
                onChangeText={setNewTag}
                onSubmitEditing={handleAddTag}
                onBlur={() => { if (!newTag.trim()) setIsAddingTag(false); }}
                placeholder={t("bookInfo.tagPlaceholder")}
                placeholderTextColor={withOpacity(colors.mutedForeground, 0.5)}
                style={[styles.tagInputText, { color: colors.foreground }]}
                autoFocus
                returnKeyType="done"
              />
            </View>
          ) : (
            <Pressable
              onPress={() => setIsAddingTag(true)}
              style={[styles.addTagBtn, { borderColor: withOpacity(colors.border, 0.5) }]}
            >
              <Plus size={10} color={colors.mutedForeground} />
              <Text style={[styles.addTagText, { color: colors.mutedForeground }]}>{t("bookInfo.addTag")}</Text>
            </Pressable>
          )}
        </View>
      </Section>

      {/* File Info */}
      <Section title={t("bookInfo.fileInfo")} colors={colors}>
        <View style={styles.infoGrid}>
          <InfoCard icon={FileText} label={t("bookInfo.format")} value={book.format.toUpperCase()} colors={colors} />
          {meta.publisher ? <InfoCard icon={BookOpen} label={t("bookInfo.publisher")} value={meta.publisher} colors={colors} /> : null}
          {meta.language ? <InfoCard icon={Globe} label={t("bookInfo.language")} value={meta.language} colors={colors} /> : null}
          {meta.isbn ? <InfoCard icon={Hash} label={t("bookInfo.isbn")} value={meta.isbn} colors={colors} /> : null}
          {meta.publishDate ? <InfoCard icon={Calendar} label={t("bookInfo.publishDate")} value={meta.publishDate} colors={colors} /> : null}
          {meta.totalPages ? <InfoCard icon={Layers} label={t("bookInfo.pages")} value={`${meta.totalPages}`} colors={colors} /> : null}
          {meta.totalChapters ? <InfoCard icon={BookOpen} label={t("bookInfo.chapters")} value={`${meta.totalChapters}`} colors={colors} /> : null}
          <InfoCard
            icon={Database}
            label="AI"
            value={book.isVectorized ? t("bookInfo.vectorized") : t("bookInfo.notVectorized")}
            colors={colors}
            accent={book.isVectorized}
          />
          {/* Import date & Last read */}
          <InfoCard icon={CalendarPlus} label={t("bookInfo.addedAt")} value={formatDate(book.addedAt)} colors={colors} />
          {book.lastOpenedAt ? <InfoCard icon={Clock} label={t("bookInfo.lastOpened")} value={formatDate(book.lastOpenedAt)} colors={colors} /> : null}
        </View>
      </Section>

      {/* Sync status */}
      <View style={[styles.syncRow, { backgroundColor: withOpacity(colors.muted, 0.2) }]}>
        <View style={[styles.syncDot, {
          backgroundColor: book.syncStatus === "local" ? "#10b981" : book.syncStatus === "remote" ? "#3b82f6" : "#f59e0b",
        }]} />
        <Text style={[styles.syncText, { color: colors.mutedForeground }]}>
          {book.syncStatus === "local" ? t("bookInfo.syncLocal") : book.syncStatus === "remote" ? t("bookInfo.syncRemote") : "Syncing..."}
        </Text>
        {book.fileHash ? (
          <Text style={[styles.syncHash, { color: withOpacity(colors.mutedForeground, 0.3) }]}>
            {book.fileHash.slice(0, 8)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

type C = ReturnType<typeof useColors>;

function Section({ title, colors, children }: { title: string; colors: C; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: withOpacity(colors.mutedForeground, 0.6) }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function InfoCard({ icon: Icon, label, value, colors, accent }: { icon: typeof FileText; label: string; value: string; colors: C; accent?: boolean }) {
  return (
    <View style={[styles.infoCard, { backgroundColor: withOpacity(colors.card, 0.6), borderColor: withOpacity(colors.border, 0.2) }]}>
      <View style={[styles.infoIcon, { backgroundColor: accent ? withOpacity("#10b981", 0.1) : withOpacity(colors.muted, 0.5) }]}>
        <Icon size={14} color={accent ? "#10b981" : colors.mutedForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: withOpacity(colors.mutedForeground, 0.5) }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.foreground }]} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function ExpandableText({ text, colors }: { text: string; colors: C }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const needsExpand = text.length > 300;

  return (
    <View>
      <Text
        style={[styles.descText, { color: colors.mutedForeground }]}
        numberOfLines={expanded ? undefined : 5}
      >
        {text}
      </Text>
      {needsExpand && (
        <Pressable onPress={() => setExpanded(!expanded)}>
          <Text style={[styles.expandBtn, { color: colors.primary }]}>
            {expanded ? t("bookInfo.collapse") : t("bookInfo.expand")}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xl },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  tagPrimary: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  tagPrimaryText: { fontSize: 11, fontWeight: fontWeight.medium },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  tagText: { fontSize: 11 },
  tagInput: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 2 },
  tagInputText: { fontSize: 11, minWidth: 80, paddingVertical: 3 },
  addTagBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1, borderStyle: "dashed" },
  addTagText: { fontSize: 11 },
  infoGrid: { gap: spacing.sm },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  infoIcon: { width: 28, height: 28, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 9, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue: { fontSize: fontSize.sm, marginTop: 1 },
  descText: { fontSize: fontSize.sm, lineHeight: 22 },
  expandBtn: { fontSize: 12, fontWeight: fontWeight.medium, marginTop: spacing.xs },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  syncDot: { width: 7, height: 7, borderRadius: radius.full },
  syncText: { fontSize: 11, flex: 1 },
  syncHash: { fontSize: 9, fontFamily: "monospace" },
});
