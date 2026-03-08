/**
 * MobileFoliateViewer — core book rendering using foliate-js <foliate-view>.
 * Mobile-optimized: touch interactions, tap-to-toggle controls, swipe pagination.
 */
import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import type { BookDoc, BookFormat } from "@/lib/reader/document-loader";
import { getDirection, isFixedLayoutFormat } from "@/lib/reader/document-loader";
import { registerIframeEventHandlers } from "@/lib/reader/iframe-event-handlers";
import { useFoliateEvents } from "@readany/core/hooks/reader/useFoliateEvents";
import type { FoliateView } from "@readany/core/hooks/reader/useFoliateView";
import { wrappedFoliateView } from "@readany/core/hooks/reader/useFoliateView";
import type { ViewSettings } from "@readany/core/types";
import { Overlayer } from "foliate-js/overlayer.js";
import { getFontTheme } from "@readany/core/reader/font-themes";

// Polyfills required by foliate-js
// biome-ignore lint: polyfill for foliate-js
(Object as any).groupBy ??= (
  iterable: Iterable<unknown>,
  callbackfn: (value: unknown, index: number) => string,
) => {
  const obj = Object.create(null);
  let i = 0;
  for (const value of iterable) {
    const key = callbackfn(value, i++);
    if (key in obj) obj[key].push(value);
    else obj[key] = [value];
  }
  return obj;
};

// biome-ignore lint: polyfill for foliate-js
(Map as any).groupBy ??= (
  iterable: Iterable<unknown>,
  callbackfn: (value: unknown, index: number) => unknown,
) => {
  const map = new Map();
  let i = 0;
  for (const value of iterable) {
    const key = callbackfn(value, i++);
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  }
  return map;
};

/** Relocate event detail from foliate-view */
export interface RelocateDetail {
  fraction?: number;
  section?: { current: number; total: number };
  location?: { current: number; next: number; total: number };
  tocItem?: { label?: string; href?: string; id?: number };
  cfi?: string;
  time?: { section: number; total: number };
  range?: Range;
}

/** Converted TOC item for UI consumption */
export interface MobileTOCItem {
  id: string;
  title: string;
  level: number;
  href?: string;
  index?: number;
  subitems?: MobileTOCItem[];
}

/** Text selection detail from foliate-view */
export interface SelectionDetail {
  text: string;
  cfi: string;
  range?: Range;
  position: { x: number; y: number; selectionTop: number; selectionBottom: number; direction: "forward" | "backward" };
}

/** Imperative handle exposed to parent */
export interface MobileFoliateViewerHandle {
  goNext: () => void;
  goPrev: () => void;
  goToHref: (href: string) => void;
  goToFraction: (fraction: number) => void;
  goToCFI: (cfi: string) => void;
  goToIndex: (index: number) => void;
  getView: () => FoliateView | null;
  getVisibleText: () => string;
  search: (query: string) => AsyncGenerator<{ cfi: string; excerpt: string }, void, unknown> | null;
  clearSearch: () => void;
  setNavigationLocked: (locked: boolean) => void;
  addAnnotation: (annotation: unknown, remove?: boolean) => void;
  deleteAnnotation: (annotation: unknown) => void;
}

interface MobileFoliateViewerProps {
  bookKey: string;
  bookDoc: BookDoc;
  format: BookFormat;
  viewSettings: ViewSettings;
  lastLocation?: string;
  onRelocate?: (detail: RelocateDetail) => void;
  onTocReady?: (toc: MobileTOCItem[]) => void;
  onLoaded?: () => void;
  onSectionLoad?: (index: number) => void;
  onError?: (error: Error) => void;
  onTapCenter?: () => void;
  onSelection?: (detail: SelectionDetail | null) => void;
  onShowAnnotation?: (event: Event) => void;
}

export const MobileFoliateViewer = forwardRef<MobileFoliateViewerHandle, MobileFoliateViewerProps>(
  function MobileFoliateViewer(
    {
      bookKey,
      bookDoc,
      format,
      viewSettings,
      lastLocation,
      onRelocate,
      onTocReady,
      onLoaded,
      onSectionLoad,
      onError,
      onTapCenter,
      onSelection,
      onShowAnnotation,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<FoliateView | null>(null);
    const isViewCreated = useRef(false);
    const [loading, setLoading] = useState(true);
    const isFixedLayout = isFixedLayoutFormat(format);
    const [viewReady, setViewReady] = useState(false);

    // Imperative handle
    useImperativeHandle(
      ref,
      () => ({
        goNext: () => viewRef.current?.goRight(),
        goPrev: () => viewRef.current?.goLeft(),
        goToHref: (href: string) => viewRef.current?.goTo(href),
        goToFraction: (fraction: number) => viewRef.current?.goToFraction(fraction),
        goToCFI: (cfi: string) => viewRef.current?.goTo(cfi),
        goToIndex: (index: number) => viewRef.current?.goTo(index),
        getView: () => viewRef.current,
        search: (query: string) => {
          const view = viewRef.current;
          if (!view?.book?.search) return null;
          return view.book.search(query);
        },
        clearSearch: () => {
          const view = viewRef.current;
          if (!view?.renderer?.clearSearch) return;
          view.renderer.clearSearch();
        },
        setNavigationLocked: (locked: boolean) => {
          const renderer = viewRef.current?.renderer;
          if (renderer && "navigationLocked" in renderer) {
            // biome-ignore lint: runtime property on paginator
            (renderer as any).navigationLocked = locked;
          }
        },
        addAnnotation: (annotation: unknown, remove?: boolean) => {
          viewRef.current?.addAnnotation(annotation, remove);
        },
        deleteAnnotation: (annotation: unknown) => {
          viewRef.current?.deleteAnnotation(annotation);
        },
        getVisibleText: () => {
          try {
            const renderer = viewRef.current?.renderer;
            const contents = renderer?.getContents?.();
            if (!contents?.[0]?.doc) return "";
            const doc = contents[0].doc as Document;
            const isPaginated = !renderer.scrolled;
            const pSize = renderer.size;
            const pStart = renderer.start;

            if (isPaginated && pSize > 0) {
              const visibleLeft = pStart - pSize;
              const visibleRight = pStart;
              const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
                acceptNode: (node: Node) => {
                  if (!node.nodeValue?.trim()) return NodeFilter.FILTER_SKIP;
                  const tag = (node as Text).parentElement?.tagName?.toLowerCase();
                  if (tag === "script" || tag === "style") return NodeFilter.FILTER_REJECT;
                  return NodeFilter.FILTER_ACCEPT;
                },
              });
              const texts: string[] = [];
              let n = walker.nextNode();
              while (n) {
                const range = doc.createRange();
                range.selectNodeContents(n);
                const rect = range.getBoundingClientRect();
                if (rect.right > visibleLeft && rect.left < visibleRight && rect.width > 0) {
                  const t = n.nodeValue?.trim();
                  if (t) texts.push(t);
                }
                n = walker.nextNode();
              }
              const result = texts.join(" ").trim();
              if (result) return result;
            } else {
              const win = doc.defaultView;
              if (win) {
                const vw = win.innerWidth;
                const vh = win.innerHeight;
                const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
                  acceptNode: (node: Node) => {
                    if (!node.nodeValue?.trim()) return NodeFilter.FILTER_SKIP;
                    const tag = (node as Text).parentElement?.tagName?.toLowerCase();
                    if (tag === "script" || tag === "style") return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                  },
                });
                const texts: string[] = [];
                let n = walker.nextNode();
                while (n) {
                  const range = doc.createRange();
                  range.selectNodeContents(n);
                  const rect = range.getBoundingClientRect();
                  if (rect.right > 0 && rect.left < vw && rect.bottom > 0 && rect.top < vh && rect.width > 0) {
                    const t = n.nodeValue?.trim();
                    if (t) texts.push(t);
                  }
                  n = walker.nextNode();
                }
                const result = texts.join(" ").trim();
                if (result) return result;
              }
            }
            return doc.body?.innerText?.trim() || "";
          } catch {
            return "";
          }
        },
      }),
      [viewReady],
    );

    // Convert TOC
    const convertTOC = useCallback(
      (
        foliaToc: Array<{ id?: number; label?: string; href?: string; subitems?: unknown[] }>,
        level = 0,
      ): MobileTOCItem[] => {
        if (!foliaToc) return [];
        return foliaToc.map((item, i) => ({
          id: String(item.id ?? `toc-${level}-${i}`),
          title: item.label || `Chapter ${i + 1}`,
          level,
          href: item.href,
          index: i,
          subitems:
            item.subitems && Array.isArray(item.subitems) && item.subitems.length > 0
              ? convertTOC(item.subitems as Array<{ id?: number; label?: string; href?: string; subitems?: unknown[] }>, level + 1)
              : undefined,
        }));
      },
      [],
    );

    // Section load handler
    const docLoadHandlerImpl = useCallback(
      (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (!detail?.doc) return;
        getDirection(detail.doc);
        applyDocumentStyles(detail.doc, isFixedLayout);
        registerIframeEventHandlers(bookKey, detail.doc);
        attachTapListener(detail.doc);
        setLoading(false);
        onLoaded?.();
        if (detail.index !== undefined) {
          onSectionLoad?.(detail.index);
        }
      },
      [bookKey, isFixedLayout, onLoaded, onSectionLoad],
    );
    const docLoadHandlerRef = useRef(docLoadHandlerImpl);
    docLoadHandlerRef.current = docLoadHandlerImpl;

    // Relocate handler
    const relocateHandlerImpl = useCallback(
      (event: Event) => {
        onRelocate?.((event as CustomEvent).detail);
      },
      [onRelocate],
    );
    const relocateHandlerRef = useRef(relocateHandlerImpl);
    relocateHandlerRef.current = relocateHandlerImpl;

    // Stable wrapper
    const docLoadHandler = useCallback((event: Event) => docLoadHandlerRef.current(event), []);
    const relocateHandler = useCallback((event: Event) => relocateHandlerRef.current(event), []);

    // Draw annotation handler (highlights + note squiggly underlines)
    const drawAnnotationHandler = useCallback((event: Event) => {
      const { draw, annotation, doc, range } = (event as CustomEvent).detail;
      if (!draw || !annotation) return;
      const color = annotation.color || "yellow";
      const colorMap: Record<string, string> = {
        red: "rgba(248, 113, 113, 0.4)",
        yellow: "rgba(250, 204, 21, 0.4)",
        green: "rgba(74, 222, 128, 0.4)",
        blue: "rgba(96, 165, 250, 0.4)",
        pink: "rgba(236, 72, 153, 0.4)",
        violet: "rgba(167, 139, 250, 0.4)",
      };

      // Detect writing mode for vertical text support
      let writingMode = "horizontal-tb";
      let vertical = false;
      if (doc && range) {
        try {
          const node = range.startContainer;
          const el = node.nodeType === 1 ? node : node.parentElement;
          if (el && doc.defaultView) {
            const style = doc.defaultView.getComputedStyle(el);
            writingMode = style.writingMode || "horizontal-tb";
            vertical = writingMode?.includes("vertical") || false;
          }
        } catch { /* ignore */ }
      }

      if (annotation.note) {
        // Has note → draw wavy underline instead of highlight background
        draw(Overlayer.squiggly, { color: "#000000", width: 1.5, writingMode });
      } else {
        // Regular highlight
        draw(Overlayer.highlight, { color: colorMap[color] || colorMap.yellow, vertical });
      }
    }, []);

    // Delete annotation handler (cleanup when annotation is removed)
    const deleteAnnotationHandler = useCallback((_event: Event) => {
      // No-op on mobile — no tooltip registry to clean up.
      // The event listener is registered so foliate-js can properly
      // clean up its internal overlay state.
    }, []);

    // Tap listener for center-tap → toggle controls
    const onTapCenterRef = useRef(onTapCenter);
    onTapCenterRef.current = onTapCenter;

    const onSelectionRef = useRef(onSelection);
    onSelectionRef.current = onSelection;

    const attachTapListener = useCallback((doc: Document) => {
      // biome-ignore lint: runtime flag
      if ((doc as any).__readany_mobile_tap) return;
      // biome-ignore lint: runtime flag
      (doc as any).__readany_mobile_tap = true;

      // We patched foliate-js paginator to only call preventDefault() on
      // touchmove when finger moves > 10px. This means pure taps now
      // correctly generate synthetic "click" events on iOS.
      //
      // Use mousedown/touchstart to detect long-press (> 500ms) and
      // filter it out from click handling.
      const LONG_HOLD_MS = 500;
      let longHoldTimer: ReturnType<typeof setTimeout> | null = null;

      doc.addEventListener("touchstart", () => {
        longHoldTimer = setTimeout(() => { longHoldTimer = null; }, LONG_HOLD_MS);
      }, { passive: true });

      doc.addEventListener("mousedown", () => {
        longHoldTimer = setTimeout(() => { longHoldTimer = null; }, LONG_HOLD_MS);
      });

      doc.addEventListener("click", (e: MouseEvent) => {
        // Long-press detected — skip
        if (!longHoldTimer) return;
        clearTimeout(longHoldTimer);
        longHoldTimer = null;

        // Skip interactive elements
        const target = e.target as HTMLElement | null;
        if (target?.closest("a[href], audio, video, button, input, select, textarea")) return;

        // Skip if text is selected
        const sel = doc.getSelection();
        if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return;

        // Check center zone (25%–75% of screen width)
        // e.clientX inside iframe includes paginator's horizontal offset after
        // page turns (e.g. 631 on a 402px-wide screen). Convert to viewport
        // coordinates by adding the iframe element's left offset.
        let viewW: number;
        try {
          viewW = window.top?.innerWidth || window.innerWidth;
        } catch {
          viewW = window.innerWidth;
        }
        // Convert iframe-local clientX to top-level viewport X
        const iframe = doc.defaultView?.frameElement as HTMLIFrameElement | null;
        const iframeLeft = iframe?.getBoundingClientRect().left ?? 0;
        const viewportX = e.clientX + iframeLeft;
        // Use modulo of viewport width to handle paginator's cumulative offset
        const normalizedX = ((viewportX % viewW) + viewW) % viewW;
        if (normalizedX >= viewW * 0.25 && normalizedX <= viewW * 0.75) {
          onTapCenterRef.current?.();
        }
      });

      // Selection change detection
      let selectionTimer: ReturnType<typeof setTimeout> | null = null;

      // Helper: compute selection detail and notify parent
      const emitSelection = (sel: Selection, range: Range) => {
        const text = sel.toString().trim();
        if (!text) return;
        // Use getClientRects for precise multi-line bounding
        const rects = Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0);
        const boundingRect = range.getBoundingClientRect();
        // Convert iframe-local coords to main window coords
        const iframe = doc.defaultView?.frameElement as HTMLIFrameElement | null;
        const iframeRect = iframe?.getBoundingClientRect();
        const offsetX = iframeRect?.left ?? 0;
        const offsetY = iframeRect?.top ?? 0;

        // Find topmost and bottommost rects across all lines
        let minTop = boundingRect.top;
        let maxBottom = boundingRect.bottom;
        for (const r of rects) {
          if (r.top < minTop) minTop = r.top;
          if (r.bottom > maxBottom) maxBottom = r.bottom;
        }

        // Determine selection direction: compare anchor (start) vs focus (end)
        let direction: "forward" | "backward" = "forward";
        if (sel.anchorNode && sel.focusNode) {
          const pos = sel.anchorNode.compareDocumentPosition(sel.focusNode);
          if (pos & Node.DOCUMENT_POSITION_PRECEDING) {
            direction = "backward";
          } else if (pos === 0 && sel.focusOffset < sel.anchorOffset) {
            direction = "backward";
          }
        }

        // Get CFI from foliate-view
        const view = viewRef.current;
        let cfi = "";
        try {
          if (view?.getCFI) {
            const index = view.renderer?.sectionIndex;
            cfi = view.getCFI(index, range) || "";
          }
        } catch { /* ignore */ }

        onSelectionRef.current?.({
          text,
          cfi,
          range,
          position: {
            x: offsetX + boundingRect.left + boundingRect.width / 2,
            y: offsetY + minTop - 8,
            selectionTop: offsetY + minTop,
            selectionBottom: offsetY + maxBottom,
            direction,
          },
        });
      };

      // iOS hack: dismiss the system edit menu by quickly removing and
      // re-adding the selection range. The 30ms gap is enough for iOS to
      // tear down its native menu while being imperceptible to the user.
      // Executed on touchend (finger lift) rather than selectionchange so
      // dragging selection handles doesn't cause visible flicker.
      // Adapted from Readest (MIT): useTextSelector.ts#makeSelectionOnIOS
      let iosHackPending = false;
      const dismissSystemMenuAndReselect = (sel: Selection, range: Range) => {
        iosHackPending = true;
        // biome-ignore lint: runtime flag to skip selectionchange during jiggle
        (doc as any).__readany_isJiggling = true;
        sel.removeAllRanges();
        setTimeout(() => {
          sel.addRange(range);
          // biome-ignore lint: runtime flag
          (doc as any).__readany_isJiggling = false;
          iosHackPending = false;
          emitSelection(sel, range);
        }, 30);
      };

      // On touchend: if there is a valid selection, jiggle it to kill
      // the system menu. This fires once per finger-lift, not during drag.
      doc.addEventListener("touchend", () => {
        // Small delay so the selection has settled after the touch ends
        setTimeout(() => {
          if (iosHackPending) return;
          const sel = doc.getSelection();
          if (!sel || sel.isCollapsed || !sel.toString().trim() || !sel.rangeCount) return;
          const range = sel.getRangeAt(0);
          dismissSystemMenuAndReselect(sel, range);
        }, 50);
      }, { passive: true });

      doc.addEventListener("selectionchange", () => {
        // Skip jiggle-induced selectionchange — the removeAllRanges/addRange
        // cycle momentarily collapses the selection and would clear the popover
        // biome-ignore lint: runtime flag
        if ((doc as any).__readany_isJiggling) return;
        if (iosHackPending) return;
        if (selectionTimer) clearTimeout(selectionTimer);
        selectionTimer = setTimeout(() => {
          const sel = doc.getSelection();
          if (!sel || sel.isCollapsed || !sel.toString().trim()) {
            onSelectionRef.current?.(null);
            return;
          }
          if (!sel.rangeCount) return;
          const range = sel.getRangeAt(0);
          // During drag just update the popover position, no jiggle
          emitSelection(sel, range);
        }, 300);
      });
    }, []);

    // Bind foliate events
    useFoliateEvents(viewReady ? viewRef.current : null, {
      onLoad: docLoadHandler,
      onRelocate: relocateHandler,
      onDrawAnnotation: drawAnnotationHandler,
      onShowAnnotation,
    });

    // Open book
    useEffect(() => {
      if (isViewCreated.current) return;
      isViewCreated.current = true;

      const openBook = async () => {
        try {
          await import("foliate-js/view.js");

          const view = wrappedFoliateView(document.createElement("foliate-view"));
          view.id = `foliate-view-${bookKey}`;
          view.style.width = "100%";
          view.style.height = "100%";
          containerRef.current?.appendChild(view);

          // Fixed layout pre-config
          if (isFixedLayout && bookDoc.rendition) {
            bookDoc.rendition.spread = "none";
          }

          await view.open(bookDoc);
          viewRef.current = view;

          // TOC
          if (view.book?.toc) {
            onTocReady?.(convertTOC(view.book.toc));
          }

          // Renderer settings
          applyRendererSettings(view, viewSettings, isFixedLayout);

          // Register events before navigation
          view.addEventListener("load", docLoadHandler);
          view.addEventListener("relocate", relocateHandler);
          view.addEventListener("draw-annotation", drawAnnotationHandler);
          view.addEventListener("delete-annotation", deleteAnnotationHandler);
          setViewReady(true);

          // Navigate to last location
          if (lastLocation && !isFixedLayout) {
            await view.init({ lastLocation });
          } else {
            await view.goToFraction(0);
          }
        } catch (err) {
          console.error("[MobileFoliateViewer] Failed to open book:", err);
          onError?.(err instanceof Error ? err : new Error("Failed to open book"));
          setLoading(false);
        }
      };

      openBook();

      return () => {
        const view = viewRef.current;
        if (view) {
          try { view.close(); } catch { /* ignore */ }
          view.remove();
          viewRef.current = null;
          setViewReady(false);
        }
      };
    }, []);

    // Apply view settings changes
    useEffect(() => {
      const view = viewRef.current;
      if (!view?.renderer || isFixedLayout) return;
      applyRendererSettings(view, viewSettings, false);
    }, [viewSettings.fontSize, viewSettings.lineHeight, viewSettings.fontTheme, viewSettings.paragraphSpacing, viewSettings.pageMargin, isFixedLayout]);

    // Apply view mode changes
    useEffect(() => {
      const view = viewRef.current;
      if (!view?.renderer || isFixedLayout) return;
      if (viewSettings.viewMode === "scroll") {
        view.renderer.setAttribute("flow", "scrolled");
      } else {
        view.renderer.removeAttribute("flow");
      }
    }, [viewSettings.viewMode, isFixedLayout]);

    return (
      <div ref={containerRef} className="foliate-viewer h-full w-full touch-manipulation">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          </div>
        )}
      </div>
    );
  },
);

// --- Helper functions ---

function applyDocumentStyles(doc: Document, isFixedLayout: boolean) {
  if (isFixedLayout) return;
  for (const img of doc.querySelectorAll("img")) {
    img.style.maxWidth = "100%";
    img.style.height = "auto";
  }

  // Suppress iOS native selection callout (Copy/Look Up/Translate menu)
  // so only our custom popover shows.
  const suppressStyle = doc.createElement("style");
  suppressStyle.textContent = `
    * {
      -webkit-touch-callout: none !important;
      -webkit-user-select: text !important;
      user-select: text !important;
    }
    ::selection {
      background: rgba(250, 204, 21, 0.4) !important;
    }
  `;
  doc.head.appendChild(suppressStyle);

  // Block the native context menu (right-click / long-press menu)
  doc.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, true);
}

function applyRendererSettings(view: FoliateView, settings: ViewSettings, isFixedLayout: boolean) {
  const renderer = view.renderer;
  if (!renderer) return;

  if (isFixedLayout) {
    renderer.setAttribute("zoom", "fit-page");
    renderer.setAttribute("spread", "none"); // Single page on mobile
  } else {
    renderer.setAttribute("max-column-count", "1"); // Single column on mobile
    renderer.setAttribute("max-block-size", "100%");
    // paginator.js treats gap as a percentage (divides by 100)
    // Convert px margin to a percentage of typical mobile width (~393px)
    const marginPx = settings.pageMargin || 16;
    const gapPercent = Math.max(1, Math.round((marginPx / 393) * 100));
    renderer.setAttribute("gap", `${gapPercent}%`);
    renderer.setAttribute("margin", `${marginPx}px`);
    if (settings.viewMode === "scroll") {
      renderer.setAttribute("flow", "scrolled");
      // In scroll mode, max-inline-size is used as columnWidth directly (parseFloat).
      // "100%" would be parsed as 100px, so use a large px value instead.
      renderer.setAttribute("max-inline-size", "9999px");
    } else {
      renderer.setAttribute("max-inline-size", "100%");
    }
  }
  renderer.setAttribute("animated", "");
  applyRendererStyles(view, settings, isFixedLayout);
}

function applyRendererStyles(view: FoliateView, settings: ViewSettings, isFixedLayout: boolean) {
  const renderer = view.renderer;
  if (!renderer?.setStyles) return;

  if (isFixedLayout) {
    renderer.setStyles("html, body { background-color: #ffffff !important; }");
    return;
  }

  const fontTheme = getFontTheme(settings.fontTheme);
  const fontFamily = `'${fontTheme.cjk}', '${fontTheme.serif}', serif`;

  renderer.setStyles(`
html, body {
  background-color: #ffffff !important;
  color: #1a1a1a !important;
  font-family: ${fontFamily} !important;
  font-size: ${settings.fontSize}px !important;
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
}
p, div, blockquote, dd, li, span, h1, h2, h3, h4, h5, h6, figcaption, caption, td, th, dt {
  font-family: ${fontFamily} !important;
  line-height: ${settings.lineHeight} !important;
}
p {
  margin-top: ${settings.paragraphSpacing}px !important;
  margin-bottom: ${settings.paragraphSpacing}px !important;
}
a, a:any-link {
  color: #2563eb !important;
  text-decoration: none !important;
}
img, svg {
  max-width: 100% !important;
  height: auto !important;
}
::selection {
  background: rgba(59, 130, 246, 0.3) !important;
}
pre {
  white-space: pre-wrap !important;
  tab-size: 2;
}
  `);
}
