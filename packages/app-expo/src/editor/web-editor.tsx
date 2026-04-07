/**
 * Custom 10tap web editor entry point.
 *
 * Extends the default 10tap setup with:
 * - @tiptap/markdown (for markdown serialisation, including HighlightRef)
 * - HighlightRefExtension (custom atom block node with HTML NodeView)
 * - Selection tracking: posts __selection__ messages back to RN so the
 *   native side can trigger AI actions on selected text.
 *
 * Built by scripts/build-editor.js into assets/editor/editor.html
 * Then loaded via `customSource` in useEditorBridge.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { EditorContent } from "@tiptap/react";
import { useTenTap } from "@10play/tentap-editor/src/webEditorUtils";
import { TenTapStartKit } from "@10play/tentap-editor/src/bridges/StarterKit";
import { Markdown } from "@tiptap/markdown";
import { HighlightRefExtension } from "./highlight-ref-extension";
import { Extension } from "@tiptap/core";

// ─── Custom extensions to inject ─────────────────────────────────────────────

/**
 * Tiny extension that posts the selected text to the RN host whenever the
 * selection changes.  The RN side uses this to drive the AI panel.
 */
const SelectionReporterExtension = Extension.create({
  name: "selectionReporter",

  addOptions() {
    return {
      /** Milliseconds to debounce the selection post. */
      debounce: 300,
    };
  },

  onCreate() {
    (this as any)._timer = null;
  },

  onSelectionUpdate({ editor }) {
    const self = this as any;
    if (self._timer) clearTimeout(self._timer);
    self._timer = setTimeout(() => {
      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to, " ");

      if (
        typeof window !== "undefined" &&
        (window as any).ReactNativeWebView?.postMessage
      ) {
        (window as any).ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "__selection__",
            payload: { text: selectedText, from, to },
          })
        );
      }
    }, (this.options as any).debounce ?? 300);
  },
});

const EXTRA_TIPTAP_EXTENSIONS = [
  Markdown.configure({
    html: false,
    tightLists: true,
  }),
  HighlightRefExtension,
  SelectionReporterExtension,
];

// ─── Tiptap component ─────────────────────────────────────────────────────────

function Tiptap() {
  // Filter bridges by whitelist if provided (same logic as tentap's Tiptap.tsx)
  const tenTapExtensions = TenTapStartKit.filter(
    (e) =>
      !window.whiteListBridgeExtensions ||
      window.whiteListBridgeExtensions.includes(e.name),
  );

  const editor = useTenTap({
    bridges: tenTapExtensions,
    tiptapOptions: {
      extensions: EXTRA_TIPTAP_EXTENSIONS,
    },
  });

  return (
    <EditorContent
      editor={editor}
      className={window.dynamicHeight ? "dynamic-height" : undefined}
    />
  );
}

// ─── Bootstrap (same pattern as tentap's index.tsx) ──────────────────────────

declare global {
  interface Window {
    contentInjected: boolean | undefined;
    whiteListBridgeExtensions: string[];
    dynamicHeight?: boolean;
  }
}

let interval: ReturnType<typeof setInterval>;
interval = setInterval(() => {
  if (!window.contentInjected) return;
  const container = document.getElementById("root");
  const root = createRoot(container!);
  root.render(<Tiptap />);
  clearInterval(interval);
}, 1);
