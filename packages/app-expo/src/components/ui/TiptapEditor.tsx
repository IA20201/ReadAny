/**
 * TiptapEditor — React Native wrapper around 10tap / Tiptap.
 *
 * Uses a custom WebView bundle (assets/editor/editor.html) that includes:
 *   - Standard 10tap TenTapStartKit bridges
 *   - HighlightRefExtension (custom atom block node)
 *   - @tiptap/markdown (Markdown serialisation)
 *
 * The component mirrors the public API of the old RichTextEditor so that
 * KnowledgeEditorScreen can swap them with minimal changes.
 *
 * Props:
 *   initialContent  — Markdown string loaded into the editor on mount.
 *   onChange        — Called with the latest Markdown on every content change.
 *   placeholder     — Placeholder text shown when the doc is empty.
 *   autoFocus       — Whether to focus the editor on mount.
 *   bookId          — Used to look up highlights in the store for the picker.
 *   onAIAction      — Called when the user triggers an AI action (optional).
 *   editable        — Defaults to true.
 *   style           — Extra styles for the outer container.
 *
 * Architecture note:
 *   Reading back Markdown content from Tiptap happens through a dedicated
 *   CoreBridge command (getMarkdown) that evaluates JS in the WebView and
 *   returns the result via postMessage.  We request a content snapshot on
 *   every `onChange` event emitted by the bridge.
 */

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { RichText, useEditorBridge, TenTapStartKit } from "@10play/tentap-editor";
import {
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  BookmarkIcon,
  Undo2Icon,
  Redo2Icon,
} from "@/components/ui/Icon";
import { useAnnotationStore } from "@/stores";
import type { Highlight } from "@readany/core/types";
import { useColors } from "@/styles/theme";
import { HighlightRefBridge } from "@/editor/highlight-ref-bridge";
import { useTranslation } from "react-i18next";

// ─── Asset import ─────────────────────────────────────────────────────────────

// The bundled HTML is emitted as a TypeScript module by scripts/build-editor.js.
// Importing it here avoids any Metro asset-loader complications.
import { editorHtml as EDITOR_HTML } from "@/editor/editorHtml";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TiptapEditorHandle {
  /** Returns the current document as a Markdown string (async via WebView eval). */
  getMarkdown: () => Promise<string>;
  /** Focus the editor. */
  focus: () => void;
}

interface TiptapEditorProps {
  initialContent?: string;
  onChange?: (markdown: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  bookId?: string;
  onAIAction?: (selectedText: string, selection: { start: number; end: number }) => void;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TiptapEditor = forwardRef<TiptapEditorHandle, TiptapEditorProps>(
  function TiptapEditor(
    {
      initialContent = "",
      onChange,
      placeholder,
      autoFocus = false,
      bookId,
      onAIAction,
      editable = true,
      style,
    },
    ref
  ) {
    const colors = useColors();
    const { t } = useTranslation();
    const s = makeStyles(colors);
    const [showHighlightPicker, setShowHighlightPicker] = useState(false);
    const [highlightSearch, setHighlightSearch] = useState("");

    // ── Bridge setup ────────────────────────────────────────────────────────

    const editor = useEditorBridge({
      // Extend the standard start kit with our custom HighlightRef bridge
      bridgeExtensions: [...TenTapStartKit, HighlightRefBridge],
      customSource: EDITOR_HTML,
      initialContent,
      autofocus: autoFocus,
      editable,
      avoidIosKeyboard: true,
      onChange: () => {
        // Request a Markdown snapshot from the WebView whenever content changes.
        // The Tiptap Markdown extension serialises via editor.storage.markdown.getMarkdown()
        editor.webviewRef.current?.injectJavaScript(`
          (function(){
            var md = window.__tiptapEditor && window.__tiptapEditor.storage
              ? window.__tiptapEditor.storage.markdown.getMarkdown()
              : '';
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: '__markdown__', payload: md }));
          })();
        `);
      },
    });

    // ── Highlight store ─────────────────────────────────────────────────────

    const { highlights } = useAnnotationStore();
    const bookHighlights = useMemo(
      () => (bookId ? highlights.filter((h) => h.bookId === bookId) : []),
      [highlights, bookId]
    );
    const filteredHighlights = useMemo(() => {
      if (!highlightSearch.trim()) return bookHighlights;
      const q = highlightSearch.toLowerCase();
      return bookHighlights.filter((h) => h.text?.toLowerCase().includes(q));
    }, [bookHighlights, highlightSearch]);

    // ── Imperative handle ───────────────────────────────────────────────────

    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        return new Promise<string>((resolve) => {
          // Subscribe to next __markdown__ message and resolve.
          const unsub = editor._subscribeToEditorStateUpdate(() => {});
          unsub(); // immediately unsub state; we handle below via custom message
          editor.webviewRef.current?.injectJavaScript(`
            (function(){
              var md = window.__tiptapEditor && window.__tiptapEditor.storage
                ? window.__tiptapEditor.storage.markdown.getMarkdown()
                : '';
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: '__markdown__', payload: md }));
            })();
          `);
          // Since we can't easily listen to a one-shot WebView message here,
          // resolve with the last known content after a small delay.
          setTimeout(() => resolve(currentMarkdownRef.current), 150);
        });
      },
      focus: () => {
        editor.focus();
      },
    }));

    // ── Content tracking ────────────────────────────────────────────────────

    const currentMarkdownRef = useRef(initialContent);

    // We patch the onChange callback to capture the Markdown via a custom
    // WebView message handler.  We wrap RichText's onMessage to intercept
    // __markdown__ and __selection__ messages.
    const handleWebViewMessage = useCallback(
      (event: { nativeEvent: { data: string } }) => {
        try {
          const msg = JSON.parse(event.nativeEvent.data);
          if (msg.type === "__markdown__") {
            currentMarkdownRef.current = msg.payload;
            onChange?.(msg.payload);
          } else if (msg.type === "__selection__") {
            const { text, from, to } = msg.payload as { text: string; from: number; to: number };
            if (text && text.trim()) {
              onAIAction?.(text, { start: from, end: to });
            }
          }
        } catch {
          // ignore non-JSON messages
        }
      },
      [onChange, onAIAction]
    );

    // ── Toolbar actions ─────────────────────────────────────────────────────

    // Cast to any since HighlightRefBridge extends EditorBridge dynamically via
    // extendEditorInstance — TypeScript doesn't see the merged type from
    // module augmentation defined in the tentap package.
    const editorAny = editor as any;

    const handleInsertHighlight = useCallback(
      (h: Highlight) => {
        editorAny.insertHighlightRef({
          text: h.text ?? "",
          chapterTitle: h.chapterTitle ?? "",
          note: h.note ?? "",
          color: h.color ?? "yellow",
        });
        setShowHighlightPicker(false);
        setHighlightSearch("");
      },
      [editorAny]
    );

    // ─── Render ─────────────────────────────────────────────────────────────

    return (
      <View style={[s.container, style]}>
        {/* ── Editor ── */}
        <KeyboardAvoidingView
          style={s.editorArea}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <RichText
            editor={editor}
            style={s.webview}
            onMessage={handleWebViewMessage}
            exclusivelyUseCustomOnMessage={false}
          />
        </KeyboardAvoidingView>

        {/* ── Toolbar ── */}
        {editable && (
          <ScrollView
            horizontal
            style={s.toolbarScroll}
            contentContainerStyle={s.toolbar}
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
          >
            <ToolbarButton icon={<BoldIcon size={18} color={colors.foreground} />} onPress={() => editor.toggleBold()} />
            <ToolbarButton icon={<ItalicIcon size={18} color={colors.foreground} />} onPress={() => editor.toggleItalic()} />
            <ToolbarButton icon={<StrikethroughIcon size={18} color={colors.foreground} />} onPress={() => editor.toggleStrike()} />
            <ToolbarSep />
            <ToolbarButton icon={<Heading1Icon size={18} color={colors.foreground} />} onPress={() => editor.toggleHeading(1)} />
            <ToolbarButton icon={<Heading2Icon size={18} color={colors.foreground} />} onPress={() => editor.toggleHeading(2)} />
            <ToolbarButton icon={<Heading3Icon size={18} color={colors.foreground} />} onPress={() => editor.toggleHeading(3)} />
            <ToolbarSep />
            <ToolbarButton icon={<ListIcon size={18} color={colors.foreground} />} onPress={() => editor.toggleBulletList()} />
            <ToolbarButton icon={<ListOrderedIcon size={18} color={colors.foreground} />} onPress={() => editor.toggleOrderedList()} />
            <ToolbarButton icon={<QuoteIcon size={18} color={colors.foreground} />} onPress={() => editor.toggleBlockquote()} />
            <ToolbarSep />
            <ToolbarButton
              icon={<BookmarkIcon size={18} color={colors.primary} />}
              onPress={() => setShowHighlightPicker(true)}
            />
            <ToolbarSep />
            <ToolbarButton icon={<Undo2Icon size={18} color={colors.foreground} />} onPress={() => editor.undo()} />
            <ToolbarButton icon={<Redo2Icon size={18} color={colors.foreground} />} onPress={() => editor.redo()} />
          </ScrollView>
        )}

        {/* ── Highlight Picker Modal ── */}
        <Modal
          visible={showHighlightPicker}
          animationType="slide"
          transparent
          onRequestClose={() => setShowHighlightPicker(false)}
        >
          <View style={s.pickerOverlay}>
            <View style={s.pickerSheet}>
              <View style={s.pickerHeader}>
                <Text style={s.pickerTitle}>{t("knowledge.insertHighlight", "插入书摘")}</Text>
                <TouchableOpacity onPress={() => setShowHighlightPicker(false)}>
                  <Text style={s.pickerClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={s.pickerSearch}
                placeholder={t("common.search", "搜索...")}
                placeholderTextColor={colors.mutedForeground}
                value={highlightSearch}
                onChangeText={setHighlightSearch}
              />
              {filteredHighlights.length === 0 ? (
                <View style={s.pickerEmpty}>
                  <Text style={s.pickerEmptyText}>
                    {bookId
                      ? t("knowledge.noHighlights", "暂无书摘")
                      : t("knowledge.selectBookFirst", "请先选择书籍")}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredHighlights}
                  keyExtractor={(h) => h.id}
                  renderItem={({ item: h }) => (
                    <TouchableOpacity
                      style={s.pickerItem}
                      onPress={() => handleInsertHighlight(h)}
                    >
                      <View style={[s.pickerDot, h.color ? { backgroundColor: h.color } : null]} />
                      <View style={s.pickerItemContent}>
                        <Text style={s.pickerItemText} numberOfLines={3}>
                          {h.text}
                        </Text>
                        {h.chapterTitle ? (
                          <Text style={s.pickerItemChapter} numberOfLines={1}>
                            — {h.chapterTitle}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>
      </View>
    );
  }
);

// ─── Toolbar helpers ──────────────────────────────────────────────────────────

function ToolbarButton({ icon, onPress }: { icon: React.ReactNode; onPress: () => void }) {
  return (
    <TouchableOpacity style={tbStyles.btn} onPress={onPress} activeOpacity={0.6}>
      {icon}
    </TouchableOpacity>
  );
}

function ToolbarSep() {
  return <View style={tbStyles.sep} />;
}

const tbStyles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  sep: {
    width: 1,
    height: 20,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 2,
  },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    editorArea: {
      flex: 1,
    },
    webview: {
      flex: 1,
      backgroundColor: "transparent",
    },
    toolbarScroll: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.muted,
      flexShrink: 0,
    },
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    // Highlight picker
    pickerOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "flex-end",
    },
    pickerSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: "70%",
      paddingBottom: 24,
    },
    pickerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pickerTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.foreground,
    },
    pickerClose: {
      fontSize: 18,
      color: colors.mutedForeground,
      padding: 4,
    },
    pickerSearch: {
      margin: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.foreground,
      fontSize: 14,
      backgroundColor: colors.muted,
    },
    pickerEmpty: {
      padding: 32,
      alignItems: "center",
    },
    pickerEmptyText: {
      color: colors.mutedForeground,
      fontSize: 14,
    },
    pickerItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 10,
    },
    pickerDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#facc15",
      marginTop: 5,
      flexShrink: 0,
    },
    pickerItemContent: {
      flex: 1,
    },
    pickerItemText: {
      fontSize: 14,
      color: colors.foreground,
      lineHeight: 20,
    },
    pickerItemChapter: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
  });
}
