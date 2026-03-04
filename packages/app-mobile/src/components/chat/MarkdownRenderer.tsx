/**
 * MarkdownRenderer — mobile-optimized markdown renderer for AI responses.
 * Simplified from desktop version: no mermaid, no beautiful-mermaid dependency.
 */
import { Check, Copy, ArrowUpRight } from "lucide-react";
import React, { useMemo, useState } from "react";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import type { CitationPart } from "@readany/core/types/message";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded-md bg-background/80 p-1.5 text-muted-foreground active:bg-muted"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
  citations?: CitationPart[];
  onCitationClick?: (citation: CitationPart) => void;
}

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeHighlight];

function processCitationText(
  children: React.ReactNode,
  citations?: CitationPart[],
  onCitationClick?: (citation: CitationPart) => void,
): React.ReactNode {
  if (!citations || citations.length === 0) return children;

  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      const parts = child.split(/(\[\d+\])/g);
      return parts.map((part, i) => {
        const match = part.match(/\[(\d+)\]/);
        if (match) {
          const num = parseInt(match[1]);
          const citation = citations[num - 1];
          if (citation) {
            return (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCitationClick?.(citation);
                }}
                className="inline-flex items-baseline text-primary font-semibold text-[0.7em] align-super border-none bg-transparent p-0 mx-0.5"
                title={citation.chapterTitle}
              >
                [{num}]
                <ArrowUpRight className="inline h-2.5 w-2.5 ml-0.5" />
              </button>
            );
          }
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      });
    }
    return child;
  });
}

function createMdComponents(
  citations?: CitationPart[],
  onCitationClick?: (citation: CitationPart) => void,
) {
  return {
    code({
      className: codeClassName,
      children,
      ...props
    }: React.ComponentProps<"code">) {
      const text = String(children).replace(/\n$/, "");
      const langMatch = /language-(\w+)/.exec(codeClassName || "");
      const lang = langMatch?.[1];

      if (!lang && !text.includes("\n")) {
        return (
          <code
            className="rounded-md bg-muted px-1.5 py-0.5 text-[0.85em] font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <div className="relative my-2">
          {lang && (
            <div className="absolute left-3 top-0 z-10 rounded-b-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {lang}
            </div>
          )}
          <CopyButton text={text} />
          <pre className="!mt-0 !mb-0 overflow-x-auto rounded-lg border bg-muted/30 p-3 pt-6 text-xs">
            <code className={codeClassName} {...props}>
              {children}
            </code>
          </pre>
        </div>
      );
    },

    a({ href, children, ...props }: React.ComponentProps<"a">) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline decoration-primary/30 underline-offset-2"
          {...props}
        >
          {children}
        </a>
      );
    },

    table({ children, ...props }: React.ComponentProps<"table">) {
      return (
        <div className="my-3 overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm" {...props}>
            {children}
          </table>
        </div>
      );
    },
    th({ children, ...props }: React.ComponentProps<"th">) {
      return (
        <th className="bg-muted/50 px-3 py-2 text-left text-xs font-semibold" {...props}>
          {processCitationText(children, citations, onCitationClick)}
        </th>
      );
    },
    td({ children, ...props }: React.ComponentProps<"td">) {
      return (
        <td className="border-t px-3 py-2 text-sm" {...props}>
          {processCitationText(children, citations, onCitationClick)}
        </td>
      );
    },

    p({ children, ...props }: React.ComponentProps<"p">) {
      return <p {...props}>{processCitationText(children, citations, onCitationClick)}</p>;
    },
    li({ children, ...props }: React.ComponentProps<"li">) {
      return <li {...props}>{processCitationText(children, citations, onCitationClick)}</li>;
    },
    strong({ children, ...props }: React.ComponentProps<"strong">) {
      return <strong {...props}>{processCitationText(children, citations, onCitationClick)}</strong>;
    },
    em({ children, ...props }: React.ComponentProps<"em">) {
      return <em {...props}>{processCitationText(children, citations, onCitationClick)}</em>;
    },
    blockquote({ children, ...props }: React.ComponentProps<"blockquote">) {
      return (
        <blockquote {...props}>{processCitationText(children, citations, onCitationClick)}</blockquote>
      );
    },
  };
}

let mdStreamIdCounter = 0;

export const MarkdownRenderer = React.memo(function MarkdownRenderer({
  content,
  className,
  isStreaming,
  citations,
  onCitationClick,
}: MarkdownRendererProps) {
  const scopeId = useMemo(() => `md-stream-${++mdStreamIdCounter}`, []);

  const mdComponents = useMemo(
    () => createMdComponents(citations, onCitationClick),
    [citations, onCitationClick],
  );

  const displayContent = isStreaming ? `${content}\u200B` : content;

  return (
    <div className={className} data-md-scope={isStreaming ? scopeId : undefined}>
      <Markdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={mdComponents}
      >
        {displayContent}
      </Markdown>
      {isStreaming && (
        <style>{`
          [data-md-scope="${scopeId}"] > *:last-child::after {
            content: "";
            display: inline-block;
            width: 3px;
            height: 1em;
            background: hsl(var(--primary));
            border-radius: 1px;
            margin-left: 2px;
            vertical-align: text-bottom;
            animation: cursor-blink 1s step-end infinite;
          }
          @keyframes cursor-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>
      )}
    </div>
  );
});
