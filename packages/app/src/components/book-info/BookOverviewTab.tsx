/**
 * BookOverviewTab — Description, tags, file info, metadata
 * Rich information display with proper visual hierarchy
 */
import { useLibraryStore } from "@/stores/library-store";
import type { Book } from "@readany/core/types";
import {
  BookOpen,
  Calendar,
  CalendarPlus,
  Clock,
  Database,
  FileText,
  Globe,
  Hash,
  Layers,
  Plus,
  Tag,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface BookOverviewTabProps {
  book: Book;
}

export function BookOverviewTab({ book }: BookOverviewTabProps) {
  const { t } = useTranslation();
  const updateBook = useLibraryStore((s) => s.updateBook);
  const meta = book.meta;

  // Tag management
  const [newTag, setNewTag] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

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
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      {/* Description */}
      {meta.description && (
        <section>
          <SectionHeader title={t("bookInfo.description")} />
          <ExpandableText text={meta.description} maxLines={5} />
        </section>
      )}

      {/* Tags & Subjects — with management */}
      <section>
        <SectionHeader title={t("bookInfo.subjects")} />
        <div className="flex flex-wrap gap-1.5">
          {book.tags.map((tag) => (
            <span
              key={`tag-${tag}`}
              className="group inline-flex items-center gap-1 rounded-full bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary"
            >
              <Tag className="h-3 w-3" />
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="ml-0.5 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary/20"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          {meta.subjects?.filter((s) => !book.tags.includes(s)).map((subj) => (
            <span
              key={`subj-${subj}`}
              className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
            >
              {subj}
            </span>
          ))}
          {/* Add tag */}
          {isAddingTag ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5">
              <input
                ref={tagInputRef}
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTag();
                  if (e.key === "Escape") { setNewTag(""); setIsAddingTag(false); }
                }}
                onBlur={() => { if (!newTag.trim()) setIsAddingTag(false); }}
                className="w-20 border-none bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
                placeholder={t("bookInfo.tagPlaceholder")}
                autoFocus
              />
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsAddingTag(true);
                setTimeout(() => tagInputRef.current?.focus(), 50);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Plus className="h-3 w-3" />
              {t("bookInfo.addTag")}
            </button>
          )}
        </div>
      </section>

      {/* Metadata grid */}
      <section>
        <SectionHeader title={t("bookInfo.fileInfo")} />
        <div className="grid grid-cols-2 gap-2">
          <MetaCard
            icon={FileText}
            label={t("bookInfo.format")}
            value={book.format.toUpperCase()}
          />
          {meta.publisher && (
            <MetaCard
              icon={BookOpen}
              label={t("bookInfo.publisher")}
              value={meta.publisher}
            />
          )}
          {meta.language && (
            <MetaCard
              icon={Globe}
              label={t("bookInfo.language")}
              value={meta.language}
            />
          )}
          {meta.isbn && (
            <MetaCard icon={Hash} label={t("bookInfo.isbn")} value={meta.isbn} />
          )}
          {meta.publishDate && (
            <MetaCard
              icon={Calendar}
              label={t("bookInfo.publishDate")}
              value={meta.publishDate}
            />
          )}
          {meta.totalPages ? (
            <MetaCard
              icon={Layers}
              label={t("bookInfo.pages")}
              value={`${meta.totalPages}`}
            />
          ) : null}
          {meta.totalChapters ? (
            <MetaCard
              icon={BookOpen}
              label={t("bookInfo.chapters")}
              value={`${meta.totalChapters}`}
            />
          ) : null}
          <MetaCard
            icon={Database}
            label="AI"
            value={book.isVectorized ? t("bookInfo.vectorized") : t("bookInfo.notVectorized")}
            accent={book.isVectorized}
          />
          {/* Import date & Last read */}
          <MetaCard
            icon={CalendarPlus}
            label={t("bookInfo.addedAt")}
            value={formatDate(book.addedAt)}
          />
          {book.lastOpenedAt && (
            <MetaCard
              icon={Clock}
              label={t("bookInfo.lastOpened")}
              value={formatDate(book.lastOpenedAt)}
            />
          )}
        </div>
      </section>

      {/* Sync info */}
      <section>
        <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-4 py-3">
          <div
            className={`h-2 w-2 rounded-full ${
              book.syncStatus === "local"
                ? "bg-emerald-500"
                : book.syncStatus === "remote"
                  ? "bg-blue-500"
                  : "bg-amber-500 animate-pulse"
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {book.syncStatus === "local"
              ? t("bookInfo.syncLocal")
              : book.syncStatus === "remote"
                ? t("bookInfo.syncRemote")
                : "Syncing..."}
          </span>
          {book.fileHash && (
            <span className="ml-auto text-[10px] font-mono text-muted-foreground/50">
              {book.fileHash.slice(0, 8)}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

/* ─── Sub-components ─── */

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
      {title}
    </h3>
  );
}

function MetaCard({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/50 px-3.5 py-3 transition-colors hover:bg-card">
      <div className={`mt-0.5 rounded-md p-1.5 ${accent ? "bg-emerald-500/10" : "bg-muted"}`}>
        <Icon className={`h-3.5 w-3.5 ${accent ? "text-emerald-600" : "text-muted-foreground"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          {label}
        </div>
        <div className="mt-0.5 truncate text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}

function ExpandableText({
  text,
  maxLines = 5,
}: {
  text: string;
  maxLines?: number;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const needsExpand = text.length > 300;

  return (
    <div>
      <p
        className="text-sm leading-relaxed text-muted-foreground"
        style={
          !expanded && needsExpand
            ? {
                WebkitLineClamp: maxLines,
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
            : undefined
        }
      >
        {text}
      </p>
      {needsExpand && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs font-medium text-primary/80 transition-colors hover:text-primary"
        >
          {expanded ? t("bookInfo.collapse") : t("bookInfo.expand")}
        </button>
      )}
    </div>
  );
}
