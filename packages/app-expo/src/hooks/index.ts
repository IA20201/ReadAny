/**
 * Hooks for React Native
 */

export function useStreamingChat(_options?: unknown) {
  return {
    messages: [],
    isLoading: false,
    error: null,
    sendMessage: async () => {
      console.warn("useStreamingChat: AI features not available in React Native");
    },
    clearMessages: () => {},
    retry: async () => {},
  };
}

export type StreamingChatOptions = Record<string, unknown>;
export type StreamingState = "idle" | "loading" | "error" | "streaming";

export interface SessionEventSource {
  emit: (event: string, data: unknown) => void;
}

const sessionEventListeners = new Map<string, Set<(data: unknown) => void>>();

export const rnSessionEventSource: SessionEventSource = {
  emit: (event: string, data: unknown) => {
    const listeners = sessionEventListeners.get(event);
    if (listeners) {
      listeners.forEach((fn) => fn(data));
    }
  },
};

export function setSessionEventSource(source: SessionEventSource): void {
  Object.assign(rnSessionEventSource, source);
}

export { useDebounce } from "./use-debounce";
export { useThrottledValue, useThrottledCallback } from "./use-throttled-value";
