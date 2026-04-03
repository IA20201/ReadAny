/**
 * HighlightPickerDialog — pick a highlight from the current book and insert it into
 * the Tiptap knowledge-note editor as a styled block-quote.
 *
 * Inserted as a Tiptap blockquote node:
 *   > ${text}
 *   > — *${chapterTitle}*
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAnnotationStore } from "@/stores/annotation-store";
import type { Editor } from "@tiptap/react";
import { BookmarkIcon, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface HighlightPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editor: Editor | null;
  bookId: string;
}

export function HighlightPickerDialog({ open, onOpenChange, editor, bookId }: HighlightPickerDialogProps) {
  const { t } = useTranslation();
  const { highlights, loadAnnotations } = useAnnotationStore();
  const [query, setQuery] = useState("");

  // Load highlights for this book when dialog opens
  useEffect(() => {
    if (open && bookId) {
      loadAnnotations(bookId);
    }
  }, [open, bookId, loadAnnotations]);

  const bookHighlights = useMemo(
    () => highlights.filter((h) => h.bookId === bookId),
    [highlights, bookId],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return bookHighlights;
    return bookHighlights.filter(
      (h) =>
        h.text.toLowerCase().includes(q) ||
        (h.chapterTitle ?? "").toLowerCase().includes(q) ||
        (h.note ?? "").toLowerCase().includes(q),
    );
  }, [bookHighlights, query]);

  const handleInsert = (text: string, chapterTitle?: string, note?: string, color?: string) => {
    if (!editor) return;

    editor
      .chain()
      .focus()
      .insertContent({
        type: "highlightRef",
        attrs: {
          text,
          chapterTitle: chapterTitle ?? "",
          note: note ?? "",
          color: color ?? "",
        },
      })
      .run();

    onOpenChange(false);
    setQuery("");
  };

  const colorDot: Record<string, string> = {
    yellow: "bg-yellow-400",
    red: "bg-red-400",
    blue: "bg-blue-400",
    green: "bg-green-400",
    purple: "bg-purple-400",
    orange: "bg-orange-400",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[70vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-0 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <BookmarkIcon className="h-4 w-4 text-primary" />
            {t("knowledge.insertHighlight")}
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-4 py-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              placeholder={t("knowledge.searchHighlights")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              {t("knowledge.noHighlightsFound")}
            </p>
          ) : (
            filtered.map((h) => (
              <button
                key={h.id}
                type="button"
                className="w-full text-left rounded-md border border-border/40 bg-background px-3 py-2 hover:bg-muted/60 transition-colors group"
                onClick={() => handleInsert(h.text, h.chapterTitle, h.note, h.color)}
              >
                <div className="flex items-start gap-2">
                  {/* Color indicator */}
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${colorDot[h.color] ?? "bg-muted-foreground"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground leading-relaxed line-clamp-3">{h.text}</p>
                    {h.chapterTitle && (
                      <p className="mt-1 text-[10px] text-muted-foreground truncate">
                        — {h.chapterTitle}
                      </p>
                    )}
                    {h.note && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70 line-clamp-1 italic">
                        {h.note}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/40 px-4 py-2 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              onOpenChange(false);
              setQuery("");
            }}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
