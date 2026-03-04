/**
 * MobileChatPanel — full-screen chat panel inside reader, book-scoped.
 * Slides up from bottom as a sheet overlay.
 */
import { useStreamingChat } from "@readany/core/hooks";
import { convertToMessageV2, mergeMessagesWithStreaming } from "@readany/core/utils/chat-utils";
import { useChatStore } from "@readany/core/stores";
import type { AttachedQuote, Book, CitationPart } from "@readany/core/types";
import { Brain, History, MessageCirclePlus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MobileChatInput } from "./MobileChatInput";
import { MessageList } from "./MessageList";
import { MobileModelSelector } from "./MobileModelSelector";

interface MobileChatPanelProps {
  book?: Book | null;
  open: boolean;
  onClose: () => void;
  onNavigateToCitation?: (citation: CitationPart) => void;
}

function formatRelativeTime(ts: number, t: (key: string) => string): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("chat.justNow");
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

export function MobileChatPanel({
  book,
  open,
  onClose,
  onNavigateToCitation,
}: MobileChatPanelProps) {
  const { t } = useTranslation();
  const bookId = book?.id;

  const {
    threads,
    loadThreads,
    createThread,
    removeThread,
    setBookActiveThread,
    getActiveThreadId,
    getThreadsForContext,
  } = useChatStore();

  const { isStreaming, currentMessage, currentStep, sendMessage, stopStream } =
    useStreamingChat({ book: book || null, bookId });

  useEffect(() => {
    if (bookId && open) loadThreads(bookId);
  }, [bookId, open, loadThreads]);

  const activeThreadId = bookId ? getActiveThreadId(bookId) : null;
  const activeThread = threads.find((th) => th.id === activeThreadId);
  const bookThreads = bookId ? getThreadsForContext(bookId) : [];

  const [showThreadList, setShowThreadList] = useState(false);
  const [attachedQuotes, setAttachedQuotes] = useState<AttachedQuote[]>([]);
  const threadListRef = useRef<HTMLDivElement>(null);

  // Close thread list on outside tap
  useEffect(() => {
    if (!showThreadList) return;
    const handler = (e: TouchEvent | MouseEvent) => {
      if (threadListRef.current && !threadListRef.current.contains(e.target as Node)) {
        setShowThreadList(false);
      }
    };
    document.addEventListener("touchstart", handler);
    return () => document.removeEventListener("touchstart", handler);
  }, [showThreadList]);

  // Listen for "Ask AI" from reader selection
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.bookId === bookId && detail?.selectedText) {
        const newQuote: AttachedQuote = {
          id: crypto.randomUUID(),
          text: detail.selectedText,
          source: detail.chapterTitle,
        };
        setAttachedQuotes((prev) => {
          if (prev.some((q) => q.text === newQuote.text)) return prev;
          return [...prev, newQuote];
        });
      }
    };
    window.addEventListener("ask-ai-from-reader", handler);
    return () => window.removeEventListener("ask-ai-from-reader", handler);
  }, [bookId]);

  // Check pending quote on mount
  useEffect(() => {
    if (!open || !bookId) return;
    const pendingKey = `pending-ai-quote-${bookId}`;
    const pending = sessionStorage.getItem(pendingKey);
    if (pending) {
      try {
        const detail = JSON.parse(pending);
        if (detail?.selectedText) {
          const newQuote: AttachedQuote = {
            id: crypto.randomUUID(),
            text: detail.selectedText,
            source: detail.chapterTitle,
          };
          setAttachedQuotes((prev) => {
            if (prev.some((q) => q.text === newQuote.text)) return prev;
            return [...prev, newQuote];
          });
        }
      } catch {
        // ignore
      }
      sessionStorage.removeItem(pendingKey);
    }
  }, [open, bookId]);

  const handleSend = useCallback(
    (content: string, deepThinking: boolean = false, quotes?: AttachedQuote[]) => {
      sendMessage(content, bookId, deepThinking, quotes);
      setAttachedQuotes([]);
    },
    [sendMessage, bookId],
  );

  const handleRemoveQuote = useCallback((id: string) => {
    setAttachedQuotes((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const handleNewThread = useCallback(async () => {
    if (!bookId) return;
    if (activeThread && activeThread.messages.length === 0) return;
    await createThread(bookId);
  }, [bookId, activeThread, createThread]);

  const displayMessages = activeThread?.messages || [];
  const storeMessages = convertToMessageV2(displayMessages);
  const allMessages = mergeMessagesWithStreaming(storeMessages, currentMessage, isStreaming);

  const SUGGESTIONS = [
    t("chat.suggestions.summarizeChapter"),
    t("chat.suggestions.explainConcepts"),
    t("chat.suggestions.analyzeAuthor"),
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="relative flex h-12 shrink-0 items-center justify-between border-b border-border/50 px-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 active:bg-muted"
          >
            <X className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowThreadList(!showThreadList)}
            className={`flex items-center gap-1 rounded-full p-1.5 ${
              showThreadList ? "bg-primary/10 text-primary" : "text-muted-foreground active:bg-muted"
            }`}
          >
            <History className="size-4" />
            {bookThreads.length > 1 && (
              <span className="text-[10px]">{bookThreads.length}</span>
            )}
          </button>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 text-sm font-medium truncate max-w-[50vw]">
          AI 助手
        </div>

        <div className="flex items-center gap-1">
          <MobileModelSelector />
          <button
            type="button"
            onClick={handleNewThread}
            className="rounded-full p-1.5 text-muted-foreground active:bg-muted"
          >
            <MessageCirclePlus className="size-4" />
          </button>
        </div>

        {/* Thread list dropdown */}
        {showThreadList && bookThreads.length > 0 && (
          <div
            ref={threadListRef}
            className="absolute left-2 right-2 top-12 z-50 animate-in fade-in slide-in-from-top-1 duration-150 rounded-lg border bg-background shadow-lg"
          >
            <div className="max-h-56 overflow-y-auto p-1.5">
              {bookThreads.map((thread) => {
                const lastMsg =
                  thread.messages.length > 0
                    ? thread.messages[thread.messages.length - 1]
                    : null;
                const preview = lastMsg?.content?.slice(0, 60) || "";
                return (
                  <div
                    key={thread.id}
                    className={`flex items-start gap-2 rounded-md px-2.5 py-2 transition-colors ${
                      thread.id === activeThreadId
                        ? "bg-primary/10 text-primary"
                        : "text-neutral-600 active:bg-muted"
                    }`}
                    onClick={() => {
                      if (bookId) setBookActiveThread(bookId, thread.id);
                      setShowThreadList(false);
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium">
                          {thread.title || t("chat.newChat")}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground/50">
                          {formatRelativeTime(thread.updatedAt, t)}
                        </span>
                      </div>
                      {preview && (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {preview}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeThread(thread.id);
                      }}
                      className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground active:bg-destructive/10 active:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Messages or Empty */}
      <div className="flex-1 overflow-hidden">
        {allMessages.length > 0 ? (
          <MessageList
            messages={allMessages}
            isStreaming={isStreaming}
            currentStep={currentStep}
            onStop={stopStream}
            onCitationClick={onNavigateToCitation}
          />
        ) : (
          <div className="flex h-full flex-col items-start justify-end gap-3 overflow-y-auto p-4 pb-6">
            <div className="flex flex-col items-start gap-3 pl-1">
              <div className="rounded-full bg-muted/70 p-2.5">
                <Brain className="size-6 text-primary" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">{t("chat.aiAssistant")}</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {t("chat.aiAssistantDesc")}
                </p>
              </div>
            </div>
            <div className="w-full space-y-0.5">
              {SUGGESTIONS.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => handleSend(text)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-neutral-700 active:bg-muted/70"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="shrink-0 px-3 pb-2 pt-1"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        <MobileChatInput
          onSend={handleSend}
          disabled={isStreaming}
          placeholder={t("chat.askBookPlaceholder")}
          quotes={attachedQuotes}
          onRemoveQuote={handleRemoveQuote}
        />
      </div>
    </div>
  );
}
