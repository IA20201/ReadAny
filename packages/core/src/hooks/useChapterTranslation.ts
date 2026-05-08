/**
 * useChapterTranslation Hook
 *
 * State-machine hook that orchestrates whole-chapter translation:
 * idle → extracting → translating → complete | error
 *
 * Supports progressive injection, cancellation, and visibility toggle.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AIConfig } from "../types";
import { useSettingsStore } from "../stores/settings-store";
import {
  clearChapterCache,
  isChapterFullyCached,
  markChapterFullyCached,
} from "../translation/chapter-cache";
import { getFromCache } from "../translation/cache";
import type {
  ChapterParagraph,
  ChapterTranslationProgress,
  ChapterTranslationResult,
} from "../translation/chapter-translator";
import { translateChapter } from "../translation/chapter-translator";
import type { TranslationConfig } from "../types/translation";

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type ChapterTranslationState =
  | { status: "idle" }
  | { status: "extracting" }
  | { status: "translating"; progress: ChapterTranslationProgress }
  | { status: "complete"; originalVisible: boolean; translationVisible: boolean }
  | { status: "error"; message: string };

export interface UseChapterTranslationOptions {
  bookId: string;
  sectionIndex: number;
  aiConfig?: AIConfig;
  translationConfig?: TranslationConfig;
  /** Whether the reader is ready (DOM loaded) — auto-restore waits for this */
  ready?: boolean;
  /** Extract paragraphs from the current section DOM */
  getParagraphs: () => Promise<ChapterParagraph[]> | ChapterParagraph[];
  /** Inject translated paragraphs into the DOM */
  injectTranslations: (results: ChapterTranslationResult[]) => void;
  /** Remove all injected translations from the DOM */
  removeTranslations: () => void;
  /** Apply visibility settings to the DOM */
  applyVisibility?: (originalVisible: boolean, translationVisible: boolean) => void;
  /** Get current reader position (CFI) — used to restore position after translation injection */
  getCurrentCfi?: () => string | undefined;
  /** Navigate to a CFI — used to restore position after translation injection */
  goToCfi?: (cfi: string) => void;
}

export function useChapterTranslation(options: UseChapterTranslationOptions) {
  const {
    bookId,
    sectionIndex,
    aiConfig: aiConfigOverride,
    ready = true,
    translationConfig: translationConfigOverride,
    getParagraphs,
    injectTranslations,
    removeTranslations,
    applyVisibility,
    getCurrentCfi,
    goToCfi,
  } = options;

  const [state, setState] = useState<ChapterTranslationState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const startTranslationRef = useRef<() => void>(() => {});

  const translationConfigFromStore = useSettingsStore((s) => s.translationConfig);
  const aiConfigFromStore = useSettingsStore((s) => s.aiConfig);
  const translationConfig = translationConfigOverride || translationConfigFromStore;
  const aiConfig = aiConfigOverride || aiConfigFromStore;

  // ---- Start Translation ---------------------------------------------------
  /** @param overrideTargetLang — if provided, overrides the settings targetLang for this run */
  const startTranslation = useCallback(
    async (overrideTargetLang?: string) => {
      // Clear previous translation if any
      if (state.status !== "idle") {
        abortRef.current?.abort();
        abortRef.current = null;
        removeTranslations();
        await clearChapterCache(bookId, sectionIndex);
      }

      // Build effective config (resolve AI endpoint)
      const config = { ...translationConfig };
      if (overrideTargetLang) {
        config.targetLang = overrideTargetLang as typeof config.targetLang;
      }
      if (config.provider.id === "ai") {
        const endpointId = config.provider.endpointId || aiConfig.activeEndpointId;
        const endpoint = aiConfig.endpoints.find((e) => e.id === endpointId);
        if (endpoint) {
          config.provider = {
            ...config.provider,
            apiKey: endpoint.apiKey,
            baseUrl: endpoint.baseUrl,
            useExactRequestUrl: endpoint.useExactRequestUrl,
            model: config.provider.model || aiConfig.activeModel,
          };
        }
      }

      setState({ status: "extracting" });

      try {
        const paragraphs = await getParagraphs();

        if (!paragraphs || paragraphs.length === 0) {
          setState({ status: "error", message: "No text to translate" });
          return;
        }

        const abortController = new AbortController();
        abortRef.current = abortController;

        const totalChars = paragraphs.reduce((sum, p) => sum + p.text.length, 0);
        setState({
          status: "translating",
          progress: { totalChars, translatedChars: 0 },
        });

        await translateChapter({
          paragraphs,
          sourceLang: "AUTO",
          targetLang: config.targetLang,
          config,
          onProgress: (progress) => {
            setState({ status: "translating", progress });
          },
          onChunkComplete: (results) => {
            injectTranslations(results);
          },
          signal: abortController.signal,
        });

        // Mark chapter fully cached
        markChapterFullyCached(bookId, sectionIndex, config.targetLang).catch((err) => console.warn("[Translation] Failed to mark chapter cached:", err));

        setState({ status: "complete", originalVisible: true, translationVisible: true });
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          // Cancelled — keep whatever was already injected, go to complete
          setState({ status: "complete", originalVisible: true, translationVisible: true });
        } else {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        abortRef.current = null;
      }
    },
    [state.status, translationConfig, aiConfig, bookId, sectionIndex, getParagraphs, injectTranslations, removeTranslations],
  );

  // Keep ref in sync so auto-restore effect doesn't depend on startTranslation identity
  startTranslationRef.current = startTranslation;

  // ---- Cancel ---------------------------------------------------------------
  const cancelTranslation = useCallback(() => {
    abortRef.current?.abort();
    // State will be set to complete in the catch block above
  }, []);

  // ---- Toggle Original Visibility -------------------------------------------
  const toggleOriginalVisible = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "complete") return prev;
      const newVisible = !prev.originalVisible;
      // Apply to DOM
      applyVisibility?.(newVisible, prev.translationVisible);
      return { ...prev, originalVisible: newVisible };
    });
  }, [applyVisibility]);

  // ---- Toggle Translation Visibility ----------------------------------------
  const toggleTranslationVisible = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "complete") return prev;
      const newVisible = !prev.translationVisible;
      // Apply to DOM
      applyVisibility?.(prev.originalVisible, newVisible);
      return { ...prev, translationVisible: newVisible };
    });
  }, [applyVisibility]);

  // ---- Reset (e.g. on chapter change) ---------------------------------------
  const reset = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    removeTranslations();
    setState({ status: "idle" });
    // Note: we do NOT clear the persistent chapter cache here.
    // This allows auto-restore to work when the user returns to this chapter.
  }, [removeTranslations]);

  // ---- Auto-restore cached translations on section load -----------------------
  useEffect(() => {
    if (!ready || state.status !== "idle") return;

    let cancelled = false;
    // Delay to ensure reader position is fully stable before injecting
    const timer = setTimeout(async () => {
      try {
        const cached = await isChapterFullyCached(bookId, sectionIndex, translationConfig.targetLang);
        if (!cached || cancelled) return;

        const paragraphs = await getParagraphs();
        if (cancelled) return;
        const providerId = translationConfig.provider.id;
        const results: ChapterTranslationResult[] = [];

        for (const p of paragraphs) {
          const translation = await getFromCache(
            p.text,
            "AUTO",
            translationConfig.targetLang,
            providerId,
          );
          if (translation) {
            results.push({
              paragraphId: p.id,
              originalText: p.text,
              translatedText: translation,
            });
          }
        }

        if (results.length > 0 && !cancelled) {
          // Remember position before injection
          const cfiBeforeInject = getCurrentCfi?.();

          injectTranslations(results);

          // Restore position after DOM change (prevents jump)
          if (cfiBeforeInject && goToCfi) {
            setTimeout(() => goToCfi(cfiBeforeInject), 50);
          }

          setState({
            status: "complete",
            originalVisible: true,
            translationVisible: true,
          });
        }
      } catch (err) {
        console.warn("[Translation] Auto-restore translation failed:", err);
      }
    }, 1500); // Wait for reader position to fully stabilize

    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, bookId, sectionIndex, translationConfig.targetLang]);

  return { state, startTranslation, cancelTranslation, toggleOriginalVisible, toggleTranslationVisible, reset };
}
