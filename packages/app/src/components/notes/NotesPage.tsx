import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { useResolvedSrc } from "@/hooks/use-resolved-src";
import type { HighlightWithBook } from "@/lib/db/database";
import { useAnnotationStore } from "@/stores/annotation-store";
import { useAppStore } from "@/stores/app-store";
import { useLibraryStore } from "@/stores/library-store";
import { type ExportFormat, annotationExporter } from "@readany/core/export";
import type { Highlight, Note } from "@readany/core/types";
import { HIGHLIGHT_COLOR_HEX } from "@readany/core/types";
import { cn } from "@readany/core/utils";
import {
  BookOpen,
  Check,
  ChevronLeft,
  Edit3,
  FileText,
  Highlighter,
  NotebookPen,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { KnowledgePanel } from "./KnowledgePanel";
/**
 * NotesPage — Notebook-style knowledge management center
 * Layout: Left panel (book notebooks grid) + Right panel (selected book's notes & highlights)
 * Notes and highlights are displayed separately.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { ExportDropdown } from "./ExportDropdown";
type DetailTab = "notes" | "highlights" | "knowledge";

// Helper component to resolve and display cover images
interface CoverImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  url: string | undefined | null;
  fallback?: React.ReactNode;
}

function CoverImage({ url, fallback, ...imgProps }: CoverImageProps) {
  const resolvedSrc = useResolvedSrc(url ?? undefined);

  if (!resolvedSrc) {
    return <>{fallback}</>;
  }

  return <img src={resolvedSrc} {...imgProps} />;
}

export function NotesPage() {
  const { t } = useTranslation();
  const {
    highlightsWithBooks,
    loadAllHighlightsWithBooks,
    removeHighlight,
    updateHighlight,
    stats,
    loadStats,
  } = useAnnotationStore();
  const { addTab, setActiveTab, activeTabId } = useAppStore();
  const books = useLibraryStore((s) => s.books);

  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [detailTab, setDetailTab] = useState<DetailTab>("notes");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");

  useEffect(() => {
    if (activeTabId !== "notes") return;
    setIsLoading(true);
    Promise.all([loadAllHighlightsWithBooks(500), loadStats()]).finally(() => setIsLoading(false));
  }, [loadAllHighlightsWithBooks, loadStats, activeTabId]);

  // Group highlights by book
  const bookNotebooks = useMemo(() => {
    const grouped = new Map<
      string,
      {
        bookId: string;
        title: string;
        author: string;
        coverUrl: string | null;
        highlights: HighlightWithBook[];
        notesCount: number;
        highlightsOnlyCount: number;
        latestAt: number;
      }
    >();

    for (const h of highlightsWithBooks) {
      const existing = grouped.get(h.bookId);
      if (existing) {
        existing.highlights.push(h);
        if (h.note) existing.notesCount++;
        else existing.highlightsOnlyCount++;
        if (h.createdAt > existing.latestAt) existing.latestAt = h.createdAt;
      } else {
        grouped.set(h.bookId, {
          bookId: h.bookId,
          title: h.bookTitle || t("notes.unknownBook"),
          author: h.bookAuthor || t("notes.unknownAuthor"),
          coverUrl: h.bookCoverUrl || null,
          highlights: [h],
          notesCount: h.note ? 1 : 0,
          highlightsOnlyCount: h.note ? 0 : 1,
          latestAt: h.createdAt,
        });
      }
    }

    return Array.from(grouped.values()).sort((a, b) => b.latestAt - a.latestAt);
  }, [highlightsWithBooks, t]);

  const selectedBook = useMemo(() => {
    if (!selectedBookId) return null;
    return bookNotebooks.find((b) => b.bookId === selectedBookId) || null;
  }, [selectedBookId, bookNotebooks]);

  // Split into notes (has note text) and highlights-only
  const { notes, highlightsOnly } = useMemo(() => {
    if (!selectedBook) return { notes: [], highlightsOnly: [] };
    let all = selectedBook.highlights;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      all = all.filter(
        (h) =>
          h.text.toLowerCase().includes(q) ||
          h.note?.toLowerCase().includes(q) ||
          h.chapterTitle?.toLowerCase().includes(q),
      );
    }
    const sorted = all.sort((a, b) => b.createdAt - a.createdAt);
    return {
      notes: sorted.filter((h) => h.note),
      highlightsOnly: sorted.filter((h) => !h.note),
    };
  }, [selectedBook, searchQuery]);

  const currentList = detailTab === "notes" ? notes : highlightsOnly;

  // Group by chapter
  const itemsByChapter = useMemo(() => {
    const chapters = new Map<string, HighlightWithBook[]>();
    for (const h of currentList) {
      const chapter = h.chapterTitle || t("notes.unknownChapter");
      const arr = chapters.get(chapter) || [];
      arr.push(h);
      chapters.set(chapter, arr);
    }
    return chapters;
  }, [currentList, t]);

  const handleOpenBook = (bookId: string, title: string, cfi?: string) => {
    const tabId = `reader-${bookId}`;
    addTab({ id: tabId, type: "reader", title, bookId, initialCfi: cfi });
    setActiveTab(tabId);
  };

  // Delete only the note text, keep the highlight
  const handleDeleteNote = (highlight: HighlightWithBook) => {
    updateHighlight(highlight.id, { note: undefined });
    loadStats();
  };

  // Delete the entire highlight record
  const handleDeleteHighlight = (highlight: HighlightWithBook) => {
    removeHighlight(highlight.id);
    loadStats();
  };

  const startEditNote = (highlight: HighlightWithBook) => {
    setEditingId(highlight.id);
    setEditNote(highlight.note || "");
  };

  const saveNote = (id: string) => {
    updateHighlight(id, { note: editNote || undefined });
    setEditingId(null);
    setEditNote("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditNote("");
  };

  const doExport = (
    format: ExportFormat,
    book: { id: string; meta: { title: string } },
    content: string,
  ) => {
    try {
      if (format === "notion") {
        annotationExporter.copyToClipboard(content);
        toast.success(t("notes.copiedToClipboard"));
      } else {
        const ext = format === "json" ? "json" : "md";
        annotationExporter.downloadAsFile(content, `${book.meta.title}-${format}.${ext}`, format);
        toast.success(t("notes.exportSuccess"), {
          description: `${book.meta.title}.${ext}`,
        });
      }
    } catch (error) {
      toast.error(t("notes.exportFailed"));
      console.error("Export failed:", error);
    }
  };

  const handleSingleBookExport = (format: ExportFormat) => {
    if (!selectedBook) return;
    const book = books.find((b) => b.id === selectedBook.bookId);
    if (!book) return;
    const content = annotationExporter.export(
      selectedBook.highlights as Highlight[],
      [] as Note[],
      book,
      { format },
    );
    doExport(format, book, content);
  };

  const handleMultiBookExport = (format: ExportFormat) => {
    const booksData = bookNotebooks
      .map((notebook) => {
        const book = books.find((b) => b.id === notebook.bookId);
        if (!book) return null;
        return { book, highlights: notebook.highlights as Highlight[], notes: [] as Note[] };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
    if (booksData.length === 0) return;
    try {
      const content = annotationExporter.exportMultipleBooks(booksData, { format });
      if (format === "notion") {
        annotationExporter.copyToClipboard(content);
        toast.success(t("notes.copiedToClipboard"));
      } else {
        const ext = format === "json" ? "json" : "md";
        annotationExporter.downloadAsFile(content, `all-annotations.${ext}`, format);
        toast.success(t("notes.exportSuccess"), {
          description: `all-annotations.${ext}`,
        });
      }
    } catch (error) {
      toast.error(t("notes.exportFailed"));
      console.error("Export failed:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (bookNotebooks.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted/50">
          <img src="/note.svg" alt="" className="h-12 w-12 opacity-50 dark:invert" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground/70">{t("notes.empty")}</p>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{t("notes.emptyHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left Panel — Notebooks */}
      <div
        className={cn(
          "shrink-0 border-r border-border/40 flex flex-col",
          selectedBookId ? "w-[260px]" : "w-full",
        )}
      >
        {/* Left header */}
        <div className="shrink-0 border-b border-border/40 px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">{t("notes.title")}</h1>
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  <Highlighter className="h-2.5 w-2.5" />
                  {stats?.totalHighlights || 0}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  <NotebookPen className="h-2.5 w-2.5" />
                  {stats?.highlightsWithNotes || 0}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  <BookOpen className="h-2.5 w-2.5" />
                  {stats?.totalBooks || 0}
                </span>
              </div>
            </div>
            {!selectedBookId && <ExportDropdown onExport={handleMultiBookExport} />}
          </div>
        </div>

        {/* Notebook list / grid */}
        <div className="flex-1 overflow-y-auto">
          {selectedBookId ? (
            /* Compact list */
            <div className="py-2">
              {bookNotebooks.map((book) => (
                <button
                  key={book.bookId}
                  type="button"
                  className={cn(
                    "relative w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150",
                    book.bookId === selectedBookId
                      ? "bg-primary/8 text-primary"
                      : "hover:bg-muted/50 text-foreground",
                  )}
                  onClick={() => {
                    setSelectedBookId(book.bookId);
                    setSearchQuery("");
                    setEditingId(null);
                  }}
                >
                  {/* Selected accent bar */}
                  {book.bookId === selectedBookId && (
                    <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />
                  )}
                  <CoverImage
                    url={book.coverUrl}
                    alt=""
                    className="h-11 w-[30px] shrink-0 rounded object-cover shadow-sm"
                    fallback={
                      <div className="flex h-11 w-[30px] shrink-0 items-center justify-center rounded bg-muted">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate leading-snug">{book.title}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{book.author}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                      {book.highlights.length} {t("notes.highlightsCount")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* Full grid view */
            <div className="p-5">
              <div className="grid grid-cols-3 gap-x-5 gap-y-7 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                {bookNotebooks.map((book) => (
                  <NotebookCard
                    key={book.bookId}
                    book={book}
                    onClick={() => {
                      setSelectedBookId(book.bookId);
                      setSearchQuery("");
                      setEditingId(null);
                      setDetailTab("notes");
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel — Book Notes / Highlights Detail */}
      {selectedBookId && selectedBook && (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Right header */}
          <div className="shrink-0 border-b border-border/40 px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150"
                onClick={() => setSelectedBookId(null)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <CoverImage
                url={selectedBook.coverUrl}
                alt=""
                className="h-11 w-[30px] shrink-0 rounded object-cover shadow-sm"
                fallback={
                  <div className="flex h-11 w-[30px] shrink-0 items-center justify-center rounded bg-muted">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </div>
                }
              />

              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold truncate leading-snug">{selectedBook.title}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground truncate">{selectedBook.author}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenBook(selectedBook.bookId, selectedBook.title)}
                  className="gap-1.5 h-7 text-xs rounded-lg"
                >
                  <BookOpen className="h-3 w-3" />
                  {t("notes.openBook")}
                </Button>
                <ExportDropdown onExport={handleSingleBookExport} variant="outline" size="sm" />
              </div>
            </div>

            {/* Tab switcher + search */}
            <div className="mt-3 flex items-center gap-3">
              {/* Pill segment tabs */}
              <div className="flex rounded-full bg-muted/60 p-1 gap-0.5">
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150",
                    detailTab === "notes"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setDetailTab("notes")}
                >
                  <NotebookPen className="h-3 w-3" />
                  {t("notebook.notesSection")}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-[10px] leading-tight font-medium",
                      detailTab === "notes"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted-foreground/15 text-muted-foreground",
                    )}
                  >
                    {selectedBook.notesCount}
                  </span>
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150",
                    detailTab === "highlights"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setDetailTab("highlights")}
                >
                  <Highlighter className="h-3 w-3" />
                  {t("notebook.highlightsSection")}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-[10px] leading-tight font-medium",
                      detailTab === "highlights"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted-foreground/15 text-muted-foreground",
                    )}
                  >
                    {selectedBook.highlightsOnlyCount}
                  </span>
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150",
                    detailTab === "knowledge"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setDetailTab("knowledge")}
                >
                  <FileText className="h-3 w-3" />
                  {t("knowledge.title")}
                </button>
              </div>

              {detailTab !== "knowledge" && (
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    placeholder={t("notes.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-8 text-sm rounded-full border-border/50 bg-muted/30 focus-visible:bg-background"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          {detailTab === "knowledge" ? (
            <div className="flex-1 overflow-hidden">
              <KnowledgePanel bookId={selectedBook.bookId} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {currentList.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
                    {detailTab === "notes" ? (
                      <NotebookPen className="h-6 w-6 text-muted-foreground/40" />
                    ) : (
                      <Highlighter className="h-6 w-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground/70">
                    {searchQuery
                      ? t("notes.noSearchResults")
                      : detailTab === "notes"
                        ? t("notes.noNotes")
                        : t("highlights.noHighlights")}
                  </p>
                </div>
              ) : (
                <div className="px-6 py-5 space-y-7">
                  {Array.from(itemsByChapter.entries()).map(([chapter, items]) => (
                    <div key={chapter}>
                      {/* Chapter divider — pill badge */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-px flex-1 bg-border/30" />
                        <div className="flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-3 py-1">
                          <BookOpen className="h-2.5 w-2.5 shrink-0 text-muted-foreground/60" />
                          <span className="max-w-[180px] truncate text-[11px] font-medium text-muted-foreground/70">
                            {chapter}
                          </span>
                        </div>
                        <div className="h-px flex-1 bg-border/30" />
                      </div>

                      <div className="space-y-3">
                        {items.map((item) =>
                          detailTab === "notes" ? (
                            <NoteDetailCard
                              key={item.id}
                              highlight={item}
                              isEditing={editingId === item.id}
                              editNote={editNote}
                              setEditNote={setEditNote}
                              onStartEdit={() => startEditNote(item)}
                              onSaveNote={() => saveNote(item.id)}
                              onCancelEdit={cancelEdit}
                              onDeleteNote={() => handleDeleteNote(item)}
                              onNavigate={() =>
                                handleOpenBook(selectedBook.bookId, selectedBook.title, item.cfi)
                              }
                              t={t}
                            />
                          ) : (
                            <HighlightDetailCard
                              key={item.id}
                              highlight={item}
                              onDelete={() => handleDeleteHighlight(item)}
                              onNavigate={() =>
                                handleOpenBook(selectedBook.bookId, selectedBook.title, item.cfi)
                              }
                              t={t}
                            />
                          ),
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Notebook card (BookCard-inspired style) ---

interface NotebookCardProps {
  book: {
    bookId: string;
    title: string;
    author: string;
    coverUrl: string | null;
    highlights: HighlightWithBook[];
    notesCount: number;
    highlightsOnlyCount: number;
  };
  onClick: () => void;
}

function NotebookCard({ book, onClick }: NotebookCardProps) {
  return (
    <div
      className="group flex h-full cursor-pointer flex-col justify-end"
      onClick={onClick}
    >
      {/* Cover */}
      <div className="book-cover-shadow relative flex aspect-[28/41] w-full items-end justify-center overflow-hidden rounded transition-all duration-200 group-hover:scale-[1.03] group-hover:shadow-md">
        <CoverImage
          url={book.coverUrl}
          alt=""
          className="absolute inset-0 h-full w-full rounded object-cover"
          loading="lazy"
          fallback={
            <div className="absolute inset-0 flex flex-col items-center rounded bg-gradient-to-b from-stone-100 to-stone-200 dark:from-stone-700 dark:to-stone-800 p-3">
              <div className="flex flex-1 items-center justify-center">
                <span className="line-clamp-3 text-center font-serif text-base font-medium leading-snug text-stone-500 dark:text-stone-300">
                  {book.title}
                </span>
              </div>
              <div className="h-px w-8 bg-stone-300/60" />
              {book.author && (
                <div className="flex h-1/4 items-center justify-center">
                  <span className="line-clamp-1 text-center font-serif text-xs text-stone-400 dark:text-stone-400">
                    {book.author}
                  </span>
                </div>
              )}
            </div>
          }
        />

        {/* Spine overlay */}
        {book.coverUrl && <div className="book-spine absolute inset-0 rounded" />}

        {/* Stats badge — bottom right */}
        <div className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 backdrop-blur-sm">
          <Highlighter className="h-2.5 w-2.5 text-white/75" />
          <span className="text-[9px] font-semibold text-white">{book.highlightsOnlyCount}</span>
          {book.notesCount > 0 && (
            <>
              <div className="h-2.5 w-px bg-white/20" />
              <NotebookPen className="h-2.5 w-2.5 text-white/75" />
              <span className="text-[9px] font-semibold text-white">{book.notesCount}</span>
            </>
          )}
        </div>
      </div>

      {/* Info area */}
      <div className="mt-2 flex w-full flex-col gap-0.5">
        <h4 className="truncate text-xs font-semibold leading-tight text-foreground transition-colors duration-150 group-hover:text-primary">
          {book.title}
        </h4>
        {book.author && (
          <p className="truncate text-[10px] leading-tight text-muted-foreground">{book.author}</p>
        )}
      </div>
    </div>
  );
}

// --- Note detail card (for "Notes" tab) ---

interface NoteDetailCardProps {
  highlight: HighlightWithBook;
  isEditing: boolean;
  editNote: string;
  setEditNote: (note: string) => void;
  onStartEdit: () => void;
  onSaveNote: () => void;
  onCancelEdit: () => void;
  onDeleteNote: () => void;
  onNavigate: () => void;
  t: (key: string) => string;
}

function NoteDetailCard({
  highlight,
  isEditing,
  editNote,
  setEditNote,
  onStartEdit,
  onSaveNote,
  onCancelEdit,
  onDeleteNote,
  onNavigate,
  t,
}: NoteDetailCardProps) {
  return (
    <div className="group overflow-hidden rounded-xl border border-border/40 bg-card transition-all duration-150 hover:border-border/60 hover:shadow-sm">
      {/* Blockquote — highlight text with left accent bar + tinted bg */}
      <div
        className="cursor-pointer px-4 pt-4 pb-3"
        onClick={onNavigate}
        title={t("notes.openBook")}
      >
        <div className="flex gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
          <div className="w-[3px] shrink-0 self-stretch rounded-full bg-primary/50 transition-colors duration-150 group-hover:bg-primary/70" />
          <p className="text-[13px] italic leading-relaxed text-muted-foreground/80 line-clamp-4">
            {highlight.text}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-border/30" />

      {/* Note content */}
      <div className="px-4 py-3">
        {isEditing ? (
          <div className="flex items-start gap-2">
            <MarkdownEditor
              value={editNote}
              onChange={setEditNote}
              placeholder={t("notebook.addNote")}
              className="flex-1"
              autoFocus
            />
            <div className="flex flex-col gap-1 pt-0.5">
              <button
                type="button"
                className="rounded-lg p-1.5 text-primary transition-colors hover:bg-primary/10"
                onClick={onSaveNote}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                onClick={onCancelEdit}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="cursor-pointer" onClick={onStartEdit}>
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed break-words overflow-hidden [overflow-wrap:anywhere]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{highlight.note || ""}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 pb-3">
        <span className="text-[11px] text-muted-foreground/50">
          {new Date(highlight.createdAt).toLocaleDateString()}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            onClick={onStartEdit}
            title={t("notebook.editNote")}
          >
            <Edit3 className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteNote();
            }}
            title={t("notebook.deleteNote")}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Highlight detail card (for "Highlights" tab) ---

interface HighlightDetailCardProps {
  highlight: HighlightWithBook;
  onDelete: () => void;
  onNavigate: () => void;
  t: (key: string) => string;
}

function HighlightDetailCard({ highlight, onDelete, onNavigate, t }: HighlightDetailCardProps) {
  const hexColor =
    HIGHLIGHT_COLOR_HEX[highlight.color as keyof typeof HIGHLIGHT_COLOR_HEX] ||
    HIGHLIGHT_COLOR_HEX.yellow;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/40 bg-card transition-all duration-150 hover:border-border/60 hover:shadow-sm">
      {/* Color accent bar — full height, rounded left corners */}
      <div
        className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l-xl"
        style={{ backgroundColor: hexColor }}
      />

      <div className="py-4 pl-5 pr-4">
        <p
          className="cursor-pointer text-sm leading-relaxed text-foreground/85 transition-colors duration-150 hover:text-primary"
          onClick={onNavigate}
        >
          {highlight.text}
        </p>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground/50">
            {new Date(highlight.createdAt).toLocaleDateString()}
          </span>
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all duration-150 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title={t("notebook.deleteHighlight")}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
