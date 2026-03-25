import type { ILocalEmbeddingEngine } from "@readany/core/ai/local-embedding-service";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";

const MODELS_DIR = `${FileSystem.documentDirectory}models/`;

/**
 * React Native embedding engine using react-native-transformers + onnxruntime-react-native.
 *
 * Runs ONNX models via native C++ inference (no WASM, no base64 hacks).
 */
export class RNEmbeddingEngine implements ILocalEmbeddingEngine {
  private pipeline: {
    init: (
      modelName: string,
      onnxPath: string,
      options?: Record<string, unknown>,
    ) => Promise<void>;
    embed: (text: string) => Promise<Float32Array>;
    release: () => Promise<void>;
  } | null = null;
  private loaded = false;

  async init(): Promise<void> {
    // No-op — lazily loaded in load() to avoid crashing on standard App startup.
  }

  async load(
    modelId: string,
    hfModelId: string,
    onProgress?: (p: number) => void,
  ): Promise<void> {
    const isExpoGo =
      Constants.executionEnvironment === "storeClient" ||
      Constants.appOwnership === "expo";
    if (isExpoGo) {
      throw new Error(
        "本地向量模型推理依赖 ONNX C++ 原生引擎库。Expo Go 沙盒均不提供。请编译自定义原生客户端体验本地大模型！",
      );
    }

    try {
      // TextEmbedding pipeline exists in the module but is not exported from the package index.
      // Import directly from the subpath.
      const TextEmbeddingPipeline = (
        await import(
          // @ts-expect-error — subpath not declared in package.json "exports"
          "react-native-transformers/lib/module/pipelines/text-embedding.js"
        )
      ).default;
      this.pipeline = TextEmbeddingPipeline;

      await FileSystem.makeDirectoryAsync(MODELS_DIR, {
        intermediates: true,
      }).catch(() => {});

      console.log(`[RNEmbeddingEngine] Loading model ${hfModelId}...`);

      /**
       * Custom fetch: downloads HuggingFace model files to local storage.
       * Returns the local file URI so ONNX Runtime can read from disk.
       */
      const customFetch = async (url: string): Promise<string> => {
        const safeName = url.replace(/[^a-zA-Z0-9._-]/g, "_");
        const localUri = `${MODELS_DIR}${safeName}`;

        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (fileInfo.exists) {
          console.log(
            `[RNEmbeddingEngine] Cache HIT: ${url.split("/").pop()}`,
          );
          return localUri;
        }

        console.log(
          `[RNEmbeddingEngine] Downloading: ${url.split("/").pop()}`,
        );

        const downloadResumable = FileSystem.createDownloadResumable(
          url,
          localUri,
          {},
          (downloadProgress) => {
            if (
              onProgress &&
              downloadProgress.totalBytesExpectedToWrite > 0
            ) {
              const pct =
                (downloadProgress.totalBytesWritten /
                  downloadProgress.totalBytesExpectedToWrite) *
                100;
              onProgress(pct);
            }
          },
        );

        const result = await downloadResumable.downloadAsync();
        if (!result || result.status !== 200) {
          throw new Error(`Failed to download model file: ${url}`);
        }

        console.log(
          `[RNEmbeddingEngine] Downloaded: ${url.split("/").pop()}`,
        );
        return result.uri;
      };

      await this.pipeline!.init(hfModelId, "model_quantized.onnx", {
        fetch: customFetch,
      });

      this.loaded = true;
      console.log(`[RNEmbeddingEngine] Model ${hfModelId} ready!`);
    } catch (e) {
      console.error("[RNEmbeddingEngine] Failed to load model:", e);
      throw e;
    }
  }

  async generate(
    modelId: string,
    texts: string[],
    onItemProgress?: (done: number, total: number) => void,
  ): Promise<number[][]> {
    if (!this.loaded || !this.pipeline) {
      throw new Error("RNEmbeddingEngine pipeline not loaded.");
    }

    const embeddings: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      const output = await this.pipeline.embed(texts[i]);
      // output is Float32Array — convert to standard JS array
      embeddings.push(Array.from(output));
      onItemProgress?.(i + 1, texts.length);
    }
    return embeddings;
  }

  async dispose(): Promise<void> {
    if (this.loaded && this.pipeline) {
      try {
        await this.pipeline.release();
      } catch (e) {
        console.warn("[RNEmbeddingEngine] Error releasing pipeline:", e);
      }
      this.pipeline = null;
      this.loaded = false;
    }
  }

  async clearCache(hfModelId: string): Promise<void> {
    // Release loaded model first
    await this.dispose();

    try {
      const dirInfo = await FileSystem.getInfoAsync(MODELS_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(MODELS_DIR, { idempotent: true });
        console.log(
          `[RNEmbeddingEngine] Cleared model cache for ${hfModelId}`,
        );
      }
    } catch (e) {
      console.warn("[RNEmbeddingEngine] Failed to clear cache:", e);
    }
  }
}
