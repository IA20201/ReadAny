/**
 * BookInfoPanel — Desktop two-column book info page
 *
 * Design: Apple Books-inspired, content-first, elevated visual depth
 * Left: 340px sidebar with hero cover, actions, metadata
 * Right: scrollable tabs (Overview / Reading / Notes)
 */
import { openDesktopBook } from "@/lib/library/open-book";
import {
  getDesktopLibraryRoot,
} from "@/lib/storage/desktop-library-root";
import { useLibraryStore } from "@/stores/library-store";
import type { Book, ReadingStatus } from "@readany/core/types";
import { getReadingSessions } from "@readany/core/db";
import * as Tabs from "@radix-ui/react-tabs";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Clock,
  Database,
  Headphones,
  ImagePlus,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Type,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookCoverHero } from "./BookCoverHero";
import { BookNotesTab } from "./BookNotesTab";
import { BookOverviewTab } from "./BookOverviewTab";
import { BookReadingTab } from "./BookReadingTab";
import { BookStatusPill } from "./BookStatusPill";
import { StarRating } from "./StarRating";

interface BookInfoPanelProps {
  book: Book;
  onBack: () => void;
}

export function BookInfoPanel({ book, onBack }: BookInfoPanelProps) {
  const { t } = useTranslation();
  const updateBook = useLibraryStore((s) => s.updateBook);
  const [reviewText, setReviewText] = useState(book.shortReview ?? "");
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Editable title & author
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [editTitle, setEditTitle] = useState(book.meta.title);
  const [editAuthor, setEditAuthor] = useState(book.meta.author);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Aggregate reading stats for sidebar quick view
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    getReadingSessions(book.id).then((sessions) => {
      const mins = Math.round(
        sessions.reduce((s, r) => s + (r.totalActiveTime || 0), 0) / 60000,
      );
      const chars = sessions.reduce((s, r) => s + (r.charactersRead || 0), 0);
      setTotalMinutes(mins);
      setTotalChars(chars);
      setSessionCount(sessions.length);
    });
  }, [book.id]);

  const progressPct = Math.round(book.progress * 100);
  const speed = totalMinutes > 0 ? Math.round(totalChars / totalMinutes) : 0;

  const ctaLabel =
    book.readingStatus === "finished"
      ? t("bookInfo.reread")
      : book.progress > 0
        ? t("bookInfo.continueReading")
        : t("bookInfo.startReading");

  const handleOpenBook = useCallback(() => {
    openDesktopBook(book.id);
  }, [book.id]);

  const handleStatusChange = useCallback(
    (status: ReadingStatus) => {
      updateBook(book.id, { readingStatus: status });
    },
    [book.id, updateBook],
  );

  const handleRatingChange = useCallback(
    (rating: number | undefined) => {
      updateBook(book.id, { rating } as Partial<Book>);
    },
    [book.id, updateBook],
  );

  const handleReviewSave = useCallback(() => {
    const trimmed = reviewText.trim().slice(0, 200);
    updateBook(book.id, { shortReview: trimmed || undefined } as Partial<Book>);
    setIsEditingReview(false);
  }, [book.id, reviewText, updateBook]);

  const handleCoverReplace = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }],
      });
      if (!selected || Array.isArray(selected)) return;

      const { readFile, writeFile, mkdir } = await import("@tauri-apps/plugin-fs");
      const { join } = await import("@tauri-apps/api/path");

      const libraryRoot = await getDesktopLibraryRoot();
      const coversDir = await join(libraryRoot, "covers");
      try { await mkdir(coversDir, { recursive: true }); } catch { /* exists */ }

      // Determine extension from selected file
      const ext = selected.toLowerCase().endsWith(".png") ? "png" : "jpg";
      const relativePath = `covers/${book.id}.${ext}`;
      const destPath = await join(libraryRoot, relativePath);

      // Copy file bytes
      const fileBytes = await readFile(selected);
      await writeFile(destPath, fileBytes);

      // Update book with new cover path + cache bust
      updateBook(book.id, {
        meta: { ...book.meta, coverUrl: relativePath },
      } as Partial<Book>);
    } catch (err) {
      console.error("Cover replacement failed:", err);
    }
  }, [book.id, book.meta, updateBook]);

  const handleMetaSave = useCallback(() => {
    const trimmedTitle = editTitle.trim();
    const trimmedAuthor = editAuthor.trim();
    if (trimmedTitle && (trimmedTitle !== book.meta.title || trimmedAuthor !== book.meta.author)) {
      updateBook(book.id, {
        meta: { ...book.meta, title: trimmedTitle, author: trimmedAuthor },
      } as Partial<Book>);
    }
    setIsEditingMeta(false);
  }, [book.id, book.meta, editTitle, editAuthor, updateBook]);

  const handleMetaCancel = useCallback(() => {
    setEditTitle(book.meta.title);
    setEditAuthor(book.meta.author);
    setIsEditingMeta(false);
  }, [book.meta.title, book.meta.author]);

  const formatTime = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="flex h-full flex-col bg-background">
        {/* Top bar */}
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border/60 px-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-[0.97]"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common.back")}
          </button>
          <div className="flex-1" />
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content
              side="bottom"
              className="rounded-md bg-foreground/90 px-2.5 py-1.5 text-xs text-background"
            >
              {t("bookInfo.moreActions")}
            </Tooltip.Content>
          </Tooltip.Root>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* ─── Left sidebar (340px) ─── */}
          <div className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-r border-border/60">
            {/* Hero area with subtle gradient bg */}
            <div className="relative flex flex-col items-center gap-4 px-8 pt-8 pb-6">
              {/* Subtle background wash */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-muted/40 to-transparent" />

              {/* Cover with shadow */}
              <div className="group relative z-[1]">
                <BookCoverHero book={book} size="large" />
                {/* Cover replace overlay on hover */}
                <button
                  type="button"
                  className="absolute inset-0 z-10 flex items-center justify-center rounded-sm bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100"
                  onClick={handleCoverReplace}
                >
                  <div className="flex flex-col items-center gap-1">
                    <ImagePlus className="h-5 w-5 text-white" />
                    <span className="text-xs font-medium text-white">
                      {t("bookInfo.changeCover")}
                    </span>
                  </div>
                </button>
              </div>

              {/* Title & Author — editable */}
              <div className="relative z-[1] w-full text-center">
                {isEditingMeta ? (
                  <div className="flex flex-col gap-2">
                    <input
                      ref={titleInputRef}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-center text-base font-bold text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10"
                      placeholder={t("bookInfo.editTitle")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleMetaSave();
                        if (e.key === "Escape") handleMetaCancel();
                      }}
                    />
                    <input
                      value={editAuthor}
                      onChange={(e) => setEditAuthor(e.target.value)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-center text-sm text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10"
                      placeholder={t("bookInfo.editAuthor")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleMetaSave();
                        if (e.key === "Escape") handleMetaCancel();
                      }}
                    />
                    <div className="flex justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleMetaSave}
                        className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleMetaCancel}
                        className="rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/80"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingMeta(true);
                      setTimeout(() => titleInputRef.current?.focus(), 50);
                    }}
                    className="group/title w-full rounded-lg px-2 py-1 transition-colors hover:bg-muted/50"
                  >
                    <h1
                      className="text-base font-bold leading-snug text-foreground"
                      title={book.meta.title}
                    >
                      {book.meta.title}
                      <Pencil className="ml-1.5 inline h-3 w-3 text-muted-foreground/0 transition-colors group-hover/title:text-muted-foreground/50" />
                    </h1>
                    {book.meta.author && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {book.meta.author}
                      </p>
                    )}
                  </button>
                )}
              </div>

              {/* Status + Rating */}
              <div className="relative z-[1] flex items-center gap-3">
                <BookStatusPill
                  status={book.readingStatus}
                  onChange={handleStatusChange}
                />
                <div className="h-4 w-px bg-border" />
                <StarRating
                  value={book.rating}
                  onChange={handleRatingChange}
                  size={18}
                />
              </div>
            </div>

            {/* Short review */}
            <div className="px-6 pb-4">
              {isEditingReview ? (
                <div className="flex flex-col gap-1">
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value.slice(0, 200))}
                    placeholder={t("bookInfo.shortReviewPlaceholder")}
                    maxLength={200}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-shadow duration-200"
                    onBlur={handleReviewSave}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleReviewSave();
                      }
                      if (e.key === "Escape") {
                        setReviewText(book.shortReview ?? "");
                        setIsEditingReview(false);
                      }
                    }}
                    autoFocus
                  />
                  <span className="text-right text-[10px] text-muted-foreground/60">
                    {reviewText.length}/200
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingReview(true)}
                  className="w-full rounded-lg px-3 py-2 text-center text-sm italic transition-colors hover:bg-muted/50"
                  style={{
                    color: book.shortReview
                      ? "var(--foreground)"
                      : "var(--muted-foreground)",
                  }}
                >
                  {book.shortReview
                    ? `"${book.shortReview}"`
                    : t("bookInfo.shortReviewPlaceholder")}
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="mx-6 h-px bg-border/50" />

            {/* CTA buttons */}
            <div className="flex flex-col gap-2 px-6 py-4">
              <button
                type="button"
                onClick={handleOpenBook}
                className="group flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98]"
              >
                <BookOpen className="h-4 w-4 transition-transform group-hover:scale-110" />
                {ctaLabel}
                {progressPct > 0 && progressPct < 100 && (
                  <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">
                    {progressPct}%
                  </span>
                )}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground shadow-sm transition-all duration-150 hover:bg-muted hover:shadow active:scale-[0.98]"
                >
                  <Headphones className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("bookInfo.listenBook")}
                </button>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm shadow-sm transition-all duration-150 active:scale-[0.98] ${
                        book.isVectorized
                          ? "bg-card text-foreground hover:bg-muted hover:shadow"
                          : "bg-muted/50 text-muted-foreground cursor-not-allowed opacity-60"
                      }`}
                      disabled={!book.isVectorized}
                    >
                      {book.isVectorized ? (
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      ) : (
                        <MessageCircle className="h-3.5 w-3.5" />
                      )}
                      {t("bookInfo.askAI")}
                    </button>
                  </Tooltip.Trigger>
                  {!book.isVectorized && (
                    <Tooltip.Content
                      side="bottom"
                      className="max-w-[200px] rounded-md bg-foreground/90 px-2.5 py-1.5 text-xs text-background"
                    >
                      {t("bookInfo.vectorizeRequired")}
                    </Tooltip.Content>
                  )}
                </Tooltip.Root>
              </div>
            </div>

            {/* Divider */}
            <div className="mx-6 h-px bg-border/50" />

            {/* Quick stats — 3 columns */}
            <div className="grid grid-cols-3 gap-2 px-6 py-4">
              <QuickStat
                icon={<Clock className="h-3.5 w-3.5" />}
                label={t("bookInfo.totalTime")}
                value={formatTime(totalMinutes)}
              />
              <QuickStat
                icon={<Type className="h-3.5 w-3.5" />}
                label={t("bookInfo.totalCharacters")}
                value={
                  totalChars > 0
                    ? t("bookInfo.tenThousandChars", { value: (totalChars / 10000).toFixed(1) })
                    : "—"
                }
              />
              <QuickStat
                icon={<Database className="h-3.5 w-3.5" />}
                label={t("bookInfo.readingSpeed")}
                value={speed > 0 ? t("bookInfo.charsPerMinValue", { value: speed }) : "—"}
              />
            </div>

            {/* Progress bar */}
            {progressPct > 0 && (
              <div className="px-6 pb-5">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{t("bookInfo.progress")}</span>
                  <span className="font-medium text-foreground">{progressPct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                {book.meta.totalPages && (
                  <div className="mt-1 text-[10px] text-muted-foreground/70">
                    {Math.round(book.meta.totalPages * book.progress)} / {book.meta.totalPages} {t("bookInfo.pages")}
                  </div>
                )}
              </div>
            )}

            {/* File info compact */}
            <div className="mx-6 flex flex-wrap gap-1.5 pb-4">
              <InfoChip>{book.format.toUpperCase()}</InfoChip>
              {book.meta.language && <InfoChip>{book.meta.language}</InfoChip>}
              {book.isVectorized && (
                <InfoChip className="text-emerald-600 dark:text-emerald-400">
                  AI ✓
                </InfoChip>
              )}
              {book.tags.slice(0, 3).map((tag) => (
                <InfoChip key={tag}>#{tag}</InfoChip>
              ))}
            </div>
          </div>

          {/* ─── Right content — scrollable tabs ─── */}
          <div className="flex-1 overflow-hidden">
            <Tabs.Root
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex h-full flex-col"
            >
              <Tabs.List className="flex shrink-0 gap-1 border-b border-border/60 px-6 pt-1">
                {(["overview", "reading", "notes"] as const).map((tab) => (
                  <Tabs.Trigger
                    key={tab}
                    value={tab}
                    className="group relative rounded-t-md px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground data-[state=active]:text-foreground"
                  >
                    {t(`bookInfo.tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
                    <span className="absolute inset-x-2 -bottom-px h-0.5 scale-x-0 rounded-full bg-primary transition-transform duration-200 group-data-[state=active]:scale-x-100" />
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              <div className="flex-1 overflow-y-auto">
                <Tabs.Content
                  value="overview"
                  className="animate-in fade-in-0 duration-200 p-6"
                >
                  <BookOverviewTab book={book} />
                </Tabs.Content>
                <Tabs.Content
                  value="reading"
                  className="animate-in fade-in-0 duration-200 p-6"
                >
                  <BookReadingTab book={book} />
                </Tabs.Content>
                <Tabs.Content
                  value="notes"
                  className="animate-in fade-in-0 duration-200 p-6"
                >
                  <BookNotesTab book={book} />
                </Tabs.Content>
              </div>
            </Tabs.Root>
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  );
}

/* ─── Sub-components ─── */

function QuickStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/40 px-2 py-2.5 transition-colors hover:bg-muted/70">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
      <span className="text-[10px] leading-tight text-muted-foreground text-center">
        {label}
      </span>
    </div>
  );
}

function InfoChip({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground ${className}`}
    >
      {children}
    </span>
  );
}
