/**
 * HighlightRefExtension — Tiptap custom atom block node that renders a
 * book highlight as a styled card inside the knowledge-note editor.
 *
 * Serialises to Markdown as:
 *   :::highlight-ref text="…" chapterTitle="…" note="…" color="yellow":::
 *
 * That single-line fence can be round-tripped: it is parsed back into the
 * node when the document is loaded from saved Markdown.
 */
import { Node, mergeAttributes } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import type { ReactNodeViewProps } from "@tiptap/react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { useState } from "react";

// ─── Attribute helpers ───────────────────────────────────────────────────────

/** Encode a value so it can be embedded in an attr string without breakage. */
function encodeAttr(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/** Decode a value extracted from an attr string. */
function decodeAttr(value: string): string {
  return value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

// ─── Serialisation / deserialisation ─────────────────────────────────────────

const FENCE_PREFIX = ":::highlight-ref ";
const FENCE_SUFFIX = ":::";

function serialise(attrs: Record<string, string>): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(attrs)) {
    if (val) parts.push(`${key}="${encodeAttr(val)}"`);
  }
  return `${FENCE_PREFIX}${parts.join(" ")}${FENCE_SUFFIX}`;
}

/** Parse `key="value"` pairs from the inline attr string. */
function parseAttrString(src: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /(\w+)="((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: intentional loop
  while ((m = re.exec(src)) !== null) {
    result[m[1]] = decodeAttr(m[2]);
  }
  return result;
}

// ─── React card component ─────────────────────────────────────────────────────

const COLOR_DOT: Record<string, string> = {
  yellow: "bg-yellow-400",
  red: "bg-red-400",
  blue: "bg-blue-400",
  green: "bg-green-400",
  purple: "bg-purple-400",
  pink: "bg-pink-400",
  violet: "bg-violet-400",
  orange: "bg-orange-400",
};

function HighlightRefCard({ node, selected, deleteNode }: ReactNodeViewProps) {
  const { text, chapterTitle, note, color } = node.attrs as Record<string, string>;
  const dotClass = COLOR_DOT[color] ?? "bg-muted-foreground/40";
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Only show the expand toggle if there's content that might be clipped
  const hasNote = !!note;

  return (
    <NodeViewWrapper>
      <div
        contentEditable={false}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={[
          "group relative my-2 flex items-start gap-2 rounded-lg border px-3 py-2.5 select-none transition-colors duration-150",
          selected
            ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
            : "border-border/50 bg-muted/30 hover:border-border hover:bg-muted/50",
        ].join(" ")}
        data-drag-handle
      >
        {/* Color dot */}
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />

        <div className="min-w-0 flex-1 pr-6">
          {/* Quoted text */}
          <p className={["text-[13px] leading-relaxed text-foreground italic", expanded ? "" : "line-clamp-4"].join(" ")}>
            {text}
          </p>

          {/* Chapter title */}
          {chapterTitle ? (
            <p className="mt-1 text-[11px] text-muted-foreground truncate">— {chapterTitle}</p>
          ) : null}

          {/* User note */}
          {hasNote ? (
            <p className={["mt-1.5 text-[12px] text-muted-foreground leading-relaxed border-t border-border/30 pt-1.5", expanded ? "" : "line-clamp-2"].join(" ")}>
              {note}
            </p>
          ) : null}

          {/* Expand / collapse toggle */}
          {hasNote && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="mt-1 text-[11px] text-primary/70 hover:text-primary transition-colors duration-100"
            >
              {expanded ? "收起" : "展开笔记"}
            </button>
          )}
        </div>

        {/* Delete button — appears on hover or when selected */}
        {(hovered || selected) && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              deleteNode();
            }}
            className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/50 transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"
            title="删除引用"
          >
            <svg
              viewBox="0 0 12 12"
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <line x1="2" y1="2" x2="10" y2="10" />
              <line x1="10" y1="2" x2="2" y2="10" />
            </svg>
          </button>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ─── Extension ───────────────────────────────────────────────────────────────

export const HighlightRefExtension = Node.create({
  name: "highlightRef",

  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      text: { default: "" },
      chapterTitle: { default: "" },
      note: { default: "" },
      color: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-highlight-ref]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-highlight-ref": "true" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(HighlightRefCard);
  },

  // ── Markdown integration (via @tiptap/markdown) ───────────────────────────

  // Tokeniser: teach marked to recognise the `:::highlight-ref …:::` line
  markdownTokenizer: {
    name: "highlightRef",
    level: "block",
    start: FENCE_PREFIX,
    tokenize(src) {
      const re = /^:::highlight-ref ([^\n]*):::/;
      const m = re.exec(src);
      if (!m) return;
      const attrs = parseAttrString(m[1]);
      return {
        type: "highlightRef",
        raw: m[0],
        ...attrs,
      } as ReturnType<NonNullable<typeof this.tokenize>>;
    },
  },

  // Parser: convert the marked token to a Tiptap node
  parseMarkdown(token) {
    const { text, chapterTitle, note, color } = token as Record<string, string>;
    return {
      type: "highlightRef",
      attrs: { text: text ?? "", chapterTitle: chapterTitle ?? "", note: note ?? "", color: color ?? "" },
    } as JSONContent;
  },

  // Renderer: serialise the Tiptap node back to our fence syntax
  renderMarkdown(node: JSONContent) {
    const { text = "", chapterTitle = "", note = "", color = "" } = (node.attrs ?? {}) as Record<string, string>;
    return serialise({ text, chapterTitle, note, color }) + "\n";
  },
});
