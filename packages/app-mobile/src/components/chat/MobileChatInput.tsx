/**
 * MobileChatInput — touch-optimized chat input with deep thinking toggle
 */
import { ArrowUp, Brain, Quote, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AttachedQuote } from "@readany/core/types";

interface MobileChatInputProps {
  onSend: (content: string, deepThinking?: boolean, quotes?: AttachedQuote[]) => void;
  disabled?: boolean;
  placeholder?: string;
  quotes?: AttachedQuote[];
  onRemoveQuote?: (id: string) => void;
}

export function MobileChatInput({
  onSend,
  disabled,
  placeholder,
  quotes = [],
  onRemoveQuote,
}: MobileChatInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [deepThinking, setDeepThinking] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resolvedPlaceholder = placeholder || t("chat.askPlaceholder");

  const handleSend = useCallback(
    (useDeepThinking: boolean = deepThinking) => {
      const trimmed = value.trim();
      if (trimmed || quotes.length > 0) {
        onSend(trimmed, useDeepThinking, quotes.length > 0 ? quotes : undefined);
        setValue("");
        setDeepThinking(false);
        if (textareaRef.current) textareaRef.current.style.height = "auto";
      }
    },
    [value, deepThinking, onSend, quotes],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, []);

  return (
    <div className="w-full">
      <div className="relative rounded-2xl border bg-background shadow-sm">
        {/* Attached quotes chips */}
        {quotes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
            {quotes.map((q) => (
              <span
                key={q.id}
                className="inline-flex max-w-[200px] items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs text-primary"
              >
                <Quote className="size-3 shrink-0 opacity-60" />
                <span className="truncate">{q.text}</span>
                <button
                  type="button"
                  onClick={() => onRemoveQuote?.(q.id)}
                  className="ml-0.5 shrink-0 rounded-full p-0.5 active:bg-primary/10"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder={quotes.length > 0 ? t("chat.askAboutQuote") : resolvedPlaceholder}
          disabled={disabled}
          rows={1}
          className="w-full resize-none bg-transparent px-4 pb-1 pt-3 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          style={{ minHeight: 36, maxHeight: 120 }}
        />

        <div className="flex items-center justify-between px-3 pb-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDeepThinking(!deepThinking)}
              className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors ${
                deepThinking
                  ? "border-violet-300 bg-violet-50 text-violet-600"
                  : "border-neutral-200 text-muted-foreground active:bg-muted"
              }`}
            >
              <Brain className="size-3" />
              <span>{t("chat.deepThinking")}</span>
            </button>
          </div>
          <button
            type="button"
            disabled={disabled || (!value.trim() && quotes.length === 0)}
            onClick={() => handleSend()}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          >
            <ArrowUp className="size-3.5" />
          </button>
        </div>
      </div>
      {deepThinking && (
        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          {t("chat.deepThinkingHint")}
        </p>
      )}
    </div>
  );
}
