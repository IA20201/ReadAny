/**
 * PDF Location Identifier — unified location format for PDF documents.
 *
 * Format: "pdf:{page}" or "pdf:{page}:{x},{y},{w},{h};{x},{y},{w},{h};..."
 *
 * Examples:
 *   "pdf:5"                          — page 5, no specific position
 *   "pdf:5:72.3,100.2,200.5,14.8"   — page 5, single rect
 *   "pdf:5:72,100,200,14;72,120,200,14" — page 5, two rects (multi-line highlight)
 *
 * These strings are stored in the same `cfi` TEXT columns as EPUB CFI strings.
 * The "pdf:" prefix distinguishes them from EPUB CFI format.
 */

export interface PdfRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfLocation {
  page: number;
  rects: PdfRect[];
}

const PDF_PREFIX = "pdf:";

/** Check if a location string is a PDF location (vs EPUB CFI) */
export function isPdfLocation(loc: string | undefined | null): boolean {
  return typeof loc === "string" && loc.startsWith(PDF_PREFIX);
}

/** Parse a PDF location string into structured data */
export function parsePdfLocation(loc: string): PdfLocation {
  if (!loc.startsWith(PDF_PREFIX)) {
    throw new Error(`Not a PDF location: ${loc}`);
  }

  const body = loc.slice(PDF_PREFIX.length);
  const colonIdx = body.indexOf(":");

  if (colonIdx === -1) {
    // "pdf:5" — page only
    return { page: Number.parseInt(body, 10), rects: [] };
  }

  const page = Number.parseInt(body.slice(0, colonIdx), 10);
  const rectsStr = body.slice(colonIdx + 1);

  if (!rectsStr) {
    return { page, rects: [] };
  }

  const rects = rectsStr.split(";").map((r) => {
    const [x, y, w, h] = r.split(",").map(Number);
    return { x, y, w, h };
  });

  return { page, rects };
}

/** Format a PDF location into a string for storage */
export function formatPdfLocation(page: number, rects?: PdfRect[]): string {
  if (!rects || rects.length === 0) {
    return `${PDF_PREFIX}${page}`;
  }

  const rectsStr = rects
    .map((r) => `${round(r.x)},${round(r.y)},${round(r.w)},${round(r.h)}`)
    .join(";");

  return `${PDF_PREFIX}${page}:${rectsStr}`;
}

/** Extract just the page number from a PDF location string */
export function getPdfPage(loc: string): number {
  if (!isPdfLocation(loc)) return 0;
  return parsePdfLocation(loc).page;
}

/** Create a page-only PDF location (for bookmarks, reading progress) */
export function pdfPageLocation(page: number): string {
  return `${PDF_PREFIX}${page}`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
