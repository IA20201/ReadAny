import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAnnotationStore } from "@/stores/annotation-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useAITextAction, type AITextActionType } from "@readany/core/hooks/use-ai-text-action";
import type { KnowledgeNote } from "@readany/core/types";
import { generateId } from "@readany/core/utils";
import { cn } from "@readany/core/utils";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Bookmark,
  Code,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Quote,
  Redo2,
  Languages,
  Lightbulb,
  Sparkles,
  Strikethrough,
  Trash2,
  Undo2,
} from "lucide-react";
/**
 * KnowledgePanel — Book Knowledge Base document editor
 * Shows a list of knowledge docs for the selected book and an inline editor.
 * Supports full-screen editing via Dialog.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HighlightPickerDialog } from "./HighlightPickerDialog";
import { HighlightRefExtension } from "./HighlightRefExtension";

interface KnowledgePanelProps {
  bookId: string;
}

export function KnowledgePanel({ bookId }: KnowledgePanelProps) {
  const { t } = useTranslation();
  const { knowledgeNotes, loadKnowledgeNotes, addKnowledgeNote, updateKnowledgeNote, removeKnowledgeNote } =
    useAnnotationStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Load knowledge notes when bookId changes
  useEffect(() => {
    loadKnowledgeNotes(bookId);
  }, [bookId, loadKnowledgeNotes]);

  // Auto-select first doc when list loads
  useEffect(() => {
    if (knowledgeNotes.length > 0 && !selectedId) {
      setSelectedId(knowledgeNotes[0].id);
    }
  }, [knowledgeNotes, selectedId]);

  const selectedNote = knowledgeNotes.find((n) => n.id === selectedId) || null;

  const handleCreateDoc = () => {
    const now = Date.now();
    const note: KnowledgeNote = {
      id: generateId(),
      bookId,
      title: t("knowledge.untitled"),
      content: "",
      createdAt: now,
      updatedAt: now,
    };
    addKnowledgeNote(note);
    setSelectedId(note.id);
  };

  const handleDeleteDoc = (id: string) => {
    removeKnowledgeNote(id);
    if (selectedId === id) {
      const remaining = knowledgeNotes.filter((n) => n.id !== id);
      setSelectedId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleUpdateTitle = (id: string, title: string) => {
    updateKnowledgeNote(id, { title });
  };

  const handleUpdateContent = useCallback(
    (id: string, content: string) => {
      updateKnowledgeNote(id, { content });
    },
    [updateKnowledgeNote],
  );

  return (
    <div className="flex h-full">
      {/* Doc list sidebar */}
      <div className="w-[220px] shrink-0 border-r border-border/40 flex flex-col bg-muted/20">
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {t("knowledge.title")}
          </span>
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-background hover:text-foreground hover:shadow-sm"
            onClick={handleCreateDoc}
            title={t("knowledge.newDoc")}
          >
            <Plus className="h-3 w-3" />
            {t("knowledge.newDoc")}
          </button>
        </div>

        {/* Doc list */}
        <div className="flex-1 overflow-y-auto py-1.5">
          {knowledgeNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50">
                <FileText className="h-5 w-5 text-muted-foreground/30" />
              </div>
              <p className="text-xs text-muted-foreground/60">{t("knowledge.empty")}</p>
              <button
                type="button"
                className="mt-3 flex items-center gap-1 rounded-lg border border-border/50 bg-background px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors duration-150 hover:border-border hover:shadow-sm"
                onClick={handleCreateDoc}
              >
                <Plus className="h-3 w-3" />
                {t("knowledge.newDoc")}
              </button>
            </div>
          ) : (
            <div className="px-2">
              {knowledgeNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  className={cn(
                    "relative w-full rounded-lg px-3 py-2.5 text-left transition-colors duration-150 group",
                    note.id === selectedId
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                  )}
                  onClick={() => setSelectedId(note.id)}
                >
                  <div className="flex items-start gap-2">
                    <FileText
                      className={cn(
                        "mt-0.5 h-3 w-3 shrink-0 transition-colors duration-150",
                        note.id === selectedId ? "text-primary" : "opacity-40",
                      )}
                    />
                    <div className="min-w-0 flex-1 pr-5">
                      <p className="truncate text-xs font-medium leading-snug">
                        {note.title || t("knowledge.untitled")}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/50">
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {/* Delete button — absolutely positioned, appears on hover */}
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 opacity-0 transition-all duration-150 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDoc(note.id);
                    }}
                    title={t("common.delete")}
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedNote ? (
          <>
            {/* Doc header — ghost title input + last modified */}
            <div className="shrink-0 border-b border-border/40 px-7 py-3 flex items-start gap-3 bg-background">
              <div className="flex-1 min-w-0">
                <Input
                  value={selectedNote.title}
                  onChange={(e) => handleUpdateTitle(selectedNote.id, e.target.value)}
                  className="border-none shadow-none focus-visible:ring-0 px-0 h-8 text-base font-semibold placeholder:text-muted-foreground/40 bg-transparent"
                  placeholder={t("knowledge.untitled")}
                />
                <p className="mt-0.5 pl-px text-[11px] text-muted-foreground/40 leading-none">
                  {new Date(selectedNote.updatedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                onClick={() => setIsFullscreen(true)}
                title={t("knowledge.fullscreen")}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Inline editor */}
            <div className="flex-1 overflow-y-auto">
              <KnowledgeEditor
                key={selectedNote.id}
                noteId={selectedNote.id}
                bookId={bookId}
                content={selectedNote.content}
                onUpdate={handleUpdateContent}
                fullHeight
              />
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
              <FileText className="h-6 w-6 text-muted-foreground/30" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground/60">{t("knowledge.selectOrCreate")}</p>
              <button
                type="button"
                className="mt-3 flex items-center gap-1.5 rounded-xl border border-border/50 bg-background px-4 py-2 text-xs font-medium text-foreground transition-colors duration-150 hover:border-border hover:shadow-sm mx-auto"
                onClick={handleCreateDoc}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("knowledge.newDoc")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen overlay */}
      {selectedNote && isFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          {/* Fullscreen header */}
          <div className="shrink-0 flex items-start gap-3 border-b border-border/40 px-8 py-3.5">
            <div className="flex-1 min-w-0">
              <Input
                value={selectedNote.title}
                onChange={(e) => handleUpdateTitle(selectedNote.id, e.target.value)}
                className="border-none shadow-none focus-visible:ring-0 px-0 h-9 text-lg font-semibold placeholder:text-muted-foreground/40 bg-transparent"
                placeholder={t("knowledge.untitled")}
              />
              <p className="mt-0.5 pl-px text-[11px] text-muted-foreground/40 leading-none">
                {new Date(selectedNote.updatedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
              onClick={() => setIsFullscreen(false)}
              title={t("common.close", "关闭")}
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {/* Editor */}
          <div className="flex-1 overflow-hidden">
            <KnowledgeEditor
              key={`fs-${selectedNote.id}`}
              noteId={selectedNote.id}
              bookId={bookId}
              content={selectedNote.content}
              onUpdate={handleUpdateContent}
              fullHeight
              autoFocus
            />
          </div>
        </div>
      )}
    </div>
  );
}

// --- Rich Editor for knowledge docs ---

interface KnowledgeEditorProps {
  noteId: string;
  bookId: string;
  content: string;
  onUpdate: (id: string, content: string) => void;
  fullHeight?: boolean;
  autoFocus?: boolean;
}

function KnowledgeEditor({ noteId, bookId, content, onUpdate, fullHeight, autoFocus }: KnowledgeEditorProps) {
  const { t } = useTranslation();
  const isInternalUpdate = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);

  const aiConfig = useSettingsStore((state) => state.aiConfig);
  const { isRunning: aiRunning, result: aiResult, error: aiError, run: runAI, cancel: cancelAI, clear: clearAI } =
    useAITextAction(aiConfig);
  const [aiAction, setAiAction] = useState<AITextActionType | null>(null);
  // Snapshot of editor selection at the moment AI is triggered — prevents
  // position drift when the user clicks away while AI is generating.
  const aiSelectionRef = useRef<{ from: number; to: number } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        dropcursor: false,
        gapcursor: false,
      }),
      Markdown.configure({
        markedOptions: { gfm: true, breaks: true },
      }),
      Placeholder.configure({
        placeholder: t("knowledge.editorPlaceholder"),
        emptyEditorClass: "is-editor-empty",
      }),
      HighlightRefExtension,
    ],
    content,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none outline-none",
          "prose-headings:font-semibold prose-headings:tracking-tight",
          "prose-h1:text-xl prose-h1:mb-2 prose-h1:mt-4",
          "prose-h2:text-lg prose-h2:mb-1.5 prose-h2:mt-3",
          "prose-h3:text-base prose-h3:mb-1 prose-h3:mt-2.5",
          "prose-p:my-2 prose-p:leading-relaxed prose-p:text-[13px]",
          "prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-li:text-[13px]",
          "prose-blockquote:border-l-primary/50 prose-blockquote:bg-muted/30 prose-blockquote:py-0.5 prose-blockquote:px-3 prose-blockquote:rounded-r prose-blockquote:not-italic prose-blockquote:text-muted-foreground",
          "prose-code:px-1.5 prose-code:py-0.5 prose-code:bg-muted prose-code:rounded prose-code:text-[12px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none",
          "prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-md prose-pre:text-[12px]",
          fullHeight ? "min-h-full" : "min-h-[200px]",
        ),
      },
    },
    onUpdate: ({ editor }) => {
      isInternalUpdate.current = true;
      const markdown = editor.getMarkdown();
      // Debounced save
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        onUpdate(noteId, markdown);
      }, 500);
    },
    immediatelyRender: false,
  });

  // Sync external content when noteId changes
  useEffect(() => {
    if (editor && !isInternalUpdate.current) {
      const currentMarkdown = editor.getMarkdown();
      if (content?.trim() !== currentMarkdown?.trim()) {
        editor.commands.setContent(content || "", { contentType: "markdown" });
      }
    }
    isInternalUpdate.current = false;
  }, [editor, content]);

  // Auto focus
  useEffect(() => {
    if (editor && autoFocus) {
      setTimeout(() => editor.commands.focus("end"), 50);
    }
  }, [editor, autoFocus]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt(t("editor.enterLink"), previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor, t]);

  const handleAIBubble = useCallback(
    (action: AITextActionType) => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      const selected = editor.state.doc.textBetween(from, to, " ");
      if (!selected.trim()) return;
      // Snapshot selection now — it may be gone by the time AI finishes
      aiSelectionRef.current = { from, to };
      setAiAction(action);
      clearAI();
      runAI(selected, action);
    },
    [editor, runAI, clearAI],
  );

  const handleAIInsertAfter = useCallback(() => {
    if (!editor || !aiResult) return;
    const sel = aiSelectionRef.current;
    const insertPos = sel ? sel.to : editor.state.doc.content.size;
    editor.chain().focus().insertContentAt(insertPos, `\n\n${aiResult}`).run();
    clearAI();
    setAiAction(null);
    aiSelectionRef.current = null;
  }, [editor, aiResult, clearAI]);

  const handleAIReplace = useCallback(() => {
    if (!editor || !aiResult) return;
    const sel = aiSelectionRef.current;
    if (!sel) return;
    editor.chain().focus().deleteRange(sel).insertContentAt(sel.from, aiResult).run();
    clearAI();
    setAiAction(null);
    aiSelectionRef.current = null;
  }, [editor, aiResult, clearAI]);

  if (!editor) return null;

  return (
    <div className={cn("flex flex-col", fullHeight ? "h-full" : "")}>
      {/* Toolbar — frosted glass effect */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/30 bg-background/80 backdrop-blur-sm px-4 py-1.5 shrink-0">
        <ToolbarGroup>
          <ToolbarBtn
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title={t("editor.undo")}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title={t("editor.redo")}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </ToolbarBtn>
        </ToolbarGroup>
        <ToolbarDivider />
        <ToolbarGroup>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive("heading", { level: 1 })}
            title={t("editor.heading1")}
          >
            <Heading1 className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive("heading", { level: 2 })}
            title={t("editor.heading2")}
          >
            <Heading2 className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive("heading", { level: 3 })}
            title={t("editor.heading3")}
          >
            <Heading3 className="h-3.5 w-3.5" />
          </ToolbarBtn>
        </ToolbarGroup>
        <ToolbarDivider />
        <ToolbarGroup>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive("bold")}
            title={t("editor.bold")}
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive("italic")}
            title={t("editor.italic")}
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive("strike")}
            title={t("editor.strikethrough")}
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive("code")}
            title={t("editor.inlineCode")}
          >
            <Code className="h-3.5 w-3.5" />
          </ToolbarBtn>
        </ToolbarGroup>
        <ToolbarDivider />
        <ToolbarGroup>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive("bulletList")}
            title={t("editor.bulletList")}
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive("orderedList")}
            title={t("editor.orderedList")}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive("blockquote")}
            title={t("editor.blockquote")}
          >
            <Quote className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title={t("editor.horizontalRule")}
          >
            <Minus className="h-3.5 w-3.5" />
          </ToolbarBtn>
        </ToolbarGroup>
        <ToolbarDivider />
        <ToolbarGroup>
          <ToolbarBtn
            onClick={() => setHighlightPickerOpen(true)}
            title={t("knowledge.insertHighlight")}
          >
            <Bookmark className="h-3.5 w-3.5" />
          </ToolbarBtn>
        </ToolbarGroup>
      </div>

      {/* Highlight picker dialog */}
      <HighlightPickerDialog
        open={highlightPickerOpen}
        onOpenChange={setHighlightPickerOpen}
        editor={editor}
        bookId={bookId}
      />

      {/* Bubble menu for AI expansion */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 100, placement: "top" }}
        className="flex items-center gap-0.5 rounded-xl border border-border/60 bg-background shadow-lg px-1.5 py-1"
      >
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors duration-150 hover:bg-muted text-muted-foreground hover:text-foreground"
          onClick={() => handleAIBubble("expand")}
          disabled={aiRunning}
        >
          <Sparkles className="h-3 w-3 text-primary" /> {t("knowledge.aiExpand", "AI 扩写")}
        </button>
        <div className="h-3.5 w-px bg-border/60" />
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors duration-150 hover:bg-muted text-muted-foreground hover:text-foreground"
          onClick={() => handleAIBubble("explain")}
          disabled={aiRunning}
        >
          <Lightbulb className="h-3 w-3 text-primary" /> {t("knowledge.aiExplain", "AI 解释")}
        </button>
        <div className="h-3.5 w-px bg-border/60" />
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors duration-150 hover:bg-muted text-muted-foreground hover:text-foreground"
          onClick={() => handleAIBubble("translate")}
          disabled={aiRunning}
        >
          <Languages className="h-3 w-3 text-primary" /> {t("knowledge.aiTranslate", "翻译")}
        </button>
      </BubbleMenu>

      {/* Content */}
      <EditorContent
        editor={editor}
        className={cn(
          "flex-1 overflow-y-auto px-7 py-5",
          "[&_.ProseMirror]:outline-none",
          "[&_.ProseMirror]:h-full",
          "[&_.is-editor-empty:first-child::before]:text-muted-foreground/50",
          "[&_.is-editor-empty:first-child::before]:pointer-events-none",
          "[&_.is-editor-empty:first-child::before]:float-left",
          "[&_.is-editor-empty:first-child::before]:h-0",
          "[&_.is-editor-empty:first-child::before]:text-sm",
          fullHeight ? "h-full" : "",
        )}
      />

      {/* AI result panel — anchored to bottom */}
      {(aiRunning || aiResult || aiError) && aiAction && (
        <div className="shrink-0 border-t border-border/40 bg-muted/10 px-6 py-4 flex flex-col gap-3">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-medium text-foreground">
                {t(`knowledge.ai${aiAction.charAt(0).toUpperCase() + aiAction.slice(1)}`, `AI ${aiAction}`)}
              </span>
            </div>
            <button
              type="button"
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => {
                cancelAI();
                clearAI();
                setAiAction(null);
                aiSelectionRef.current = null;
              }}
            >
              <Minus className="h-3 w-3" />
            </button>
          </div>

          {/* Running — animated dots */}
          {aiRunning && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-0.5">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span>{t("knowledge.aiGenerating", "生成中...")}</span>
              <button
                type="button"
                className="ml-auto text-xs text-destructive/80 transition-colors hover:text-destructive"
                onClick={cancelAI}
              >
                {t("common.cancel", "取消")}
              </button>
            </div>
          )}

          {/* Error */}
          {aiError && !aiRunning && (
            <p className="text-xs text-destructive/80">{aiError}</p>
          )}

          {/* Result */}
          {aiResult && !aiRunning && (
            <>
              <div className="max-h-[150px] overflow-y-auto rounded-xl border border-border/40 bg-background px-4 py-3 text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">
                {aiResult}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-7 rounded-lg text-xs px-3.5" onClick={handleAIInsertAfter}>
                  {t("knowledge.insertAfter", "插入到后面")}
                </Button>
                <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs px-3.5" onClick={handleAIReplace}>
                  {t("knowledge.replaceSelection", "替换选中")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// --- Toolbar primitives ---

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center">{children}</div>;
}

function ToolbarDivider() {
  return <div className="mx-1.5 h-3.5 w-px bg-border/50" />;
}

interface ToolbarBtnProps {
  onClick: () => void;
  children: React.ReactNode;
  isActive?: boolean;
  disabled?: boolean;
  title?: string;
}

function ToolbarBtn({ onClick, children, isActive, disabled, title }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-lg transition-colors duration-150",
        "hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed",
        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
