/**
 * MobileReaderView — main mobile reader page.
 *
 * Loads book file → DocumentLoader → MobileFoliateViewer → foliate-js.
 * Manages progress, controls visibility, toolbar/footer, search, selection, reading session.
 */
import { getPlatformService } from "@readany/core/services";
import { throttle } from "@readany/core/utils/throttle";
import { useReadingSession } from "@readany/core/hooks/use-reading-session";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { useLibraryStore } from "@/stores/library-store";
import { DocumentLoader } from "@/lib/reader/document-loader";
import type { BookDoc, BookFormat } from "@/lib/reader/document-loader";
import { isFixedLayoutFormat } from "@/lib/reader/document-loader";
import type { ViewSettings } from "@readany/core/types";
import {
  MobileFoliateViewer,
  type MobileFoliateViewerHandle,
  type MobileTOCItem,
  type RelocateDetail,
  type SelectionDetail,
} from "./MobileFoliateViewer";
import { MobileReaderToolbar } from "./MobileReaderToolbar";
import { MobileFooterBar } from "./MobileFooterBar";
import { MobileTOCPanel } from "./MobileTOCPanel";
import { MobileReadSettings } from "./MobileReadSettings";
import { MobileSelectionPopover, type BookSelection } from "./MobileSelectionPopover";
import { MobileSearchBar } from "./MobileSearchBar";
import { MobileChatPanel } from "@/components/chat/MobileChatPanel";

// --- File loading ---
/**
 * Resolve a relative filePath (e.g. "books/xxx.epub") to absolute path under appDataDir,
 * then load as Blob. We never store absolute paths because iOS changes the sandbox UUID.
 */
async function loadFileAsBlob(filePath: string): Promise<Blob> {
  const platform = getPlatformService();

  // Resolve relative path → absolute path at runtime
  const isRelative = !filePath.startsWith("/");
  let absPath = filePath;
  if (isRelative) {
    const appData = await platform.getAppDataDir();
    const { join } = await import("@tauri-apps/api/path");
    absPath = await join(appData, filePath);
  }

  console.log("[loadFileAsBlob] Loading:", filePath, "→ abs:", absPath);

  try {
    const { convertFileSrc } = await import("@tauri-apps/api/core");
    const assetUrl = convertFileSrc(absPath);
    const response = await fetch(assetUrl);
    if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
    const blob = await response.blob();
    console.log("[loadFileAsBlob] Loaded via asset protocol, size:", blob.size);
    return blob;
  } catch (err1) {
    console.warn("[loadFileAsBlob] Asset protocol failed:", err1);
    try {
      const fileBytes = await platform.readFile(absPath);
      console.log("[loadFileAsBlob] Loaded via readFile, size:", fileBytes.length);
      return new Blob([fileBytes]);
    } catch (err2) {
      console.error("[loadFileAsBlob] readFile also failed:", err2);
      throw err2;
    }
  }
}

// Blob cache
const fileBlobCache = new Map<string, Blob>();
const MAX_CACHE = 3;

async function getCachedBlob(filePath: string): Promise<Blob> {
  const cached = fileBlobCache.get(filePath);
  if (cached) return cached;
  const blob = await loadFileAsBlob(filePath);
  if (fileBlobCache.size >= MAX_CACHE) {
    const firstKey = fileBlobCache.keys().next().value;
    if (firstKey) fileBlobCache.delete(firstKey);
  }
  fileBlobCache.set(filePath, blob);
  return blob;
}

async function loadAndParseBook(filePath: string): Promise<{ bookDoc: BookDoc; format: BookFormat }> {
  const blob = await getCachedBlob(filePath);
  const fileName = filePath.split("/").pop() || "book.epub";
  const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
  const loader = new DocumentLoader(file);
  const { book, format } = await loader.open();
  return { bookDoc: book, format };
}

// Default view settings
const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  fontSize: 18,
  lineHeight: 1.8,
  fontTheme: "default",
  viewMode: "paginated",
  paragraphSpacing: 8,
  pageMargin: 16,
};

export function MobileReaderView() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const books = useLibraryStore((s) => s.books);
  const updateBook = useLibraryStore((s) => s.updateBook);
  const book = books.find((b) => b.id === bookId);

  const foliateRef = useRef<MobileFoliateViewerHandle>(null);

  // Book state
  const [bookDoc, setBookDoc] = useState<BookDoc | null>(null);
  const [bookFormat, setBookFormat] = useState<BookFormat>("EPUB");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [controlsVisible, setControlsVisible] = useState(true);
  const [tocItems, setTocItems] = useState<MobileTOCItem[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [chapterTitle, setChapterTitle] = useState("");

  // Selection state
  const [selection, setSelection] = useState<BookSelection | null>(null);

  // Search state
  const [searchResults, setSearchResults] = useState<{ cfi: string; excerpt: string }[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const searchAbortRef = useRef(false);

  // History navigation stack (for "go back to previous location")
  const locationHistoryRef = useRef<string[]>([]);
  const lastCfiRef = useRef<string>("");

  // View settings (local state)
  const [viewSettings, setViewSettings] = useState<ViewSettings>(DEFAULT_VIEW_SETTINGS);

  // Reading session tracking (2.7)
  useReadingSession(bookId ?? null);

  // Auto-hide timer
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  const toggleControls = useCallback(() => {
    setControlsVisible((prev) => {
      if (!prev) {
        scheduleHide();
        return true;
      }
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      return false;
    });
  }, [scheduleHide]);

  // Show controls initially then auto-hide
  useEffect(() => {
    scheduleHide();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [scheduleHide]);

  // Keep controls visible when panels are open
  useEffect(() => {
    if (showToc || showSettings || showSearch) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setControlsVisible(true);
    } else {
      scheduleHide();
    }
  }, [showToc, showSettings, showSearch, scheduleHide]);

  // Throttled progress save
  const throttledSaveProgress = useRef(
    throttle((bId: string, prog: number, cfi: string) => {
      updateBook(bId, { progress: prog, currentCfi: cfi, lastOpenedAt: Date.now() });
    }, 5000),
  ).current;

  // Load book
  const isInitRef = useRef(false);
  useEffect(() => {
    if (!book?.filePath || isInitRef.current) return;
    isInitRef.current = true;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const { bookDoc: bd, format: fmt } = await loadAndParseBook(book.filePath!);
        setBookDoc(bd);
        setBookFormat(fmt);
      } catch (err) {
        console.error("[MobileReaderView] Load failed:", err);
        setError(err instanceof Error ? err.message : "Failed to load book");
        setIsLoading(false);
      }
    })();

    return () => { isInitRef.current = false; };
  }, [book?.filePath]);

  // Relocate handler
  const handleRelocate = useCallback(
    (detail: RelocateDetail) => {
      if (!bookId) return;
      const prog = detail.fraction ?? 0;
      const cfi = detail.cfi || "";
      setProgress(prog);

      if (detail.tocItem?.label) {
        setChapterTitle(detail.tocItem.label);
      }

      // Track CFI for history navigation
      if (cfi && lastCfiRef.current && cfi !== lastCfiRef.current) {
        // Only push to history if the jump was significant (not just next page)
        const fractionDiff = Math.abs(prog - (detail.fraction ?? 0));
        if (fractionDiff > 0.02 || locationHistoryRef.current.length === 0) {
          locationHistoryRef.current.push(lastCfiRef.current);
          if (locationHistoryRef.current.length > 50) {
            locationHistoryRef.current.shift();
          }
        }
      }
      lastCfiRef.current = cfi;

      // Page tracking
      if (isFixedLayoutFormat(bookFormat) && detail.section) {
        setTotalPages(detail.section.total);
        setCurrentPage(detail.section.current + 1);
      } else if (detail.location) {
        const { current, total } = detail.location;
        const view = foliateRef.current?.getView();
        const atEnd = view?.renderer?.atEnd || false;
        setTotalPages(total);
        setCurrentPage(atEnd && total > 0 ? total : current + 1);
      }

      throttledSaveProgress(bookId, prog, cfi);
    },
    [bookId, bookFormat, throttledSaveProgress],
  );

  const handleTocReady = useCallback((toc: MobileTOCItem[]) => setTocItems(toc), []);
  const handleLoaded = useCallback(() => setIsLoading(false), []);
  const handleSectionLoad = useCallback((_index: number) => {}, []);
  const handleError = useCallback((err: Error) => {
    setError(err.message);
    setIsLoading(false);
  }, []);

  const handleGoBack = useCallback(() => {
    navigate("/library", { replace: true });
  }, [navigate]);

  const handleGoToChapter = useCallback(
    (href: string) => {
      // Push current location to history before jumping
      if (lastCfiRef.current) {
        locationHistoryRef.current.push(lastCfiRef.current);
      }
      foliateRef.current?.goToHref(href);
      setShowToc(false);
    },
    [],
  );

  const handleNavPrev = useCallback(() => foliateRef.current?.goPrev(), []);
  const handleNavNext = useCallback(() => foliateRef.current?.goNext(), []);

  const handleSliderChange = useCallback(
    (value: number) => {
      if (lastCfiRef.current) {
        locationHistoryRef.current.push(lastCfiRef.current);
      }
      foliateRef.current?.goToFraction(value);
    },
    [],
  );

  const handleUpdateSettings = useCallback(
    (updates: Partial<ViewSettings>) => {
      setViewSettings((prev) => ({ ...prev, ...updates }));
    },
    [],
  );

  // --- Selection handlers ---
  const handleSelection = useCallback((detail: SelectionDetail | null) => {
    if (!detail) {
      setSelection(null);
      return;
    }
    setSelection({
      text: detail.text,
      cfi: detail.cfi,
      range: detail.range,
      position: detail.position,
    });
  }, []);

  const handleHighlight = useCallback(
    (color: string) => {
      if (!selection) return;
      // TODO: integrate with annotation store when available
      console.log("[MobileReaderView] Highlight:", color, selection.cfi);
      setSelection(null);
    },
    [selection],
  );

  const handleNote = useCallback(() => {
    if (!selection) return;
    // TODO: open note editor when available
    console.log("[MobileReaderView] Note:", selection.text.slice(0, 50));
    setSelection(null);
  }, [selection]);

  const handleCopy = useCallback(() => {
    if (!selection) return;
    navigator.clipboard.writeText(selection.text).catch(() => {});
    setSelection(null);
  }, [selection]);

  const handleTranslate = useCallback(() => {
    if (!selection) return;
    // TODO: integrate with translation service
    console.log("[MobileReaderView] Translate:", selection.text.slice(0, 50));
    setSelection(null);
  }, [selection]);

  const handleAskAI = useCallback(() => {
    if (!selection) return;
    // Store selected text for the chat panel to pick up
    if (bookId) {
      sessionStorage.setItem(
        `pending-ai-quote-${bookId}`,
        JSON.stringify({
          selectedText: selection.text,
          bookId,
          chapterTitle: chapterTitle,
        }),
      );
    }
    setSelection(null);
    setShowChat(true);
  }, [selection, bookId, chapterTitle]);

  const handleSpeak = useCallback(() => {
    if (!selection) return;
    // TODO: integrate with TTS service
    console.log("[MobileReaderView] Speak:", selection.text.slice(0, 50));
    setSelection(null);
  }, [selection]);

  const handleRemoveHighlight = useCallback(() => {
    if (!selection?.annotationId) return;
    // TODO: remove from annotation store
    console.log("[MobileReaderView] Remove highlight:", selection.annotationId);
    setSelection(null);
  }, [selection]);

  const handleDismissSelection = useCallback(() => {
    setSelection(null);
  }, []);

  // --- Search handlers ---
  const handleSearch = useCallback(
    async (query: string) => {
      if (!query) {
        setSearchResults([]);
        setSearchIndex(0);
        foliateRef.current?.clearSearch();
        return;
      }

      searchAbortRef.current = false;
      setIsSearching(true);
      setSearchResults([]);
      setSearchIndex(0);

      try {
        const gen = foliateRef.current?.search(query);
        if (!gen) {
          setIsSearching(false);
          return;
        }

        const results: { cfi: string; excerpt: string }[] = [];
        for await (const result of gen) {
          if (searchAbortRef.current) break;
          results.push(result);
          setSearchResults([...results]);
        }

        if (results.length > 0) {
          foliateRef.current?.goToCFI(results[0].cfi);
          setSearchIndex(0);
        }
      } catch (err) {
        console.error("[MobileReaderView] Search error:", err);
      } finally {
        setIsSearching(false);
      }
    },
    [],
  );

  const handleSearchNavigate = useCallback(
    (direction: "prev" | "next") => {
      if (searchResults.length === 0) return;
      let newIndex: number;
      if (direction === "next") {
        newIndex = (searchIndex + 1) % searchResults.length;
      } else {
        newIndex = (searchIndex - 1 + searchResults.length) % searchResults.length;
      }
      setSearchIndex(newIndex);
      foliateRef.current?.goToCFI(searchResults[newIndex].cfi);
    },
    [searchResults, searchIndex],
  );

  const handleSearchClose = useCallback(() => {
    searchAbortRef.current = true;
    setShowSearch(false);
    setSearchResults([]);
    setSearchIndex(0);
    foliateRef.current?.clearSearch();
  }, []);

  // Error / Not found
  if (!bookId || (!book && !isLoading)) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center px-8">
          <p className="text-sm text-muted-foreground mb-4">{t("reader.noBookFile", { bookId: bookId || "" })}</p>
          <button
            type="button"
            className="rounded-full bg-primary px-6 py-2 text-sm text-primary-foreground"
            onClick={handleGoBack}
          >
            {t("common.back")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-background">
      {/* Toolbar */}
      <MobileReaderToolbar
        visible={controlsVisible && !showSearch}
        title={book?.meta.title || ""}
        chapterTitle={chapterTitle}
        onBack={handleGoBack}
        onToggleToc={() => setShowToc(true)}
        onToggleSettings={() => setShowSettings(true)}
        onToggleSearch={() => {
          setShowSearch(true);
          setControlsVisible(true);
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        }}
      />

      {/* Search Bar */}
      {showSearch && (
        <MobileSearchBar
          onSearch={handleSearch}
          onNavigate={handleSearchNavigate}
          onClose={handleSearchClose}
          currentIndex={searchIndex}
          totalResults={searchResults.length}
          isSearching={isSearching}
        />
      )}

      {/* Book content */}
      <div className="relative flex-1 overflow-hidden">
        {bookDoc ? (
          <MobileFoliateViewer
            ref={foliateRef}
            bookKey={bookId!}
            bookDoc={bookDoc}
            format={bookFormat}
            viewSettings={viewSettings}
            lastLocation={book?.currentCfi || undefined}
            onRelocate={handleRelocate}
            onTocReady={handleTocReady}
            onLoaded={handleLoaded}
            onSectionLoad={handleSectionLoad}
            onError={handleError}
            onTapCenter={toggleControls}
            onSelection={handleSelection}
          />
        ) : isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t("reader.loadingBook")}</p>
            </div>
          </div>
        ) : null}

        {/* Error */}
        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-3 px-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <span className="text-lg text-destructive">!</span>
              </div>
              <p className="text-sm font-medium text-destructive">{t("reader.loadFailed")}</p>
              <p className="text-xs text-muted-foreground">{error}</p>
              <button
                type="button"
                className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
                onClick={handleGoBack}
              >
                {t("common.back")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selection Popover */}
      {selection && (
        <MobileSelectionPopover
          selection={selection}
          isPdf={bookFormat === "PDF"}
          onHighlight={handleHighlight}
          onNote={handleNote}
          onCopy={handleCopy}
          onTranslate={handleTranslate}
          onAskAI={handleAskAI}
          onSpeak={handleSpeak}
          onRemoveHighlight={handleRemoveHighlight}
          onDismiss={handleDismissSelection}
        />
      )}

      {/* Footer */}
      <MobileFooterBar
        visible={controlsVisible && !showSearch}
        progress={progress}
        currentPage={currentPage}
        totalPages={totalPages}
        onPrev={handleNavPrev}
        onNext={handleNavNext}
        onSliderChange={handleSliderChange}
      />

      {/* Always-visible thin progress bar just above safe area */}
      <div
        className="absolute left-0 right-0 z-40 h-[2px] bg-muted-foreground/10"
        style={{ bottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div
          className="h-full bg-primary/60 transition-all duration-300 ease-out"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      {/* TOC Panel */}
      {showToc && (
        <MobileTOCPanel
          tocItems={tocItems}
          currentChapter={chapterTitle}
          onGoToChapter={handleGoToChapter}
          onClose={() => setShowToc(false)}
        />
      )}

      {/* Settings Panel */}
      {showSettings && (
        <MobileReadSettings
          settings={viewSettings}
          onUpdate={handleUpdateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* AI Chat Panel */}
      <MobileChatPanel
        book={book || null}
        open={showChat}
        onClose={() => setShowChat(false)}
        onNavigateToCitation={(citation) => {
          setShowChat(false);
          if (citation.cfi) {
            viewerRef.current?.goToCfi(citation.cfi);
          }
        }}
      />
    </div>
  );
}
