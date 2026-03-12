/**
 * Hooks for React Native
 */

// Use the RN-safe stub instead of the core version (which pulls in LangChain/Node APIs)
export { useStreamingChat } from "./use-streaming-chat.rn";
export type { StreamingChatOptions, StreamingState } from "./use-streaming-chat.rn";

export interface SessionEventSource {
  emit: (event: string, data: unknown) => void;
}

export { rnSessionEventSource } from "@/lib/platform/rn-session-event-source";

export { useDebounce } from "./use-debounce";
export { useThrottledValue, useThrottledCallback } from "./use-throttled-value";
