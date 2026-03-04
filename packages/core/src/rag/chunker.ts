/**
 * Segment-aware chunker — creates chunks directly from TextSegments
 * Each chunk preserves precise CFI references for navigation.
 *
 * Strategy: Group consecutive segments into chunks by token count,
 * preserving the first segment's CFI as startCfi and last as endCfi.
 */
import type { Chunk } from "../types";
import type { TextSegment } from "./rag-types";

export interface ChunkerConfig {
  targetTokens: number;
  minTokens: number;
  overlapRatio: number;
}

const DEFAULT_CONFIG: ChunkerConfig = {
  targetTokens: 300,
  minTokens: 50,
  overlapRatio: 0.2,
};

/**
 * Create chunks from segments with precise CFI mapping.
 *
 * Each segment has a CFI, so we group consecutive segments into chunks
 * while preserving CFI boundaries.
 */
export function chunkContent(
  _content: string,
  bookId: string,
  chapterIndex: number,
  chapterTitle: string,
  config: ChunkerConfig = DEFAULT_CONFIG,
  segments?: TextSegment[],
): Chunk[] {
  if (!segments || segments.length === 0) {
    return [];
  }

  const chunks: Chunk[] = [];
  let currentTexts: string[] = [];
  let currentTokens = 0;
  let startCfi = "";
  let endCfi = "";

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segText = seg.text.trim();
    if (!segText) continue;

    const segTokens = estimateTokens(segText);

    if (currentTokens + segTokens > config.targetTokens && currentTokens >= config.minTokens && currentTexts.length > 0) {
      chunks.push(createChunkFromSegments(
        currentTexts.join("\n\n"),
        bookId,
        chapterIndex,
        chapterTitle,
        chunks.length,
        startCfi,
        endCfi,
      ));

      const overlapTokens = Math.floor(currentTokens * config.overlapRatio);
      const overlapResult = getOverlapSegments(currentTexts, segments, i, overlapTokens);
      currentTexts = overlapResult.texts;
      currentTokens = overlapResult.tokens;
      startCfi = overlapResult.startCfi;
      endCfi = seg.cfi;
      currentTexts.push(segText);
      currentTokens += segTokens;
    } else {
      if (currentTexts.length === 0) {
        startCfi = seg.cfi;
      }
      currentTexts.push(segText);
      currentTokens += segTokens;
      endCfi = seg.cfi;
    }
  }

  if (currentTokens >= config.minTokens || (currentTexts.length > 0 && chunks.length === 0)) {
    chunks.push(createChunkFromSegments(
      currentTexts.join("\n\n"),
      bookId,
      chapterIndex,
      chapterTitle,
      chunks.length,
      startCfi,
      endCfi,
    ));
  }

  console.log(`[chunker] Chapter ${chapterIndex} created ${chunks.length} chunks, first 3 CFIs:`,
    chunks.slice(0, 3).map(c => ({ content: c.content.slice(0, 30), startCfi: c.startCfi, endCfi: c.endCfi })));

  return chunks;
}

function createChunkFromSegments(
  content: string,
  bookId: string,
  chapterIndex: number,
  chapterTitle: string,
  index: number,
  startCfi: string,
  endCfi: string,
): Chunk {
  return {
    id: `${bookId}-${chapterIndex}-${index}`,
    bookId,
    chapterIndex,
    chapterTitle,
    content,
    tokenCount: estimateTokens(content),
    startCfi,
    endCfi,
  };
}

function getOverlapSegments(
  currentTexts: string[],
  segments: TextSegment[],
  currentIndex: number,
  targetTokens: number,
): { texts: string[]; tokens: number; startCfi: string } {
  const targetChars = targetTokens * 4;
  let charCount = 0;
  const overlapTexts: string[] = [];

  for (let i = currentTexts.length - 1; i >= 0; i--) {
    const text = currentTexts[i];
    charCount += text.length;
    overlapTexts.unshift(text);
    if (charCount >= targetChars) break;
  }

  const segmentOffset = currentIndex - overlapTexts.length;
  const startCfi = segmentOffset >= 0 && segments[segmentOffset]
    ? segments[segmentOffset].cfi
    : (segments[0]?.cfi || "");

  return {
    texts: overlapTexts,
    tokens: estimateTokens(overlapTexts.join("\n\n")),
    startCfi,
  };
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
