/**
 * MessageList — mobile scrollable message list with streaming support
 */
import type { MessageV2, CitationPart, QuotePart } from "@readany/core/types/message";
import { ArrowDown, Quote } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PartRenderer } from "./PartRenderer";
import { StreamingIndicator } from "./StreamingIndicator";

interface MessageListProps {
  messages: MessageV2[];
  onCitationClick?: (citation: CitationPart) => void;
  isStreaming?: boolean;
  currentStep?: "thinking" | "tool_calling" | "responding" | "idle";
  onStop?: () => void;
}

const BOTTOM_THRESHOLD = 80;

export function MessageList({
  messages,
  onCitationClick,
  isStreaming,
  currentStep,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const userAtBottomRef = useRef(true);

  const isNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = containerRef.current;
    if (!el) return;
    if (behavior === "smooth") {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = isNearBottom();
      userAtBottomRef.current = nearBottom;
      setShowScrollDown(!nearBottom);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isNearBottom]);

  useEffect(() => {
    if (userAtBottomRef.current) scrollToBottom("smooth");
  }, [messages.length, messages[messages.length - 1]?.parts.length, scrollToBottom]);

  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      if (userAtBottomRef.current) scrollToBottom("smooth");
    }, 300);
    return () => clearInterval(interval);
  }, [isStreaming, scrollToBottom]);

  const handleScrollToBottom = useCallback(() => {
    userAtBottomRef.current = true;
    setShowScrollDown(false);
    scrollToBottom("smooth");
  }, [scrollToBottom]);

  const lastMsg = messages[messages.length - 1];
  const showStreamingIndicator =
    isStreaming &&
    currentStep &&
    currentStep !== "idle" &&
    (!lastMsg || lastMsg.role !== "assistant" || lastMsg.parts.length === 0);

  const isLastMsgStreaming =
    isStreaming &&
    !!lastMsg &&
    lastMsg.role === "assistant" &&
    lastMsg.parts.length > 0;

  return (
    <div ref={containerRef} className="relative flex h-full flex-col overflow-y-auto py-3">
      <div className="mx-auto flex w-full flex-col gap-3 px-4">
        {messages.map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onCitationClick={onCitationClick}
            isStreaming={idx === messages.length - 1 && isLastMsgStreaming}
            currentStep={currentStep}
          />
        ))}
        {showStreamingIndicator && <StreamingIndicator step={currentStep!} />}
      </div>

      {showScrollDown && (
        <div className="sticky bottom-2 z-10 flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={handleScrollToBottom}
            className="pointer-events-auto flex items-center gap-1 rounded-full border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-md backdrop-blur-sm active:bg-muted"
          >
            <ArrowDown className="size-3.5" />
            <span>回到底部</span>
          </button>
        </div>
      )}
    </div>
  );
}

function UserQuoteBlock({ part }: { part: QuotePart }) {
  return (
    <div className="flex gap-2 rounded-lg bg-primary/5 border border-primary/15 px-2.5 py-2">
      <Quote className="mt-0.5 size-3 shrink-0 text-primary/50" />
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-relaxed text-foreground/80">
          {part.text.length > 200 ? `${part.text.slice(0, 200)}...` : part.text}
        </p>
        {part.source && (
          <p className="mt-1 text-[10px] text-muted-foreground">— {part.source}</p>
        )}
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: MessageV2;
  onCitationClick?: (citation: CitationPart) => void;
  isStreaming?: boolean;
  currentStep?: "thinking" | "tool_calling" | "responding" | "idle";
}

function MessageBubble({ message, onCitationClick, isStreaming, currentStep }: MessageBubbleProps) {
  if (message.role === "user") {
    const quoteParts = message.parts.filter((p) => p.type === "quote") as QuotePart[];
    const textParts = message.parts.filter((p) => p.type === "text");

    return (
      <div className="group mt-4 flex max-w-full flex-col first:mt-0">
        <div className="max-w-[85%] self-end rounded-2xl bg-muted px-3 py-2 text-sm leading-relaxed">
          {quoteParts.length > 0 && (
            <div className="mb-2 flex flex-col gap-1.5">
              {quoteParts.map((q) => (
                <UserQuoteBlock key={q.id} part={q} />
              ))}
            </div>
          )}
          {textParts.length > 0 && (
            <div className="whitespace-pre-wrap">
              {textParts.map((part) =>
                part.type === "text" ? <span key={part.id}>{part.text}</span> : null,
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const hasContent = message.parts.some(
    (p) => (p.type === "text" && p.text.trim()) || p.type !== "text",
  );
  if (!hasContent) return null;

  const citations = message.parts.filter((p) => p.type === "citation") as CitationPart[];

  const lastPart = message.parts[message.parts.length - 1];
  const isLastPartRunningText = lastPart?.type === "text" && lastPart.status === "running";
  const isLastPartActiveToolCall =
    lastPart?.type === "tool_call" &&
    (lastPart.status === "pending" || lastPart.status === "running");
  const showGapIndicator =
    isStreaming &&
    currentStep !== "idle" &&
    lastPart &&
    !isLastPartRunningText &&
    !isLastPartActiveToolCall;

  return (
    <div className="group flex w-full flex-col gap-1">
      {message.parts.map((part) => (
        <PartRenderer
          key={part.id}
          part={part}
          citations={citations}
          onCitationClick={onCitationClick}
        />
      ))}
      {showGapIndicator && <StreamingIndicator step="thinking" />}
    </div>
  );
}
