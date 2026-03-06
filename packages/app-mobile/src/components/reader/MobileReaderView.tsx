/**
 * MobileReaderView — main mobile reader page.
 *
 * Loads book file → DocumentLoader → MobileFoliateViewer → foliate-js.
 * Manages progress, controls visibility, toolbar/footer, search, selection, reading session.
 */
import { getPlatformService } from "@readany/core/services";
import { throttle } from "@readany/core/utils/throttle";
import { useReadingSession } from "@readany/core/hooks/use-reading-session";
import { useAnnotationStore } from "@readany/core/stores/annotation-store";
import { useNotebookStore } from "@readany/core/stores/notebook-store";
import type { HighlightColor } from "@readany/core/types";
import { useTTSStore } from "@readany/core/stores/tts-store";
import { useSettingsStore } from "@readany/core/stores/settings-store";
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
import { MobileNotebookPanel } from "./MobileNotebookPanel";
import { MobileTTSControls } from "./MobileTTSControls";
import { MobileTranslationPanel } from "./MobileTranslationPanel";

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
      return new Blob([fileBytes as unknown as BlobPart]);
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

// Mobile-specific defaults (slightly different from desktop)
const MOBILE_DEFAULTS: ViewSettings = {
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

  // Settings persistence
  const readSettings = useSettingsStore((s) => s.readSettings);
  const updateReadSettings = useSettingsStore((s) => s.updateReadSettings);

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
  const [showNotebook, setShowNotebook] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [chapterTitle, setChapterTitle] = useState("");

  // Annotation store
  const {
    highlights,
    addHighlight,
    removeHighlight,
    loadAnnotations,
  } = useAnnotationStore();

  // Notebook store
  const { startNewNote } = useNotebookStore();

  // Selection state
  const [selection, setSelection] = useState<BookSelection | null>(null);

  // TTS state
  const [showTTS, setShowTTS] = useState(false);
  const ttsPlay = useTTSStore((s) => s.play);
  const ttsStop = useTTSStore((s) => s.stop);
  const ttsSetOnEnd = useTTSStore((s) => s.setOnEnd);
  const ttsContinuousRef = useRef(false);

  // Translation state
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationText, setTranslationText] = useState("");

  // Search state
  const [searchResults, setSearchResults] = useState<{ cfi: string; excerpt: string }[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const searchAbortRef = useRef(false);

  // History navigation stack (for "go back to previous location")
  const locationHistoryRef = useRef<string[]>([]);
  const lastCfiRef = useRef<string>("");

  // View settings (persisted via settings store, merged with mobile defaults)
  const viewSettings: ViewSettings = {
    ...MOBILE_DEFAULTS,
    fontSize: readSettings.fontSize || MOBILE_DEFAULTS.fontSize,
    lineHeight: readSettings.lineHeight || MOBILE_DEFAULTS.lineHeight,
    fontTheme: readSettings.fontTheme || MOBILE_DEFAULTS.fontTheme,
    viewMode: readSettings.viewMode || MOBILE_DEFAULTS.viewMode,
    paragraphSpacing: readSettings.paragraphSpacing ?? MOBILE_DEFAULTS.paragraphSpacing,
    pageMargin: readSettings.pageMargin ?? MOBILE_DEFAULTS.pageMargin,
  };

  // Reading session tracking (2.7)
  useReadingSession(bookId ?? null);

  // Clean up TTS on unmount
  useEffect(() => {
    return () => {
      ttsContinuousRef.current = false;
      ttsSetOnEnd(null);
      ttsStop();
    };
  }, [ttsStop, ttsSetOnEnd]);

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
    if (showToc || showSettings || showSearch || showNotebook) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setControlsVisible(true);
    } else {
      scheduleHide();
    }
  }, [showToc, showSettings, showSearch, showNotebook, scheduleHide]);

  // Load annotations when book opens
  useEffect(() => {
    if (bookId) {
      loadAnnotations(bookId);
    }
  }, [bookId, loadAnnotations]);

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
      updateReadSettings(updates);
    },
    [updateReadSettings],
  );

  // --- Selection handlers ---
  const handleSelection = useCallback((detail: SelectionDetail | null) => {
    if (!detail) {
      setSelection(null);
      return;
    }

    const existingHighlight = highlights.find(
      (h) => h.cfi === detail.cfi || (h.text && h.text === detail.text),
    );

    setSelection({
      text: detail.text,
      cfi: detail.cfi,
      range: detail.range,
      position: detail.position,
      annotated: !!existingHighlight,
      annotationId: existingHighlight?.id,
      color: existingHighlight?.color,
    });
  }, [highlights]);

  const handleHighlight = useCallback(
    (color: string) => {
      if (!selection || !bookId) return;

      const highlightId = crypto.randomUUID();
      addHighlight({
        id: highlightId,
        bookId,
        cfi: selection.cfi,
        text: selection.text,
        color: color as HighlightColor,
        chapterTitle,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      setSelection(null);
    },
    [selection, bookId, chapterTitle, addHighlight],
  );

  const handleNote = useCallback(() => {
    if (!selection || !bookId) return;

    startNewNote({
      text: selection.text,
      cfi: selection.cfi,
      chapterTitle,
    });

    setSelection(null);
    setShowNotebook(true);
  }, [selection, bookId, chapterTitle, startNewNote]);

  const handleCopy = useCallback(() => {
    if (!selection) return;
    navigator.clipboard.writeText(selection.text).catch(() => {});
    setSelection(null);
  }, [selection]);

  const handleTranslate = useCallback(() => {
    if (!selection) return;
    setTranslationText(selection.text);
    setShowTranslation(true);
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
    ttsContinuousRef.current = false;
    ttsSetOnEnd(null);
    setShowTTS(true);
    ttsPlay(selection.text);
    setSelection(null);
  }, [selection, ttsPlay, ttsSetOnEnd]);

  // Continuous TTS — auto-flip pages
  const handleTTSPageEnd = useCallback(() => {
    if (!ttsContinuousRef.current) return;
    foliateRef.current?.goNext();
    setTimeout(() => {
      if (!ttsContinuousRef.current) return;
      const text = foliateRef.current?.getVisibleText();
      if (text?.trim()) {
        ttsPlay(text);
      } else {
        ttsContinuousRef.current = false;
        ttsStop();
        setShowTTS(false);
      }
    }, 600);
  }, [ttsPlay, ttsStop]);

  const handleToggleTTS = useCallback(() => {
    if (showTTS) {
      ttsContinuousRef.current = false;
      ttsSetOnEnd(null);
      ttsStop();
      setShowTTS(false);
    } else {
      const text = foliateRef.current?.getVisibleText();
      if (text) {
        ttsContinuousRef.current = true;
        ttsSetOnEnd(handleTTSPageEnd);
        setShowTTS(true);
        ttsPlay(text);
      }
    }
  }, [showTTS, ttsPlay, ttsStop, ttsSetOnEnd, handleTTSPageEnd]);

  const handleRemoveHighlight = useCallback(() => {
    if (!selection?.annotationId) return;

    removeHighlight(selection.annotationId);
    setSelection(null);
  }, [selection, removeHighlight]);

  const handleDismissSelection = useCallback(() => {
    setSelection(null);
  }, []);

  // Lock paginator navigation while a selection is active
  useEffect(() => {
    foliateRef.current?.setNavigationLocked(!!selection);
  }, [selection]);

  // --- Annotation click handler (tap on existing highlight) ---
  const handleShowAnnotation = useCallback(
    (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const { value, range } = detail;
      if (!value || !range) return;

      const highlight = highlights.find(
        (h) => h.bookId === bookId && h.cfi === value,
      );
      if (!highlight) return;

      // Get position from range for popover
      const boundingRect = range.getBoundingClientRect();
      const rects = Array.from(range.getClientRects()).filter((r: DOMRect) => r.width > 0 && r.height > 0);
      const iframe = (range.startContainer?.ownerDocument as Document)?.defaultView?.frameElement as HTMLIFrameElement | null;
      const iframeRect = iframe?.getBoundingClientRect();
      const offsetX = iframeRect?.left ?? 0;
      const offsetY = iframeRect?.top ?? 0;

      let minTop = boundingRect.top;
      let maxBottom = boundingRect.bottom;
      for (const r of rects) {
        if (r.top < minTop) minTop = r.top;
        if (r.bottom > maxBottom) maxBottom = r.bottom;
      }

      setSelection({
        text: highlight.text,
        cfi: value,
        range,
        position: {
          x: offsetX + boundingRect.left + boundingRect.width / 2,
          y: offsetY + minTop - 8,
          selectionTop: offsetY + minTop,
          selectionBottom: offsetY + maxBottom,
        },
        annotated: true,
        annotationId: highlight.id,
        color: highlight.color,
      });
    },
    [highlights, bookId],
  );

  // --- Citation navigation with flash highlight ---
  const flashCitationCfi = useCallback(
    (cfi: string) => {
      const view = foliateRef.current?.getView();
      if (!view) return;

      foliateRef.current?.goToCFI(cfi);

      // Flash highlight effect — add temporary annotation then remove
      let flashCount = 0;
      const maxFlashes = 4;
      const flashInterval = setInterval(() => {
        flashCount++;
        if (flashCount > maxFlashes) {
          clearInterval(flashInterval);
          try { view.addAnnotation?.({ value: cfi }, true); } catch { /* ignore */ }
          try {
            // Remove the flash annotation
            setTimeout(() => {
              try { view.addAnnotation?.({ value: cfi }, true); } catch { /* ignore */ }
            }, 300);
          } catch { /* ignore */ }
          return;
        }
      }, 200);
    },
    [],
  );

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
        ttsActive={showTTS}
        chatActive={showChat}
        onBack={handleGoBack}
        onToggleToc={() => setShowToc(true)}
        onToggleSettings={() => setShowSettings(true)}
        onToggleSearch={() => {
          setShowSearch(true);
          setControlsVisible(true);
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        }}
        onToggleNotebook={() => setShowNotebook(true)}
        onToggleTTS={handleToggleTTS}
        onToggleChat={() => setShowChat((prev) => !prev)}
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
            onShowAnnotation={handleShowAnnotation}
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
            flashCitationCfi(citation.cfi);
          }
        }}
      />

      {/* TTS Controls */}
      {showTTS && (
        <MobileTTSControls
          onClose={() => {
            ttsContinuousRef.current = false;
            ttsSetOnEnd(null);
            ttsStop();
            setShowTTS(false);
          }}
        />
      )}

      {/* Translation Panel */}
      {showTranslation && translationText && (
        <MobileTranslationPanel
          text={translationText}
          onClose={() => {
            setShowTranslation(false);
            setTranslationText("");
          }}
        />
      )}

      {/* Notebook Panel */}
      <MobileNotebookPanel
        bookId={bookId!}
        bookTitle={book?.meta.title || ""}
        open={showNotebook}
        onClose={() => setShowNotebook(false)}
        onGoToCfi={(cfi) => {
          foliateRef.current?.goToCFI(cfi);
        }}
      />
    </div>
  );
}
