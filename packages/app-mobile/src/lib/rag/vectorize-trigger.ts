/**
 * Vectorize Trigger — app-layer adapter that bridges platform-specific
 * concerns (Zustand stores, book file extraction) with the core vectorization pipeline.
 */
import {
  triggerVectorizeBook as coreTriggerVectorizeBook,
  type VectorizeStatusCallback,
  type VectorizeTriggerConfig,
} from "@readany/core/rag";
import { useLibraryStore } from "@/stores/library-store";
import { useVectorModelStore } from "@readany/core/stores/vector-model-store";
import { extractBookChapters } from "./book-extractor";

export type { VectorizeStatusCallback };

/**
 * App-level wrapper: reads store state, extracts chapters from the book file,
 * then delegates to the core pipeline.
 */
export async function triggerVectorizeBook(
  bookId: string,
  filePath: string,
  onProgress?: VectorizeStatusCallback,
): Promise<void> {
  const vmState = useVectorModelStore.getState();

  const config: VectorizeTriggerConfig = {
    vectorModelEnabled: vmState.vectorModelEnabled,
    vectorModelMode: vmState.vectorModelMode,
    selectedBuiltinModelId: vmState.selectedBuiltinModelId,
    remoteModel: (() => {
      const selected = vmState.getSelectedVectorModel();
      if (!selected) return null;
      return {
        url: selected.url,
        apiKey: selected.apiKey,
        modelId: selected.modelId,
      };
    })(),
  };

  const callbacks = {
    onBookUpdate: useLibraryStore.getState().updateBook,
  };

  // Report "extracting" phase so the UI can show progress immediately
  onProgress?.({
    bookId,
    totalChunks: 0,
    processedChunks: 0,
    status: "chunking", // Reuse "chunking" status for extraction phase
  });

  const chapters = await extractBookChapters(filePath);

  await coreTriggerVectorizeBook(
    bookId,
    chapters,
    config,
    callbacks,
    onProgress,
  );
}
