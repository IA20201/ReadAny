/**
 * PartRenderer — renders individual message parts (text, reasoning, tool calls, citations)
 * Mobile-optimized version.
 */
import { cn } from "@readany/core/utils";
import {
  CheckCircle,
  ChevronDown,
  Circle,
  Loader2,
  XCircle,
  Brain,
  Wrench,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import type {
  Part,
  TextPart,
  ReasoningPart,
  ToolCallPart,
  CitationPart,
} from "@readany/core/types/message";
import { MarkdownRenderer } from "./MarkdownRenderer";

const TEXT_RENDER_THROTTLE_MS = 100;

function useThrottledText(text: string): string {
  const [throttledText, setThrottledText] = useState(text);
  const lastUpdateRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;
    const remaining = TEXT_RENDER_THROTTLE_MS - timeSinceLastUpdate;

    if (remaining <= 0) {
      lastUpdateRef.current = now;
      setThrottledText(text);
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      lastUpdateRef.current = Date.now();
      setThrottledText(text);
    }, remaining);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [text]);

  return throttledText;
}

interface PartProps {
  part: Part;
  citations?: CitationPart[];
  onCitationClick?: (citation: CitationPart) => void;
}

export function PartRenderer({ part, citations, onCitationClick }: PartProps) {
  switch (part.type) {
    case "text":
      return <TextPartView part={part} citations={citations} onCitationClick={onCitationClick} />;
    case "reasoning":
      return <ReasoningPartView part={part} />;
    case "tool_call":
      return <ToolCallPartView part={part} />;
    case "citation":
      return null;
    case "mindmap":
      return null;
    default:
      return null;
  }
}

function TextPartView({
  part,
  citations,
  onCitationClick,
}: {
  part: TextPart;
  citations?: CitationPart[];
  onCitationClick?: (citation: CitationPart) => void;
}) {
  const throttledText = useThrottledText(part.text);
  const isStreaming = part.status === "running";

  if (!throttledText.trim()) {
    if (isStreaming) {
      return (
        <div className="chat-markdown max-w-none text-sm leading-relaxed">
          <span className="inline-block h-4 w-[3px] animate-pulse rounded-sm bg-primary" />
        </div>
      );
    }
    return null;
  }

  return (
    <div className="chat-markdown max-w-none text-sm leading-relaxed">
      <MarkdownRenderer
        content={throttledText}
        isStreaming={isStreaming}
        citations={citations}
        onCitationClick={onCitationClick}
      />
    </div>
  );
}

function ReasoningPartView({ part }: { part: ReasoningPart }) {
  const [isOpen, setIsOpen] = useState(part.status === "running");
  const throttledText = useThrottledText(part.text);

  useEffect(() => {
    if (part.status === "running") setIsOpen(true);
  }, [part.status]);

  if (!throttledText.trim()) return null;

  return (
    <div className="my-1">
      <div className="overflow-hidden rounded-lg border border-violet-200 bg-violet-50/50">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 active:bg-violet-100/50"
        >
          <div className="flex flex-1 items-center gap-2 overflow-hidden">
            {part.status === "running" ? (
              <div className="h-3 w-3 animate-pulse rounded-full bg-violet-400" />
            ) : (
              <Brain className="h-4 w-4 text-violet-600" />
            )}
            <span className="text-sm font-medium text-violet-700">
              {part.status === "running" ? "正在思考..." : "思考过程"}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-violet-400 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </button>
        {isOpen && (
          <div className="max-h-48 overflow-y-auto border-t border-violet-200/50 bg-white/50 p-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-violet-900">
              {throttledText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  ragSearch: "搜索书籍内容",
  ragToc: "获取目录结构",
  ragContext: "获取上下文",
  summarize: "生成摘要",
  extractEntities: "提取实体",
  analyzeArguments: "分析论证",
  findQuotes: "查找金句",
  getAnnotations: "获取标注",
  compareSections: "对比章节",
  getCurrentChapter: "获取当前章节",
  getSelection: "获取选中内容",
  getReadingProgress: "获取阅读进度",
  getRecentHighlights: "获取最近标注",
  getSurroundingContext: "获取上下文",
  listBooks: "查询书籍列表",
  searchAllHighlights: "搜索所有高亮",
  searchAllNotes: "搜索所有笔记",
  getReadingStats: "获取阅读统计",
  getSkills: "查询技能",
  mindmap: "生成思维导图",
};

function ToolCallPartView({ part }: { part: ToolCallPart }) {
  const [isOpen, setIsOpen] = useState(false);

  const getStatusIcon = () => {
    switch (part.status) {
      case "pending":
        return <Circle className="h-4 w-4 text-neutral-300" />;
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Circle className="h-4 w-4 text-neutral-300" />;
    }
  };

  const label = TOOL_LABELS[part.name] || part.name;
  const queryText = part.args.query ? String(part.args.query) : "";

  return (
    <div className="my-1">
      <div className="overflow-hidden rounded-lg border border-neutral-200">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 active:bg-neutral-50"
        >
          <div className="flex flex-1 items-center gap-2 overflow-hidden">
            {getStatusIcon()}
            <Wrench className="h-3.5 w-3.5 text-neutral-500" />
            <span className="text-sm font-medium text-neutral-700">{label}</span>
            {queryText && (
              <span className="flex-1 truncate font-mono text-xs text-neutral-500">
                {queryText.slice(0, 30)}
              </span>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-neutral-400 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </button>
        {isOpen && (
          <div className="space-y-3 border-t border-neutral-100 bg-neutral-50/50 p-3">
            {Object.keys(part.args).length > 0 && (
              <div>
                <h4 className="mb-1.5 text-xs font-medium text-neutral-500">参数</h4>
                <div className="rounded border border-neutral-200 bg-white p-2 font-mono text-xs break-all">
                  {Object.entries(part.args).map(([key, value]) => (
                    <div key={key} className="mb-0.5 last:mb-0">
                      <span className="text-neutral-400">{key}:</span>{" "}
                      <span className="text-neutral-600">
                        {typeof value === "string" && value.length > 80
                          ? `${value.slice(0, 80)}...`
                          : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {part.result !== undefined && (
              <div>
                <h4 className="mb-1.5 text-xs font-medium text-neutral-500">结果</h4>
                <div className="max-h-36 overflow-auto rounded border border-neutral-200 bg-white p-2 font-mono text-xs">
                  <pre className="whitespace-pre-wrap text-neutral-600">
                    {typeof part.result === "string" && part.result.length > 300
                      ? `${part.result.slice(0, 300)}...`
                      : JSON.stringify(part.result, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            {part.error && (
              <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-600">
                {part.error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
