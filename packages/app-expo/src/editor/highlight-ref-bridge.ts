/**
 * HighlightRefBridge — React Native (10tap) bridge for the HighlightRef node.
 *
 * This is the NATIVE side of the bridge.  The WebView side lives in:
 *   src/editor/highlight-ref-extension.ts
 *
 * The bridge exposes a single `insertHighlightRef(attrs)` method that the
 * native toolbar / highlight-picker can call to insert a HighlightRef block
 * at the current cursor position inside the WebView editor.
 *
 * No Tiptap extension is registered here (tiptapExtension is undefined) because
 * the node is registered entirely inside the custom web bundle.  We only need
 * the RN ↔ WebView message channel.
 */
import { BridgeExtension } from "@10play/tentap-editor";
import type { Editor } from "@tiptap/core";

// ─── Message types ────────────────────────────────────────────────────────────

export enum HighlightRefActionType {
  InsertHighlightRef = "insert-highlight-ref",
}

export interface HighlightRefAttrs {
  text: string;
  chapterTitle?: string;
  note?: string;
  color?: string;
}

type HighlightRefMessage = {
  type: HighlightRefActionType.InsertHighlightRef;
  payload: HighlightRefAttrs;
};

// ─── Bridge ──────────────────────────────────────────────────────────────────

export const HighlightRefBridge = new BridgeExtension<
  {},
  { insertHighlightRef: (attrs: HighlightRefAttrs) => void },
  HighlightRefMessage
>({
  // No tiptapExtension — the node is already registered inside the custom
  // web-editor.html bundle (highlight-ref-extension.ts).
  forceName: "highlightRef",

  /**
   * Called inside the WebView when a message arrives from RN.
   * Inserts the highlight-ref atom node at the current cursor.
   */
  onBridgeMessage: (editor: Editor, message: HighlightRefMessage) => {
    if (message.type === HighlightRefActionType.InsertHighlightRef) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "highlightRef",
          attrs: message.payload,
        })
        .run();
      return true;
    }
    return false;
  },

  /**
   * Extends the EditorBridge on the RN side with `insertHighlightRef`.
   */
  extendEditorInstance: (sendBridgeMessage: (msg: HighlightRefMessage) => void) => ({
    insertHighlightRef: (attrs: HighlightRefAttrs) =>
      sendBridgeMessage({
        type: HighlightRefActionType.InsertHighlightRef,
        payload: attrs,
      }),
  }),
});
