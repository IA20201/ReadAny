/**
 * Chapter-level Cache Metadata
 *
 * Tracks whether a full chapter has already been translated so we can
 * skip the per-paragraph cache lookup on subsequent visits.
 */

import { getPlatformService } from "../services/platform";

const CHAPTER_CACHE_PREFIX = "readany_chapter_translated_";

function getChapterKey(bookId: string, sectionIndex: number, targetLang: string): string {
  return `${CHAPTER_CACHE_PREFIX}${bookId}_${sectionIndex}_${targetLang}`;
}

/** Check if every paragraph in a chapter is already cached */
export async function isChapterFullyCached(
  bookId: string,
  sectionIndex: number,
  targetLang: string,
): Promise<boolean> {
  try {
    const platform = getPlatformService();
    const key = getChapterKey(bookId, sectionIndex, targetLang);
    const value = await platform.kvGetItem(key);
    return value === "1";
  } catch {
    return false;
  }
}

/** Mark a chapter as fully cached (call after all paragraphs translated) */
export async function markChapterFullyCached(
  bookId: string,
  sectionIndex: number,
  targetLang: string,
): Promise<void> {
  try {
    const platform = getPlatformService();
    const key = getChapterKey(bookId, sectionIndex, targetLang);
    await platform.kvSetItem(key, "1");
  } catch {
    // Ignore storage errors
  }
}
