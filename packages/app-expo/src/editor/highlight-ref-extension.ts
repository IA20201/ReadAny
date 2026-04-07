/**
 * HighlightRef Tiptap extension — WebView (10tap) version.
 *
 * This runs INSIDE the WebView. It renders the highlight card using HTML DOM
 * (no React), since React Native is not available inside a WebView.
 *
 * Serialises to Markdown identically to the desktop extension:
 *   :::highlight-ref text="…" chapterTitle="…" note="…" color="yellow":::
 */
import { Node, mergeAttributes } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";

// ─── Attribute helpers ───────────────────────────────────────────────────────

function encodeAttr(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function decodeAttr(value: string): string {
  return value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

// ─── Serialisation ───────────────────────────────────────────────────────────

const FENCE_PREFIX = ":::highlight-ref ";
const FENCE_SUFFIX = ":::";

function serialise(attrs: Record<string, string>): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(attrs)) {
    if (val) parts.push(`${key}="${encodeAttr(val)}"`);
  }
  return `${FENCE_PREFIX}${parts.join(" ")}${FENCE_SUFFIX}`;
}

function parseAttrString(src: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /(\w+)="((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(src)) !== null) {
    result[m[1]] = decodeAttr(m[2]);
  }
  return result;
}

// ─── Color map ───────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  yellow: "#facc15",
  red: "#f87171",
  blue: "#60a5fa",
  green: "#4ade80",
  purple: "#c084fc",
  pink: "#f472b6",
  violet: "#a78bfa",
  orange: "#fb923c",
};

// ─── DOM Node View ────────────────────────────────────────────────────────────

function createHighlightRefView(attrs: Record<string, string>) {
  const { text = "", chapterTitle = "", note = "", color = "" } = attrs;
  const dotColor = COLOR_MAP[color] ?? "#94a3b8";

  const wrapper = document.createElement("div");
  wrapper.contentEditable = "false";
  wrapper.setAttribute("data-highlight-ref", "true");
  wrapper.style.cssText = `
    display: flex;
    align-items: flex-start;
    gap: 8px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    padding: 10px 12px;
    margin: 8px 0;
    user-select: none;
    cursor: default;
    position: relative;
  `;

  // Color dot
  const dot = document.createElement("span");
  dot.style.cssText = `
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${dotColor};
    flex-shrink: 0;
    margin-top: 6px;
  `;

  // Content container
  const content = document.createElement("div");
  content.style.cssText = "flex: 1; min-width: 0;";

  // Quoted text
  const textEl = document.createElement("p");
  textEl.style.cssText = `
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    font-style: italic;
    color: #1e293b;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
  `;
  textEl.textContent = text;

  content.appendChild(textEl);

  // Chapter title
  if (chapterTitle) {
    const chEl = document.createElement("p");
    chEl.style.cssText = `
      margin: 4px 0 0;
      font-size: 11px;
      color: #64748b;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    `;
    chEl.textContent = `— ${chapterTitle}`;
    content.appendChild(chEl);
  }

  // User note
  if (note) {
    const noteEl = document.createElement("p");
    noteEl.style.cssText = `
      margin: 6px 0 0;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    `;
    noteEl.textContent = note;
    content.appendChild(noteEl);
  }

  wrapper.appendChild(dot);
  wrapper.appendChild(content);

  return wrapper;
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
    return ({ node }) => {
      const dom = createHighlightRefView(node.attrs as Record<string, string>);
      return { dom };
    };
  },

  // ── Markdown integration (via @tiptap/markdown) ───────────────────────────

  markdownTokenizer: {
    name: "highlightRef",
    level: "block",
    start: FENCE_PREFIX,
    tokenize(src: string) {
      const re = /^:::highlight-ref ([^\n]*):::/;
      const m = re.exec(src);
      if (!m) return undefined;
      const attrs = parseAttrString(m[1]);
      return {
        type: "highlightRef",
        raw: m[0],
        ...attrs,
      };
    },
  },

  parseMarkdown(token: Record<string, string>) {
    const { text, chapterTitle, note, color } = token;
    return {
      type: "highlightRef",
      attrs: {
        text: text ?? "",
        chapterTitle: chapterTitle ?? "",
        note: note ?? "",
        color: color ?? "",
      },
    } as JSONContent;
  },

  renderMarkdown(node: JSONContent) {
    const { text = "", chapterTitle = "", note = "", color = "" } = (node.attrs ?? {}) as Record<string, string>;
    return serialise({ text, chapterTitle, note, color }) + "\n";
  },
});
