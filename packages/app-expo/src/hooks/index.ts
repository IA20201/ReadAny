/**
 * Hooks for React Native
 */

// Use the RN-safe stub instead of the core version (which pulls in LangChain/Node APIs)
export { useStreamingChat } from "./use-streaming-chat.rn";
export type { StreamingChatOptions, StreamingState } from "./use-streaming-chat.rn";

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
