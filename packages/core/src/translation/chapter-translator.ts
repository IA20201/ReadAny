/**
 * Chapter Translator — core logic for translating entire chapters.
 *
 * Supports progressive translation with chunking, caching, cancellation,
 * and both AI (numbered batch) and DeepL providers.
 */

import type { TranslationConfig } from "../types/translation";
import { getFromCache, storeInCache } from "./cache";
import { aiTranslateBatch } from "./providers";
import { deeplTranslate } from "./providers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChapterParagraph {
  /** Unique id within the chapter, e.g. "para_0" */
  id: string;
  /** Raw text content */
  text: string;
  /** HTML tag name of the source element (p, h1, li, …) */
  tagName: string;
}

export interface ChapterTranslationProgress {
  totalParagraphs: number;
  translatedCount: number;
}

export interface ChapterTranslationResult {
  paragraphId: string;
  originalText: string;
  translatedText: string;
}

export interface TranslateChapterOptions {
  paragraphs: ChapterParagraph[];
  sourceLang: string;
  targetLang: string;
  config: TranslationConfig;
  /** How many paragraphs per API call (default 5) */
  chunkSize?: number;
  /** Max concurrent chunk requests (default 2) */
  concurrency?: number;
  /** Called after each chunk is translated */
  onProgress?: (progress: ChapterTranslationProgress) => void;
  /** Called with results for each completed chunk – enables progressive injection */
  onChunkComplete?: (results: ChapterTranslationResult[]) => void;
  /** Abort signal – checked between chunks */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function translateChapter(
  options: TranslateChapterOptions,
): Promise<ChapterTranslationResult[]> {
  const {
    paragraphs,
    sourceLang,
    targetLang,
    config,
    chunkSize = 5,
    concurrency = 2,
    onProgress,
    onChunkComplete,
    signal,
  } = options;

  const providerId = config.provider.id;

  // 1. Check cache for each paragraph -----------------------------------------
  const allResults: ChapterTranslationResult[] = [];
  const uncachedParas: ChapterParagraph[] = [];

  await Promise.all(
    paragraphs.map(async (p) => {
      const cached = await getFromCache(p.text, sourceLang, targetLang, providerId);
      if (cached) {
        allResults.push({
          paragraphId: p.id,
          originalText: p.text,
          translatedText: cached,
        });
      } else {
        uncachedParas.push(p);
      }
    }),
  );

  // Emit cached results immediately so the UI can render them
  if (allResults.length > 0) {
    onChunkComplete?.(allResults);
  }

  let translatedCount = allResults.length;
  onProgress?.({ totalParagraphs: paragraphs.length, translatedCount });

  if (uncachedParas.length === 0) {
    return allResults;
  }

  // 2. Split uncached paragraphs into chunks -----------------------------------
  const chunks: ChapterParagraph[][] = [];
  for (let i = 0; i < uncachedParas.length; i += chunkSize) {
    chunks.push(uncachedParas.slice(i, i + chunkSize));
  }

  // 3. Process chunks with bounded concurrency ---------------------------------
  const newResults: ChapterTranslationResult[] = [];
  let chunkIndex = 0;

  async function processNextChunk(): Promise<void> {
    while (chunkIndex < chunks.length) {
      if (signal?.aborted) return;

      const idx = chunkIndex++;
      const chunk = chunks[idx];
      const texts = chunk.map((p) => p.text);

      let translatedTexts: string[];

      try {
        if (providerId === "ai") {
          translatedTexts = await aiTranslateBatch(
            texts,
            sourceLang,
            targetLang,
            config.provider.apiKey || "",
            config.provider.baseUrl || "",
            config.provider.model || "",
          );
        } else {
          // DeepL — natively supports batch
          translatedTexts = await deeplTranslate(
            texts,
            sourceLang,
            targetLang,
            config.provider.apiKey || "",
            config.provider.baseUrl,
          );
        }
      } catch (err) {
        // On error, fill with empty strings so we don't break the loop
        console.error("[translateChapter] chunk error:", err);
        translatedTexts = texts.map(() => "");
      }

      // Store results + cache
      const chunkResults: ChapterTranslationResult[] = [];
      for (let i = 0; i < chunk.length; i++) {
        const result: ChapterTranslationResult = {
          paragraphId: chunk[i].id,
          originalText: chunk[i].text,
          translatedText: translatedTexts[i] || "",
        };
        chunkResults.push(result);
        newResults.push(result);

        if (translatedTexts[i]) {
          storeInCache(chunk[i].text, translatedTexts[i], sourceLang, targetLang, providerId).catch(
            () => {},
          );
        }
      }

      translatedCount += chunk.length;
      onProgress?.({ totalParagraphs: paragraphs.length, translatedCount });
      onChunkComplete?.(chunkResults);
    }
  }

  // Launch `concurrency` workers
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, chunks.length); i++) {
    workers.push(processNextChunk());
  }
  await Promise.all(workers);

  return [...allResults, ...newResults];
}
