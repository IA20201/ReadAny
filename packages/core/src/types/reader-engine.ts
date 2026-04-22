/**
 * IReaderEngine — Unified reader engine interface.
 *
 * Both FoliateViewer (EPUB/MOBI/CBZ) and PDFReader implement this interface,
 * allowing ReaderView to interact with them through a single API.
 *
 * The `location` parameter is a string that can be either:
 * - EPUB CFI: "epubcfi(/6/14!/4/2/1:0)"
 * - PDF Location: "pdf:5:72.3,100.2,200.5,14.8"
 *
 * See `pdf-location.ts` for the PDF format specification.
 */

import type { HighlightColor } from "./annotation";

/** Selection info returned by the reader engine */
export interface ReaderSelection {
  text: string;
  location: string; // CFI or PDF location
  range?: { x: number; y: number; width: number; height: number };
  annotated?: boolean;
  color?: HighlightColor;
}

/** Search result from the reader engine */
export interface ReaderSearchResult {
  location: string; // CFI or PDF location
  excerpt: string;
  sectionIndex?: number;
  sectionTitle?: string;
}

/** Relocate event detail */
export interface ReaderRelocateDetail {
  fraction: number; // 0-1 progress
  location: string; // CFI or PDF location
  tocItem?: { label: string; href: string };
  section?: { current: number; total: number };
  page?: { current: number; total: number };
}

/** TOC item */
export interface ReaderTOCItem {
  label: string;
  href: string;
  subitems?: ReaderTOCItem[];
}

/** Annotation to render in the reader */
export interface ReaderAnnotation {
  id: string;
  location: string; // CFI or PDF location
  color: string;
  type: "highlight" | "underline";
  hasNote?: boolean;
}

/** TTS text segment */
export interface ReaderTTSSegment {
  text: string;
  location: string; // CFI or PDF location
}

/**
 * Unified reader engine interface.
 *
 * Implementations:
 * - FoliateViewer: EPUB, MOBI, AZW, CBZ, FB2, TXT (via foliate-js)
 * - PDFReader: PDF (via pdfjs-dist, direct rendering)
 */
export interface IReaderEngine {
  // --- Navigation ---
  goToLocation(location: string): void;
  goToFraction(fraction: number): void;
  nextPage(): void;
  prevPage(): void;

  // --- Content ---
  getSelection(): ReaderSelection | null;
  search(opts: { query: string; matchCase?: boolean; wholeWords?: boolean }): void;
  clearSearch(): void;

  // --- Annotations ---
  addAnnotation(annotation: ReaderAnnotation): void;
  removeAnnotation(id: string): void;
  highlightTemporarily(location: string, durationMs?: number): void;

  // --- TTS ---
  getVisibleTTSSegments(): ReaderTTSSegment[];
  setTTSHighlight(location: string | null): void;

  // --- State ---
  getCurrentLocation(): string; // CFI or PDF location
  getTotalPages(): number;
  getCurrentPage(): number;
  getTOC(): ReaderTOCItem[];

  // --- Lifecycle ---
  destroy(): void;
}
