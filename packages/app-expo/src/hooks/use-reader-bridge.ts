import type { TOCItem } from "@readany/core/types";
/**
 * useReaderBridge — encapsulates RN ↔ WebView postMessage communication
 * for the foliate-js reader engine.
 */
import { useCallback, useMemo, useRef } from "react";
import type { WebView } from "react-native-webview";

export interface RelocateEvent {
  fraction?: number;
  section?: { current: number; total: number };
  location?: { current: number; next: number; total: number };
  tocItem?: { label?: string; href?: string; id?: number };
  pageItem?: { label?: string };
  cfi?: string;
  textSnippet?: string;
}

export interface SelectionEvent {
  text: string;
  cfi: string;
  position: {
    x: number;
    y: number;
    selectionTop: number;
    selectionBottom: number;
  };
}

export interface ReaderBridgeCallbacks {
  onRelocate?: (detail: RelocateEvent) => void;
  onTocReady?: (items: TOCItem[]) => void;
  onSelection?: (detail: SelectionEvent) => void;
  onSelectionCleared?: () => void;
  onTap?: () => void;
  onSearchResult?: (index: number, count: number) => void;
  onSearchComplete?: (count: number) => void;
  onError?: (message: string) => void;
  onReady?: () => void;
  onLoaded?: () => void;
  onShowAnnotation?: (detail: {
    value: string;
    range: Range;
    position: { x: number; y: number; selectionTop: number; selectionBottom: number };
  }) => void;
  onNoteTooltip?: (detail: {
    cfi: string;
    note: string;
    position: { x: number; y: number; selectionTop: number; selectionBottom: number };
  }) => void;
  onPageSnippet?: (text: string) => void;
  onBookmarkSnippet?: (text: string) => void;
  onToggleBookmark?: () => void;
}

export function useReaderBridge(callbacks: ReaderBridgeCallbacks) {
  const webViewRef = useRef<WebView>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const pendingVisibleTextResolveRef = useRef<((text: string) => void) | null>(null);
  const pendingChapterParagraphsResolveRef = useRef<
    | ((
        paragraphs: Array<{ id: string; text: string; tagName: string }>,
      ) => void)
    | null
  >(null);

  // ─── Send commands to WebView ───

  const inject = useCallback((code: string) => {
    webViewRef.current?.injectJavaScript(`${code}; true;`);
  }, []);

  const openBook = useCallback(
    (params: {
      uri?: string;
      base64?: string;
      fileName?: string;
      mimeType?: string;
      lastLocation?: string;
      pageMargin?: number;
    }) => {
      const msg = JSON.stringify({ type: "openBook", ...params });
      inject(`handleCommand(${msg})`);
    },
    [inject],
  );

  /**
   * Send a large base64 string to the WebView in chunks.
   * iOS WKWebView cannot fetch() file:// URIs, and a single injectJavaScript
   * call with a multi-MB base64 string may hang or crash. This method splits
   * the base64 data into 512 KB text chunks, sends each as a `base64Chunk`
   * command, then sends a `base64End` command to trigger openBook.
   */
  const openBookChunked = useCallback(
    (params: {
      base64: string;
      fileName?: string;
      mimeType?: string;
      lastLocation?: string;
      pageMargin?: number;
    }) => {
      const { base64, ...rest } = params;
      const CHUNK_SIZE = 512 * 1024; // 512 KB per chunk
      const totalChunks = Math.ceil(base64.length / CHUNK_SIZE);

      // Reset accumulator
      inject('window._b64Chunks = []');

      // Send chunks with a tiny delay between each to avoid flooding the JS thread
      for (let i = 0; i < totalChunks; i++) {
        const chunk = base64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        // Escape any backticks / backslashes in the chunk (base64 only has A-Za-z0-9+/= so this is a no-op in practice)
        const escaped = chunk.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
        inject(`handleCommand({type:"base64Chunk",data:\`${escaped}\`})`);
      }

      // Signal that all chunks have been sent
      const endMsg = JSON.stringify({ type: "base64End", ...rest });
      inject(`handleCommand(${endMsg})`);
    },
    [inject],
  );

  const goNext = useCallback(() => {
    inject("window.goNext()");
  }, [inject]);

  const goPrev = useCallback(() => {
    inject("window.goPrev()");
  }, [inject]);

  const goToFraction = useCallback(
    (fraction: number) => {
      inject(`window.goToProgress(${fraction})`);
    },
    [inject],
  );

  const goToHref = useCallback(
    (href: string) => {
      inject(`window.goToHref(${JSON.stringify(href)})`);
    },
    [inject],
  );

  const goToCFI = useCallback(
    (cfi: string) => {
      inject(`window.goToCFI(${JSON.stringify(cfi)})`);
    },
    [inject],
  );

  const search = useCallback(
    (query: string) => {
      inject(`window.search(${JSON.stringify(query)})`);
    },
    [inject],
  );

  const clearSearch = useCallback(() => {
    inject("window.clearSearch()");
  }, [inject]);

  const navigateSearch = useCallback(
    (index: number) => {
      inject(`window.navigateSearch(${index})`);
    },
    [inject],
  );

  const addAnnotation = useCallback(
    (annotation: { value: string; type?: string; color?: string; note?: string }) => {
      inject(`window.addAnnotation(${JSON.stringify(annotation)})`);
    },
    [inject],
  );

  const removeAnnotation = useCallback(
    (annotation: { value: string }) => {
      inject(`window.removeAnnotation(${JSON.stringify(annotation)})`);
    },
    [inject],
  );

  const highlightCFITemporarily = useCallback(
    (cfi: string, duration = 1000) => {
      inject(`window.addAnnotation(${JSON.stringify({ value: cfi, color: "orange" })})`);
      setTimeout(() => {
        inject(`window.removeAnnotation(${JSON.stringify({ value: cfi })})`);
      }, duration);
    },
    [inject],
  );

  const applySettings = useCallback(
    (settings: {
      fontSize?: number;
      lineHeight?: number;
      paragraphSpacing?: number;
      pageMargin?: number;
      fontTheme?: string;
      viewMode?: string;
      pageTurnStyle?: string;
    }) => {
      const msg = JSON.stringify({ type: "applySettings", settings });
      inject(`handleCommand(${msg})`);
    },
    [inject],
  );

  const setPageTurnStyle = useCallback(
    (style: string) => {
      const msg = JSON.stringify({ type: "setPageTurnStyle", style });
      inject(`handleCommand(${msg})`);
    },
    [inject],
  );

  const setThemeColors = useCallback(
    (colors: { background: string; foreground: string; muted: string; primary?: string }) => {
      const msg = JSON.stringify({ type: "setThemeColors", colors });
      inject(`handleCommand(${msg})`);
    },
    [inject],
  );

  const setNavigationLocked = useCallback(
    (locked: boolean) => {
      inject(`window.setNavigationLocked(${locked})`);
    },
    [inject],
  );

  const requestPageSnippet = useCallback(() => {
    inject("window.requestPageSnippet()");
  }, [inject]);

  const getVisibleText = useCallback(() => {
    return new Promise<string>((resolve) => {
      // Store the resolve function so handleMessage can call it
      pendingVisibleTextResolveRef.current = resolve;

      webViewRef.current?.injectJavaScript(`
        (function() {
          try {
            if (!window.getVisibleText) {
              window.ReactNativeWebView.postMessage(JSON.stringify({type:'visibleText',text:'',error:'getVisibleText not defined'}));
              return;
            }
            var resultStr = window.getVisibleText();
            var result = JSON.parse(resultStr);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type:'visibleText',
              text: result.text || '',
              error: result.error || null,
              debug: result.debug || null
            }));
          } catch(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'visibleText',text:'',error:String(e)}));
          }
        })();
        true;
      `);
      // Resolve with empty string after timeout
      setTimeout(() => {
        if (pendingVisibleTextResolveRef.current === resolve) {
          pendingVisibleTextResolveRef.current = null;
          resolve("");
        }
      }, 2000);
    });
  }, []);

  const flashHighlight = useCallback(
    (cfi: string, color?: string, duration?: number) => {
      const colorArg = color ? `'${color}'` : "null";
      const durationArg = duration ? duration : "null";
      inject(`window.flashHighlight('${cfi}', ${colorArg}, ${durationArg})`);
    },
    [inject],
  );

  const getChapterParagraphs = useCallback(() => {
    return new Promise<Array<{ id: string; text: string; tagName: string }>>((resolve) => {
      pendingChapterParagraphsResolveRef.current = resolve;

      webViewRef.current?.injectJavaScript(`
        (function() {
          try {
            if (window.doGetChapterParagraphs) {
              window.doGetChapterParagraphs();
            } else {
              window.ReactNativeWebView.postMessage(JSON.stringify({type:'chapterParagraphs',paragraphs:[],error:'doGetChapterParagraphs not defined'}));
            }
          } catch(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'chapterParagraphs',paragraphs:[],error:String(e)}));
          }
        })();
        true;
      `);

      // Timeout fallback
      setTimeout(() => {
        if (pendingChapterParagraphsResolveRef.current === resolve) {
          pendingChapterParagraphsResolveRef.current = null;
          resolve([]);
        }
      }, 5000);
    });
  }, []);

  const injectChapterTranslations = useCallback(
    (results: Array<{ paragraphId: string; originalText: string; translatedText: string }>) => {
      const payload = JSON.stringify(results);
      webViewRef.current?.injectJavaScript(`
        (function() {
          try {
            if (window.doInjectChapterTranslations) {
              window.doInjectChapterTranslations(${payload});
            }
          } catch(e) { console.error('[WebView] injectChapterTranslations error:', e); }
        })();
        true;
      `);
    },
    [],
  );

  const removeChapterTranslations = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      (function() {
        try {
          if (window.doRemoveChapterTranslations) {
            window.doRemoveChapterTranslations();
          }
        } catch(e) { console.error('[WebView] removeChapterTranslations error:', e); }
      })();
      true;
    `);
  }, []);

  // ─── Handle messages from WebView ───

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      const cb = callbacksRef.current;

      switch (msg.type) {
        case "ready":
          cb.onReady?.();
          break;
        case "loaded":
          cb.onLoaded?.();
          break;
        case "relocate":
          cb.onRelocate?.(msg);
          break;
        case "toc":
          cb.onTocReady?.(msg.items || []);
          break;
        case "selection":
          cb.onSelection?.(msg);
          break;
        case "selectionCleared":
          cb.onSelectionCleared?.();
          break;
        case "tap":
          cb.onTap?.();
          break;
        case "searchResult":
          cb.onSearchResult?.(msg.index || 0, msg.count || 0);
          break;
        case "searchComplete":
          cb.onSearchComplete?.(msg.count || 0);
          break;
        case "error":
          console.error("[ReaderBridge] Error from WebView:", msg.message);
          cb.onError?.(msg.message || "Unknown error");
          break;
        case "foliate-loaded":
          break;
        case "show-annotation":
          if (msg.value && msg.position) {
            cb.onShowAnnotation?.({
              value: msg.value,
              range: msg.range,
              position: msg.position,
            });
          }
          break;
        case "note-tooltip":
          if (msg.cfi && msg.note && msg.position) {
            cb.onNoteTooltip?.({
              cfi: msg.cfi,
              note: msg.note,
              position: msg.position,
            });
          }
          break;
        case "pageSnippet":
          cb.onPageSnippet?.(msg.textSnippet || "");
          break;
        case "bookmarkSnippet":
          cb.onBookmarkSnippet?.(msg.textSnippet || "");
          break;
        case "toggleBookmark":
          cb.onToggleBookmark?.();
          break;
        case "visibleText":
          console.log(
            "[ReaderBridge] received visibleText:",
            JSON.stringify({
              textLength: msg.text?.length || 0,
              error: msg.error || "none",
              debug: msg.debug || null,
            }),
          );
          if (pendingVisibleTextResolveRef.current) {
            pendingVisibleTextResolveRef.current(msg.text || "");
            pendingVisibleTextResolveRef.current = null;
          }
          break;
        case "chapterParagraphs":
          console.log("[ChapterTranslation] Received chapterParagraphs:", JSON.stringify({
            count: msg.paragraphs?.length || 0,
            error: msg.error || "none",
          }));
          if (pendingChapterParagraphsResolveRef.current) {
            if (msg.error) {
              console.warn("[ChapterTranslation] WebView error:", msg.error);
            }
            pendingChapterParagraphsResolveRef.current(msg.paragraphs || []);
            pendingChapterParagraphsResolveRef.current = null;
          } else {
            console.warn("[ChapterTranslation] No pending resolve for chapterParagraphs (timed out?)");
          }
          break;
        default:
          break;
      }
    } catch (err) {
      console.error("[ReaderBridge] Parse error:", err);
    }
  }, []);

  return useMemo(
    () => ({
      webViewRef,
      handleMessage,
      // Commands
      openBook,
      openBookChunked,
      goNext,
      goPrev,
      goToFraction,
      goToHref,
      goToCFI,
      search,
      clearSearch,
      navigateSearch,
      addAnnotation,
      removeAnnotation,
      highlightCFITemporarily,
      applySettings,
      setPageTurnStyle,
      setThemeColors,
      setNavigationLocked,
      requestPageSnippet,
      getVisibleText,
      flashHighlight,
      getChapterParagraphs,
      injectChapterTranslations,
      removeChapterTranslations,
    }),
    [
      handleMessage,
      openBook,
      openBookChunked,
      goNext,
      goPrev,
      goToFraction,
      goToHref,
      goToCFI,
      search,
      clearSearch,
      navigateSearch,
      addAnnotation,
      removeAnnotation,
      highlightCFITemporarily,
      applySettings,
      setPageTurnStyle,
      setThemeColors,
      setNavigationLocked,
      requestPageSnippet,
      getVisibleText,
      getChapterParagraphs,
      injectChapterTranslations,
      removeChapterTranslations,
    ],
  );
}
