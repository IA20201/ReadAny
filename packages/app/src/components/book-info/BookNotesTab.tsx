/**
 * BookNotesTab — Highlights, notes, bookmarks with rich visual cards
 */
import type { Book, Highlight, Note, Bookmark } from "@readany/core/types";
import { HIGHLIGHT_COLOR_HEX } from "@readany/core/types";
import { getHighlights, getNotes, getBookmarks } from "@readany/core/db";
import {
  BookmarkIcon,
  FileText,
  Highlighter,
  MessageSquareText,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type NoteFilter = "highlights" | "notes" | "bookmarks";

interface BookNotesTabProps {
  book: Book;
}

export function BookNotesTab({ book }: BookNotesTabProps) {
  const { t } = useTranslation();
  const [highlights, setHighlights] = useState<Highlight[] | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[] | null>(null);
  const [filter, setFilter] = useState<NoteFilter>("highlights");

  useEffect(() => {
    Promise.all([
      getHighlights(book.id),
      getNotes(book.id),
      getBookmarks(book.id),
    ]).then(([h, n, b]) => {
      setHighlights(h);
      setNotes(n);
      setBookmarks(b);
    });
  }, [book.id]);

  const loading = highlights === null;
  const counts = {
    highlights: highlights?.length ?? 0,
    notes: notes?.length ?? 0,
    bookmarks: bookmarks?.length ?? 0,
  };
  const total = counts.highlights + counts.notes + counts.bookmarks;

  // Skeleton loading
  if (loading) {
    return (
      <div className="flex max-w-2xl flex-col gap-3">
        <div className="flex gap-1 rounded-xl bg-muted/30 p-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 flex-1 animate-pulse rounded-lg bg-muted/50" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/30" />
        ))}
      </div>
    );
  }

  const FILTERS: { key: NoteFilter; icon: typeof Highlighter; label: string }[] = [
    { key: "highlights", icon: Highlighter, label: t("bookInfo.highlights") },
    { key: "notes", icon: MessageSquareText, label: t("bookInfo.notes") },
    { key: "bookmarks", icon: BookmarkIcon, label: t("bookInfo.bookmarks") },
  ];

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {/* Summary */}
      {total > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("bookInfo.summaryHighlights", { count: counts.highlights })} · {t("bookInfo.summaryNotes", { count: counts.notes })} · {t("bookInfo.summaryBookmarks", { count: counts.bookmarks })}
        </p>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-xl bg-muted/30 p-1">
        {FILTERS.map((f) => {
          const Icon = f.icon;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 ${
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {f.label}
              <span
                className={`ml-0.5 tabular-nums ${active ? "text-foreground/60" : "text-muted-foreground/50"}`}
              >
                {counts[f.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2.5">
        {filter === "highlights" &&
          (highlights!.length === 0 ? (
            <EmptyState icon={Highlighter} text={t("bookInfo.noHighlights")} hint={t("bookInfo.hintHighlight")} />
          ) : (
            highlights!.map((h) => <HighlightCard key={h.id} highlight={h} />)
          ))}

        {filter === "notes" &&
          (notes!.length === 0 ? (
            <EmptyState icon={MessageSquareText} text={t("bookInfo.noNotes")} hint={t("bookInfo.hintNote")} />
          ) : (
            notes!.map((n) => <NoteCard key={n.id} note={n} />)
          ))}

        {filter === "bookmarks" &&
          (bookmarks!.length === 0 ? (
            <EmptyState icon={BookmarkIcon} text={t("bookInfo.noBookmarks")} hint={t("bookInfo.hintBookmark")} />
          ) : (
            bookmarks!.map((b) => <BookmarkCard key={b.id} bookmark={b} />)
          ))}
      </div>
    </div>
  );
}

/* ─── Cards ─── */

function HighlightCard({ highlight }: { highlight: Highlight }) {
  const colorHex = HIGHLIGHT_COLOR_HEX[highlight.color] || HIGHLIGHT_COLOR_HEX.yellow;

  return (
    <div
      className="rounded-xl border border-border/40 bg-card/60 p-4 transition-all duration-150 hover:bg-card hover:shadow-sm"
      style={{ borderLeftWidth: 3, borderLeftColor: colorHex }}
    >
      <p className="text-sm italic leading-relaxed text-foreground/90">
        &ldquo;{highlight.text}&rdquo;
      </p>
      {highlight.note && (
        <p className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {highlight.note}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground/60">
        {highlight.chapterTitle && (
          <span className="truncate max-w-[60%]">{highlight.chapterTitle}</span>
        )}
        <span className="tabular-nums">{formatDate(highlight.createdAt)}</span>
      </div>
    </div>
  );
}

function NoteCard({ note }: { note: Note }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-4 transition-all duration-150 hover:bg-card hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-violet-500/10 p-1.5">
          <FileText className="h-3.5 w-3.5 text-violet-500" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-foreground">{note.title}</h4>
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {note.content}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground/60">
            {note.chapterTitle && <span className="truncate">{note.chapterTitle}</span>}
            <span className="tabular-nums">{formatDate(note.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookmarkCard({ bookmark }: { bookmark: Bookmark }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 p-3.5 transition-all duration-150 hover:bg-card hover:shadow-sm">
      <div className="rounded-md bg-amber-500/10 p-1.5">
        <BookmarkIcon className="h-3.5 w-3.5 text-amber-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          {bookmark.label || bookmark.chapterTitle || bookmark.cfi}
        </p>
        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
          {formatDate(bookmark.createdAt)}
        </span>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  text,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-12">
      <div className="mb-3 rounded-full bg-muted/50 p-3">
        <Icon className="h-5 w-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
      <p className="mt-1 text-xs text-muted-foreground/50">{hint}</p>
    </div>
  );
}

function formatDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
