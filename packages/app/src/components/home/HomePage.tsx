/**
 * HomePage — library page
 */
import { DesktopImportActions } from "@/components/home/DesktopImportActions";
import { SyncButton } from "@/components/ui/SyncButton";
import { triggerVectorizeBook } from "@/lib/rag/vectorize-trigger";
import { useLibraryStore } from "@/stores/library-store";
import { CheckCheck, Database, Hash, Loader2, Plus, Trash2, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookGrid } from "./BookGrid";
import { ImportDropZone } from "./ImportDropZone";

export function HomePage() {
  const { t } = useTranslation();
  const { books, filter, activeTag, isImporting, removeBook, addTagToBook, addTag, allTags } = useLibraryStore();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());
  const [showBatchTagMenu, setShowBatchTagMenu] = useState(false);
  const [batchNewTagInput, setBatchNewTagInput] = useState("");

  const filtered = books.filter((b) => {
    if (activeTag === "__uncategorized__") {
      if (b.tags.length > 0) return false;
    } else if (activeTag && !b.tags.includes(activeTag)) {
      return false;
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      return b.meta.title.toLowerCase().includes(q) || b.meta.author?.toLowerCase().includes(q);
    }
    return true;
  });

  const toggleBookSelection = useCallback((bookId: string) => {
    setSelectedBookIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedBookIds(new Set());
    setShowBatchTagMenu(false);
  }, []);

  const isAllSelected = filtered.length > 0 && selectedBookIds.size === filtered.length;

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedBookIds(new Set());
    } else {
      setSelectedBookIds(new Set(filtered.map((b) => b.id)));
    }
  }, [filtered, isAllSelected]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedBookIds.size === 0) return;
    if (!confirm(t("library.batchDeleteConfirm", `确定要删除选中的 ${selectedBookIds.size} 本书吗？`))) return;
    for (const id of selectedBookIds) {
      await removeBook(id);
    }
    exitSelectionMode();
  }, [selectedBookIds, removeBook, exitSelectionMode, t]);

  const handleBatchVectorize = useCallback(async () => {
    if (selectedBookIds.size === 0) return;
    const selectedBooks = books.filter((b) => selectedBookIds.has(b.id));
    for (const book of selectedBooks) {
      triggerVectorizeBook(book.id, book.filePath);
    }
    exitSelectionMode();
  }, [selectedBookIds, books, exitSelectionMode]);

  const handleBatchAddTag = useCallback((tag: string) => {
    for (const id of selectedBookIds) {
      addTagToBook(id, tag);
    }
  }, [selectedBookIds, addTagToBook]);

  if (books.length === 0) {
    return <ImportDropZone />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-2">
        {selectionMode ? (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full p-1.5 hover:bg-muted"
                onClick={exitSelectionMode}
              >
                <X className="size-5" />
              </button>
              <h1 className="text-lg font-semibold text-foreground">
                {t("library.selectedCount", { count: selectedBookIds.size, defaultValue: `已选 ${selectedBookIds.size} 本` })}
              </h1>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                title={t("library.selectAll", "全选")}
                onClick={toggleSelectAll}
              >
                <CheckCheck className={`size-4 ${isAllSelected ? "text-primary" : ""}`} />
              </button>
              <div className="relative">
                <button
                  type="button"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  title={t("home.manageTags", "标签")}
                  onClick={() => setShowBatchTagMenu(!showBatchTagMenu)}
                >
                  <Hash className="size-4" />
                </button>
                {showBatchTagMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowBatchTagMenu(false)} />
                    <div className="absolute right-0 top-full z-50 mt-1 min-w-36 max-h-52 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
                      {allTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted"
                          onClick={() => handleBatchAddTag(tag)}
                        >
                          <span className="truncate">{tag}</span>
                        </button>
                      ))}
                      <div className="mt-1 border-t pt-1">
                        <div className="flex items-center gap-1 px-1">
                          <Plus className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <input
                            type="text"
                            className="w-full bg-transparent px-1 py-1 text-xs outline-none placeholder:text-muted-foreground"
                            placeholder={t("sidebar.tagPlaceholder")}
                            value={batchNewTagInput}
                            onChange={(e) => setBatchNewTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter" && batchNewTagInput.trim()) {
                                addTag(batchNewTagInput.trim());
                                handleBatchAddTag(batchNewTagInput.trim());
                                setBatchNewTagInput("");
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                title={t("home.vec_vectorize", "向量化")}
                onClick={handleBatchVectorize}
              >
                <Database className="size-4" />
              </button>
              <button
                type="button"
                className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                title={t("common.delete", "删除")}
                onClick={handleBatchDelete}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-foreground">
                {activeTag === "__uncategorized__"
                  ? t("sidebar.uncategorized")
                  : activeTag || t("home.library")}
              </h1>
              <SyncButton />
            </div>
            <div className="flex items-center gap-2">
              {books.length > 0 && (
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                  onClick={() => setSelectionMode(true)}
                >
                  {t("library.select", "选择")}
                </button>
              )}
              <DesktopImportActions align="end">
                <button
                  id="tour-add-book"
                  type="button"
                  disabled={isImporting}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {isImporting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  {isImporting ? t("library.importing", "导入中...") : t("home.addBook")}
                </button>
              </DesktopImportActions>
            </div>
          </>
        )}
      </div>

      {/* Search result hint */}
      {filter.search && (
        <div className="px-6 pb-2">
          {filtered.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("home.foundBooks", { count: filtered.length, query: filter.search })}
            </p>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t("home.noBooksFound", { query: filter.search })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t("home.tryDifferentSearch")}</p>
            </div>
          )}
        </div>
      )}

      {/* Book display */}
      <div id="tour-book-list" className="flex-1 overflow-y-auto px-6 pb-4">
        <BookGrid
          books={filtered}
          selectionMode={selectionMode}
          selectedBookIds={selectedBookIds}
          onToggleSelect={toggleBookSelection}
        />
      </div>
    </div>
  );
}
