/**
 * Lightweight hook for one-shot AI text transformations (expand, explain, translate).
 * Uses createChatModel directly — no full reading agent / RAG tools needed.
 */
import { useCallback, useRef, useState } from "react";
import { createChatModel } from "../ai/llm-provider";
import type { AIConfig } from "../types";

export type AITextActionType = "expand" | "explain" | "translate";

export interface AITextActionResult {
  isRunning: boolean;
  result: string | null;
  error: string | null;
  run: (text: string, action: AITextActionType, lang?: string) => Promise<void>;
  cancel: () => void;
  clear: () => void;
}

function buildSystemPrompt(action: AITextActionType, lang?: string): string {
  switch (action) {
    case "expand":
      return "You are a writing assistant. Expand and elaborate the user's text while preserving its style and meaning. Return only the expanded text, no explanation.";
    case "explain":
      return "You are a knowledgeable assistant. Briefly explain the given text or concept in plain language. Return only the explanation, no introduction.";
    case "translate":
      return `You are a professional translator. Translate the user's text into ${lang || "English"}. Return only the translation, no explanation.`;
    default:
      return "You are a helpful writing assistant.";
  }
}

function buildUserPrompt(text: string, action: AITextActionType): string {
  switch (action) {
    case "expand":
      return `Expand this text:\n\n${text}`;
    case "explain":
      return `Explain this:\n\n${text}`;
    case "translate":
      return text;
    default:
      return text;
  }
}

export function useAITextAction(aiConfig: AIConfig): AITextActionResult {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (text: string, action: AITextActionType, lang?: string) => {
      if (!text.trim()) return;

      // Cancel previous run if any
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsRunning(true);
      setResult(null);
      setError(null);

      try {
        const model = await createChatModel(aiConfig, {
          temperature: 0.7,
          maxTokens: 2048,
          streaming: true,
        });

        const { HumanMessage, SystemMessage } = await import("@langchain/core/messages");
        const systemPrompt = buildSystemPrompt(action, lang);
        const userPrompt = buildUserPrompt(text, action);

        const stream = await model.stream([
          new SystemMessage(systemPrompt),
          new HumanMessage(userPrompt),
        ], { signal: controller.signal });

        let accumulated = "";
        for await (const chunk of stream) {
          if (controller.signal.aborted) break;
          const content = typeof chunk.content === "string" ? chunk.content : "";
          accumulated += content;
          setResult(accumulated);
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") return;
        setError((err as Error)?.message ?? "AI request failed");
      } finally {
        setIsRunning(false);
      }
    },
    [aiConfig],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { isRunning, result, error, run, cancel, clear };
}
