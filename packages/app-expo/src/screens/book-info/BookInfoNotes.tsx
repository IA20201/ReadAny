/**
 * BookInfoNotes — Mobile notes tab with skeleton, rich cards, empty states
 */
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useColors, spacing, radius, fontSize, fontWeight, withOpacity } from "@/styles/theme";
import type { Book, Highlight, Note, Bookmark } from "@readany/core/types";
import { HIGHLIGHT_COLOR_HEX } from "@readany/core/types";
import { getHighlights, getNotes, getBookmarks } from "@readany/core/db";
import {
  BookmarkIcon,
  FileText,
  Highlighter,
  MessageSquareText,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type NoteFilter = "highlights" | "notes" | "bookmarks";

interface Props {
  book: Book;
}

export function BookInfoNotes({ book }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const [highlights, setHighlights] = useState<Highlight[] | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[] | null>(null);
  const [filter, setFilter] = useState<NoteFilter>("highlights");

  useEffect(() => {
    Promise.all([getHighlights(book.id), getNotes(book.id), getBookmarks(book.id)]).then(
      ([h, n, b]) => { setHighlights(h); setNotes(n); setBookmarks(b); },
    );
  }, [book.id]);

  const loading = highlights === null;
  const counts = {
    highlights: highlights?.length ?? 0,
    notes: notes?.length ?? 0,
    bookmarks: bookmarks?.length ?? 0,
  };
  const total = counts.highlights + counts.notes + counts.bookmarks;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.skeletonTabs, { backgroundColor: withOpacity(colors.muted, 0.2) }]} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.skeletonCard, { backgroundColor: withOpacity(colors.muted, 0.15) }]} />
        ))}
      </View>
    );
  }

  const FILTERS: { key: NoteFilter; icon: typeof Highlighter; label: string }[] = [
    { key: "highlights", icon: Highlighter, label: t("bookInfo.highlights") },
    { key: "notes", icon: MessageSquareText, label: t("bookInfo.notes") },
    { key: "bookmarks", icon: BookmarkIcon, label: t("bookInfo.bookmarks") },
  ];

  return (
    <View style={styles.container}>
      {/* Summary */}
      {total > 0 && (
        <Text style={[styles.summary, { color: colors.mutedForeground }]}>
          {t("bookInfo.summaryHighlights", { count: counts.highlights })} · {t("bookInfo.summaryNotes", { count: counts.notes })} · {t("bookInfo.summaryBookmarks", { count: counts.bookmarks })}
        </Text>
      )}

      {/* Filter tabs */}
      <View style={[styles.filterRow, { backgroundColor: withOpacity(colors.muted, 0.25) }]}>
        {FILTERS.map((f) => {
          const Icon = f.icon;
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterBtn, active && { backgroundColor: colors.card }]}
            >
              <Icon size={14} color={active ? colors.foreground : colors.mutedForeground} />
              <Text style={[styles.filterLabel, { color: active ? colors.foreground : colors.mutedForeground }]}>
                {f.label} {counts[f.key]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      {filter === "highlights" &&
        (highlights!.length === 0 ? (
          <EmptyBlock icon={Highlighter} text={t("bookInfo.noHighlights")} hint={t("bookInfo.hintHighlight")} colors={colors} />
        ) : (
          highlights!.map((h) => <HighlightItem key={h.id} item={h} colors={colors} />)
        ))}

      {filter === "notes" &&
        (notes!.length === 0 ? (
          <EmptyBlock icon={MessageSquareText} text={t("bookInfo.noNotes")} hint={t("bookInfo.hintNote")} colors={colors} />
        ) : (
          notes!.map((n) => <NoteItem key={n.id} item={n} colors={colors} />)
        ))}

      {filter === "bookmarks" &&
        (bookmarks!.length === 0 ? (
          <EmptyBlock icon={BookmarkIcon} text={t("bookInfo.noBookmarks")} hint={t("bookInfo.hintBookmark")} colors={colors} />
        ) : (
          bookmarks!.map((b) => <BookmarkItem key={b.id} item={b} colors={colors} />)
        ))}
    </View>
  );
}

type C = ReturnType<typeof useColors>;

function HighlightItem({ item, colors }: { item: Highlight; colors: C }) {
  const hex = HIGHLIGHT_COLOR_HEX[item.color] || HIGHLIGHT_COLOR_HEX.yellow;
  return (
    <View style={[styles.card, { backgroundColor: withOpacity(colors.card, 0.7), borderColor: withOpacity(colors.border, 0.3), borderLeftColor: hex, borderLeftWidth: 3 }]}>
      <Text style={[styles.quoteText, { color: colors.foreground }]}>&ldquo;{item.text}&rdquo;</Text>
      {item.note ? (
        <View style={[styles.noteInset, { backgroundColor: withOpacity(colors.muted, 0.3) }]}>
          <Text style={[styles.noteInsetText, { color: colors.mutedForeground }]}>{item.note}</Text>
        </View>
      ) : null}
      <View style={styles.cardMeta}>
        {item.chapterTitle ? <Text style={[styles.metaText, { color: withOpacity(colors.mutedForeground, 0.5) }]} numberOfLines={1}>{item.chapterTitle}</Text> : null}
        <Text style={[styles.metaText, { color: withOpacity(colors.mutedForeground, 0.5) }]}>{fmtDate(item.createdAt)}</Text>
      </View>
    </View>
  );
}

function NoteItem({ item, colors }: { item: Note; colors: C }) {
  return (
    <View style={[styles.card, { backgroundColor: withOpacity(colors.card, 0.7), borderColor: withOpacity(colors.border, 0.3) }]}>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={[styles.iconBubble, { backgroundColor: withOpacity("#8b5cf6", 0.1) }]}>
          <FileText size={14} color="#8b5cf6" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.noteTitle, { color: colors.foreground }]}>{item.title}</Text>
          <Text style={[styles.noteBody, { color: colors.mutedForeground }]} numberOfLines={3}>{item.content}</Text>
          <Text style={[styles.metaText, { color: withOpacity(colors.mutedForeground, 0.5), marginTop: 6 }]}>{fmtDate(item.createdAt)}</Text>
        </View>
      </View>
    </View>
  );
}

function BookmarkItem({ item, colors }: { item: Bookmark; colors: C }) {
  return (
    <View style={[styles.card, { backgroundColor: withOpacity(colors.card, 0.7), borderColor: withOpacity(colors.border, 0.3), flexDirection: "row", alignItems: "center", gap: spacing.md }]}>
      <View style={[styles.iconBubble, { backgroundColor: withOpacity("#f59e0b", 0.1) }]}>
        <BookmarkIcon size={14} color="#f59e0b" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.noteTitle, { color: colors.foreground }]}>{item.label || item.chapterTitle || item.cfi}</Text>
        <Text style={[styles.metaText, { color: withOpacity(colors.mutedForeground, 0.5) }]}>{fmtDate(item.createdAt)}</Text>
      </View>
    </View>
  );
}

function EmptyBlock({ icon: Icon, text, hint, colors }: { icon: typeof Highlighter; text: string; hint: string; colors: C }) {
  return (
    <View style={[styles.empty, { borderColor: withOpacity(colors.border, 0.3) }]}>
      <View style={[styles.emptyIcon, { backgroundColor: withOpacity(colors.muted, 0.3) }]}>
        <Icon size={20} color={withOpacity(colors.mutedForeground, 0.3)} />
      </View>
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{text}</Text>
      <Text style={[styles.emptyHint, { color: withOpacity(colors.mutedForeground, 0.4) }]}>{hint}</Text>
    </View>
  );
}

function fmtDate(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  summary: { fontSize: 11 },
  filterRow: { flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.xl },
  filterBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: spacing.sm, borderRadius: radius.lg },
  filterLabel: { fontSize: 11, fontWeight: fontWeight.medium },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.md },
  quoteText: { fontSize: fontSize.sm, fontStyle: "italic", lineHeight: 22 },
  noteInset: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.sm },
  noteInsetText: { fontSize: 11, lineHeight: 16 },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  metaText: { fontSize: 9 },
  iconBubble: { width: 28, height: 28, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  noteTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  noteBody: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: 48, borderWidth: 1, borderStyle: "dashed", borderRadius: radius.xl },
  emptyIcon: { width: 44, height: 44, borderRadius: radius.full, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  emptyText: { fontSize: fontSize.sm },
  emptyHint: { fontSize: 11, marginTop: 4 },
  skeletonTabs: { height: 40, borderRadius: radius.xl },
  skeletonCard: { height: 80, borderRadius: radius.xl },
});
