/**
 * PDFReader — Independent PDF reader component with native annotation support.
 *
 * Unlike the foliate-js adapter (which wraps PDF pages as fixed-layout EPUB),
 * this component renders PDF directly via pdfjs-dist with:
 * - Continuous scroll mode
 * - Highlight/underline annotations via SVG overlay
 * - Text selection → highlight creation
 * - Bookmark support
 * - Search with visual indicators
 *
 * Architecture reference: Zotero reader (zotero/reader)
 *
 * Rendering layers per page (bottom to top):
 *   1. Canvas layer — PDF page raster image
 *   2. Text layer — invisible selectable text (pdfjs TextLayer)
 *   3. Annotation overlay — SVG highlights, underlines, notes
 *   4. Annotation layer — PDF built-in annotations (links etc.)
 */

import { formatPdfLocation, isPdfLocation, parsePdfLocation, pdfPageLocation } from "@readany/core/utils";
import type { PdfRect } from "@readany/core/utils";
import type { HighlightColor } from "@readany/core/types";
import { HIGHLIGHT_COLOR_HEX } from "@readany/core/types";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

// ─── Types ───

export interface PDFAnnotation {
  id: string;
  location: string; // "pdf:{page}:{rects}"
  color: string; // hex color
  type: "highlight" | "underline";
  hasNote?: boolean;
}

export interface PDFSelection {
  text: string;
  page: number;
  rects: PdfRect[];
  location: string; // formatted PDF location
  screenRect: { x: number; y: number; width: number; height: number };
}

export interface PDFRelocateDetail {
  page: number;
  totalPages: number;
  fraction: number;
  location: string;
}

export interface PDFTOCItem {
  label: string;
  page: number;
  children?: PDFTOCItem[];
}

export interface PDFReaderHandle {
  goToPage(page: number): void;
  goToLocation(location: string): void;
  nextPage(): void;
  prevPage(): void;
  getSelection(): PDFSelection | null;
  search(query: string, opts?: { matchCase?: boolean }): Promise<void>;
  clearSearch(): void;
  addAnnotation(annotation: PDFAnnotation): void;
  removeAnnotation(id: string): void;
  getCurrentPage(): number;
  getTotalPages(): number;
  setZoom(zoom: number | "fit-width" | "fit-page"): void;
  destroy(): void;
}

interface PDFReaderProps {
  src: Uint8Array | string; // PDF bytes or URL
  initialLocation?: string; // "pdf:5" or "pdf:5:rects"
  annotations?: PDFAnnotation[];
  onRelocate?: (detail: PDFRelocateDetail) => void;
  onSelectionChange?: (selection: PDFSelection | null) => void;
  onAnnotationClick?: (id: string, location: string) => void;
  onTocReady?: (toc: PDFTOCItem[]) => void;
  onDocReady?: (info: { totalPages: number; title?: string; author?: string }) => void;
  className?: string;
}

// ─── Constants ───

const PAGE_GAP = 8;
const VIEWPORT_BUFFER = 1; // render pages ±N outside viewport
const HIGHLIGHT_OPACITY = 0.35;
const UNDERLINE_HEIGHT = 2;

// ─── Component ───

export const PDFReader = forwardRef<PDFReaderHandle, PDFReaderProps>(function PDFReader(
  {
    src,
    initialLocation,
    annotations = [],
    onRelocate,
    onSelectionChange,
    onAnnotationClick,
    onTocReady,
    onDocReady,
    className,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  const pageCanvasesRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pageContainersRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const renderedPagesRef = useRef<Set<number>>(new Set());
  const annotationsRef = useRef<PDFAnnotation[]>(annotations);
  const scaleRef = useRef(1);
  const totalPagesRef = useRef(0);
  const currentPageRef = useRef(1);
  const searchResultsRef = useRef<Array<{ page: number; rects: PdfRect[] }>>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);

  // Keep annotations ref in sync
  useEffect(() => {
    annotationsRef.current = annotations;
    // Re-render annotation overlays for all visible pages
    for (const pageNum of renderedPagesRef.current) {
      renderAnnotationOverlay(pageNum);
    }
  }, [annotations]);

  // ─── PDF Loading ───

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        setIsLoading(true);
        setLoadError(null);

        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjsLib.getDocument({
          data: typeof src === "string" ? undefined : new Uint8Array(src),
          url: typeof src === "string" ? src : undefined,
          cMapUrl: "/vendor/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/vendor/pdfjs/standard_fonts/",
          useWorkerFetch: false,
          isEvalSupported: false,
        });

        const pdfDoc = await loadingTask.promise;
        if (cancelled) {
          pdfDoc.destroy();
          return;
        }

        pdfDocRef.current = pdfDoc;
        totalPagesRef.current = pdfDoc.numPages;
        setTotalPages(pdfDoc.numPages);

        // Extract metadata
        const metadata = await pdfDoc.getMetadata().catch(() => null);
        const info = metadata?.info as Record<string, string> | undefined;
        onDocReady?.({
          totalPages: pdfDoc.numPages,
          title: info?.Title || undefined,
          author: info?.Author || undefined,
        });

        // Extract TOC
        const outline = await pdfDoc.getOutline().catch(() => null);
        if (outline) {
          const toc = await buildTOC(pdfDoc, outline);
          onTocReady?.(toc);
        }

        // Build page containers
        await buildPageContainers(pdfDoc);

        setIsLoading(false);

        // Navigate to initial location
        if (initialLocation && isPdfLocation(initialLocation)) {
          const { page } = parsePdfLocation(initialLocation);
          requestAnimationFrame(() => scrollToPage(page));
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[PDFReader] Failed to load PDF:", err);
          setLoadError(err instanceof Error ? err.message : String(err));
          setIsLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
      renderedPagesRef.current.clear();
      pageCanvasesRef.current.clear();
      pageContainersRef.current.clear();
    };
  }, [src]);

  // ─── Build page containers (placeholder divs with correct dimensions) ───

  async function buildPageContainers(pdfDoc: any) {
    const container = containerRef.current;
    if (!container) return;

    // Clear existing content
    container.innerHTML = "";
    pageContainersRef.current.clear();
    pageCanvasesRef.current.clear();
    renderedPagesRef.current.clear();

    // Determine scale based on container width
    const firstPage = await pdfDoc.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1 });
    const containerWidth = container.clientWidth - 32; // padding
    const fitScale = containerWidth / viewport.width;
    scaleRef.current = fitScale;
    setScale(fitScale);

    // Create placeholder divs for all pages
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const vp = page.getViewport({ scale: fitScale });

      const pageDiv = document.createElement("div");
      pageDiv.className = "pdf-page-container";
      pageDiv.dataset.pageNum = String(i);
      pageDiv.style.width = `${vp.width}px`;
      pageDiv.style.height = `${vp.height}px`;
      pageDiv.style.position = "relative";
      pageDiv.style.marginBottom = `${PAGE_GAP}px`;
      pageDiv.style.backgroundColor = "white";
      pageDiv.style.boxShadow = "0 1px 4px rgba(0,0,0,0.12)";
      pageDiv.style.overflow = "hidden";

      container.appendChild(pageDiv);
      pageContainersRef.current.set(i, pageDiv);
    }

    // Set up intersection observer for lazy rendering
    setupIntersectionObserver();
  }

  // ─── Lazy page rendering via IntersectionObserver ───

  function setupIntersectionObserver() {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const pageNum = Number(entry.target.getAttribute("data-page-num"));
          if (entry.isIntersecting && !renderedPagesRef.current.has(pageNum)) {
            renderPage(pageNum);
          }
        }
      },
      {
        root: container,
        rootMargin: "200px 0px", // pre-render pages slightly outside viewport
      },
    );

    for (const [, div] of pageContainersRef.current) {
      observer.observe(div);
    }
  }

  // ─── Render a single page (canvas + text layer + annotation overlay) ───

  async function renderPage(pageNum: number) {
    const pdfDoc = pdfDocRef.current;
    const pageDiv = pageContainersRef.current.get(pageNum);
    if (!pdfDoc || !pageDiv || renderedPagesRef.current.has(pageNum)) return;

    renderedPagesRef.current.add(pageNum);

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: scaleRef.current });

      // 1. Canvas layer
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width * window.devicePixelRatio;
      canvas.height = viewport.height * window.devicePixelRatio;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";

      const ctx = canvas.getContext("2d")!;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      pageDiv.appendChild(canvas);
      pageCanvasesRef.current.set(pageNum, canvas);

      await page.render({ canvasContext: ctx, viewport }).promise;

      // 2. Text layer
      const textContent = await page.getTextContent();
      const textDiv = document.createElement("div");
      textDiv.className = "pdf-text-layer";
      textDiv.style.position = "absolute";
      textDiv.style.top = "0";
      textDiv.style.left = "0";
      textDiv.style.width = `${viewport.width}px`;
      textDiv.style.height = `${viewport.height}px`;
      pageDiv.appendChild(textDiv);

      const pdfjsLib = await import("pdfjs-dist");
      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: textContent,
        container: textDiv,
        viewport,
      });
      await textLayer.render();

      // 3. Annotation overlay (SVG layer for highlights)
      const overlayDiv = document.createElement("div");
      overlayDiv.className = "pdf-annotation-overlay";
      overlayDiv.dataset.pageNum = String(pageNum);
      overlayDiv.style.position = "absolute";
      overlayDiv.style.top = "0";
      overlayDiv.style.left = "0";
      overlayDiv.style.width = `${viewport.width}px`;
      overlayDiv.style.height = `${viewport.height}px`;
      overlayDiv.style.pointerEvents = "none";
      overlayDiv.style.zIndex = "2";
      pageDiv.appendChild(overlayDiv);

      // Render existing annotations for this page
      renderAnnotationOverlay(pageNum);

      // 4. Selection event handling
      textDiv.addEventListener("mouseup", () => handleTextSelection(pageNum));
    } catch (err) {
      console.error(`[PDFReader] Failed to render page ${pageNum}:`, err);
      renderedPagesRef.current.delete(pageNum);
    }
  }

  // ─── Annotation overlay rendering ───

  function renderAnnotationOverlay(pageNum: number) {
    const pageDiv = pageContainersRef.current.get(pageNum);
    if (!pageDiv) return;

    const overlay = pageDiv.querySelector(".pdf-annotation-overlay") as HTMLDivElement;
    if (!overlay) return;

    // Clear existing SVG
    overlay.innerHTML = "";

    // Filter annotations for this page
    const pageAnnotations = annotationsRef.current.filter((a) => {
      if (!isPdfLocation(a.location)) return false;
      const loc = parsePdfLocation(a.location);
      return loc.page === pageNum;
    });

    if (pageAnnotations.length === 0) return;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.pointerEvents = "none";

    for (const annotation of pageAnnotations) {
      const { rects } = parsePdfLocation(annotation.location);
      const s = scaleRef.current;

      for (const rect of rects) {
        if (annotation.type === "highlight") {
          const rectEl = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          rectEl.setAttribute("x", String(rect.x * s));
          rectEl.setAttribute("y", String(rect.y * s));
          rectEl.setAttribute("width", String(rect.w * s));
          rectEl.setAttribute("height", String(rect.h * s));
          rectEl.setAttribute("fill", annotation.color);
          rectEl.setAttribute("opacity", String(HIGHLIGHT_OPACITY));
          rectEl.setAttribute("data-annotation-id", annotation.id);
          rectEl.style.pointerEvents = "auto";
          rectEl.style.cursor = "pointer";
          rectEl.addEventListener("click", () => {
            onAnnotationClick?.(annotation.id, annotation.location);
          });
          svg.appendChild(rectEl);
        } else if (annotation.type === "underline") {
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", String(rect.x * s));
          line.setAttribute("y1", String((rect.y + rect.h) * s));
          line.setAttribute("x2", String((rect.x + rect.w) * s));
          line.setAttribute("y2", String((rect.y + rect.h) * s));
          line.setAttribute("stroke", annotation.color);
          line.setAttribute("stroke-width", String(UNDERLINE_HEIGHT));
          line.setAttribute("data-annotation-id", annotation.id);
          svg.appendChild(line);
        }
      }
    }

    overlay.appendChild(svg);
  }

  // ─── Text selection handling ───

  function handleTextSelection(pageNum: number) {
    const pageDiv = pageContainersRef.current.get(pageNum);
    if (!pageDiv) return;

    const textDiv = pageDiv.querySelector(".pdf-text-layer") as HTMLDivElement;
    if (!textDiv) return;

    const selection = textDiv.ownerDocument.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      onSelectionChange?.(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();
    if (!text) {
      onSelectionChange?.(null);
      return;
    }

    // Get selection rects in PDF coordinate space (unscaled)
    const clientRects = range.getClientRects();
    const pageDivRect = pageDiv.getBoundingClientRect();
    const s = scaleRef.current;

    const rects: PdfRect[] = [];
    for (const cr of clientRects) {
      rects.push({
        x: (cr.left - pageDivRect.left) / s,
        y: (cr.top - pageDivRect.top) / s,
        w: cr.width / s,
        h: cr.height / s,
      });
    }

    // Merge adjacent rects on the same line
    const mergedRects = mergeRects(rects);

    const location = formatPdfLocation(pageNum, mergedRects);

    // Screen rect for popover positioning
    const boundingRect = range.getBoundingClientRect();

    onSelectionChange?.({
      text,
      page: pageNum,
      rects: mergedRects,
      location,
      screenRect: {
        x: boundingRect.left + boundingRect.width / 2,
        y: boundingRect.top,
        width: boundingRect.width,
        height: boundingRect.height,
      },
    });
  }

  // ─── Scroll tracking ───

  useEffect(() => {
    const container = containerRef.current;
    if (!container || totalPages === 0) return;

    function handleScroll() {
      const container2 = containerRef.current;
      if (!container2) return;

      const scrollTop = container2.scrollTop;
      const scrollHeight = container2.scrollHeight - container2.clientHeight;
      const fraction = scrollHeight > 0 ? scrollTop / scrollHeight : 0;

      // Determine current page by finding which page is most visible
      let bestPage = 1;
      let bestVisibility = 0;
      const containerRect = container2.getBoundingClientRect();

      for (const [pageNum, div] of pageContainersRef.current) {
        const rect = div.getBoundingClientRect();
        const top = Math.max(rect.top, containerRect.top);
        const bottom = Math.min(rect.bottom, containerRect.bottom);
        const visible = Math.max(0, bottom - top);
        if (visible > bestVisibility) {
          bestVisibility = visible;
          bestPage = pageNum;
        }
      }

      if (bestPage !== currentPageRef.current) {
        currentPageRef.current = bestPage;
        setCurrentPage(bestPage);
      }

      onRelocate?.({
        page: bestPage,
        totalPages: totalPagesRef.current,
        fraction: Math.min(1, Math.max(0, fraction)),
        location: pdfPageLocation(bestPage),
      });
    }

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [totalPages, onRelocate]);

  // ─── Navigation helpers ───

  function scrollToPage(page: number) {
    const pageDiv = pageContainersRef.current.get(page);
    if (pageDiv && containerRef.current) {
      pageDiv.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function clearSearchHighlights() {
    for (const [, div] of pageContainersRef.current) {
      const svgs = div.querySelectorAll(".pdf-search-highlights");
      for (const svg of svgs) svg.remove();
    }
  }

  // ─── Build TOC from PDF outline ───

  async function buildTOC(pdfDoc: any, outline: any[]): Promise<PDFTOCItem[]> {
    const items: PDFTOCItem[] = [];
    for (const item of outline) {
      let page = 1;
      try {
        if (item.dest) {
          const dest =
            typeof item.dest === "string"
              ? await pdfDoc.getDestination(item.dest)
              : item.dest;
          if (dest) {
            const pageIndex = await pdfDoc.getPageIndex(dest[0]);
            page = pageIndex + 1;
          }
        }
      } catch {
        // ignore
      }

      const tocItem: PDFTOCItem = { label: item.title || "", page };
      if (item.items?.length) {
        tocItem.children = await buildTOC(pdfDoc, item.items);
      }
      items.push(tocItem);
    }
    return items;
  }

  // ─── Imperative handle ───

  useImperativeHandle(
    ref,
    () => ({
      goToPage(page: number) {
        scrollToPage(Math.max(1, Math.min(page, totalPagesRef.current)));
      },
      goToLocation(location: string) {
        if (isPdfLocation(location)) {
          const { page } = parsePdfLocation(location);
          scrollToPage(page);
        }
      },
      nextPage() {
        const next = Math.min(currentPageRef.current + 1, totalPagesRef.current);
        scrollToPage(next);
      },
      prevPage() {
        const prev = Math.max(currentPageRef.current - 1, 1);
        scrollToPage(prev);
      },
      getSelection(): PDFSelection | null {
        // Return last emitted selection; actual state tracked via onSelectionChange
        return null;
      },
      async search(query: string, opts?: { matchCase?: boolean }) {
        const pdfDoc = pdfDocRef.current;
        if (!pdfDoc || !query) return;

        // Clear previous search highlights
        clearSearchHighlights();

        const results: Array<{ page: number; rects: PdfRect[] }> = [];
        const flags = opts?.matchCase ? "" : "i";
        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags + "g");

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();

          // Build text with position tracking
          const items = textContent.items as Array<{ str: string; transform: number[]; width: number; height: number }>;
          let fullText = "";
          const charMap: Array<{ itemIdx: number; charIdx: number }> = [];

          for (let idx = 0; idx < items.length; idx++) {
            const item = items[idx];
            for (let c = 0; c < item.str.length; c++) {
              charMap.push({ itemIdx: idx, charIdx: c });
            }
            fullText += item.str;
            // Add space between items
            if (idx < items.length - 1) {
              charMap.push({ itemIdx: idx, charIdx: -1 }); // space
              fullText += " ";
            }
          }

          // Find all matches
          let match: RegExpExecArray | null;
          const pageRects: PdfRect[] = [];
          while ((match = regex.exec(fullText)) !== null) {
            // Get bounding rects for the match from text items
            const startChar = charMap[match.index];
            const endChar = charMap[Math.min(match.index + match[0].length - 1, charMap.length - 1)];
            if (startChar && endChar) {
              const startItem = items[startChar.itemIdx];
              const endItem = items[endChar.itemIdx];
              if (startItem && endItem) {
                // Transform: [scaleX, skewX, skewY, scaleY, translateX, translateY]
                const y = Math.min(startItem.transform[5], endItem.transform[5]);
                const h = Math.max(startItem.height || 12, endItem.height || 12);
                pageRects.push({
                  x: startItem.transform[4],
                  y: (page.getViewport({ scale: 1 }).height) - y - h,
                  w: (endItem.transform[4] + (endItem.width || 0)) - startItem.transform[4],
                  h: h,
                });
              }
            }
          }

          if (pageRects.length > 0) {
            results.push({ page: i, rects: pageRects });

            // Render search highlights on this page
            const pageDiv = pageContainersRef.current.get(i);
            if (pageDiv) {
              const s = scaleRef.current;
              const searchSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
              searchSvg.classList.add("pdf-search-highlights");
              searchSvg.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:3;";
              for (const rect of pageRects) {
                const el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                el.setAttribute("x", String(rect.x * s));
                el.setAttribute("y", String(rect.y * s));
                el.setAttribute("width", String(rect.w * s));
                el.setAttribute("height", String(rect.h * s));
                el.setAttribute("fill", "#FFEB3B");
                el.setAttribute("opacity", "0.4");
                el.setAttribute("rx", "2");
                searchSvg.appendChild(el);
              }
              pageDiv.appendChild(searchSvg);
            }
          }
        }

        searchResultsRef.current = results;

        // Scroll to first result
        if (results.length > 0) {
          scrollToPage(results[0].page);
        }
      },
      clearSearch() {
        searchResultsRef.current = [];
        clearSearchHighlights();
      },
      addAnnotation(annotation: PDFAnnotation) {
        annotationsRef.current = [...annotationsRef.current, annotation];
        if (isPdfLocation(annotation.location)) {
          const { page } = parsePdfLocation(annotation.location);
          renderAnnotationOverlay(page);
        }
      },
      removeAnnotation(id: string) {
        const removed = annotationsRef.current.find((a) => a.id === id);
        annotationsRef.current = annotationsRef.current.filter((a) => a.id !== id);
        if (removed && isPdfLocation(removed.location)) {
          const { page } = parsePdfLocation(removed.location);
          renderAnnotationOverlay(page);
        }
      },
      getCurrentPage() {
        return currentPageRef.current;
      },
      getTotalPages() {
        return totalPagesRef.current;
      },
      setZoom(zoom: number | "fit-width" | "fit-page") {
        const pdfDoc = pdfDocRef.current;
        const container = containerRef.current;
        if (!pdfDoc || !container) return;

        (async () => {
          const firstPage = await pdfDoc.getPage(1);
          const viewport = firstPage.getViewport({ scale: 1 });
          const containerWidth = container.clientWidth - 32;
          const containerHeight = container.clientHeight - 32;

          let newScale: number;
          if (zoom === "fit-width") {
            newScale = containerWidth / viewport.width;
          } else if (zoom === "fit-page") {
            const scaleW = containerWidth / viewport.width;
            const scaleH = containerHeight / viewport.height;
            newScale = Math.min(scaleW, scaleH);
          } else {
            newScale = zoom;
          }

          scaleRef.current = newScale;
          setScale(newScale);

          // Re-size all page containers
          for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const vp = page.getViewport({ scale: newScale });
            const pageDiv = pageContainersRef.current.get(i);
            if (pageDiv) {
              pageDiv.style.width = `${vp.width}px`;
              pageDiv.style.height = `${vp.height}px`;
            }
          }

          // Re-render visible pages
          const prevRendered = new Set(renderedPagesRef.current);
          renderedPagesRef.current.clear();
          // Clear page contents so they can be re-rendered
          for (const pageNum of prevRendered) {
            const pageDiv = pageContainersRef.current.get(pageNum);
            if (pageDiv) {
              pageDiv.innerHTML = "";
            }
          }

          // Re-setup observer to trigger re-render of visible pages
          setupIntersectionObserver();
        })();
      },
      destroy() {
        pdfDocRef.current?.destroy();
        pdfDocRef.current = null;
      },
    }),
    [],
  );

  // ─── Render ───

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-destructive">
        <div className="text-center">
          <p className="text-lg font-medium">Failed to load PDF</p>
          <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`pdf-reader-container relative h-full overflow-auto ${className || ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "16px",
        backgroundColor: "var(--reader-bg, #f5f5f5)",
      }}
    >
      {isLoading && (
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
});

// ─── Utility: merge adjacent rects on the same line ───

function mergeRects(rects: PdfRect[]): PdfRect[] {
  if (rects.length <= 1) return rects;

  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const merged: PdfRect[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];

    // Same line if y-overlap > 50% of height
    const yOverlap = Math.min(prev.y + prev.h, curr.y + curr.h) - Math.max(prev.y, curr.y);
    if (yOverlap > Math.min(prev.h, curr.h) * 0.5) {
      // Merge
      const x = Math.min(prev.x, curr.x);
      const y = Math.min(prev.y, curr.y);
      const right = Math.max(prev.x + prev.w, curr.x + curr.w);
      const bottom = Math.max(prev.y + prev.h, curr.y + curr.h);
      merged[merged.length - 1] = { x, y, w: right - x, h: bottom - y };
    } else {
      merged.push(curr);
    }
  }

  return merged;
}
