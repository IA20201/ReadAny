/**
 * KnowledgeEditorScreen — full-screen knowledge document editor.
 * Receives bookId and optional docId from route params.
 */
import { ChevronLeftIcon, EditIcon, LanguagesIcon, LightbulbIcon, SparklesIcon } from "@/components/ui/Icon";
import { TiptapEditor, type TiptapEditorHandle } from "@/components/ui/TiptapEditor";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { useAnnotationStore } from "@/stores";
import { useSettingsStore } from "@/stores/settings-store";
import {
  type ThemeColors,
  fontSize,
  fontWeight,
  radius,
  useColors,
  withOpacity,
} from "@/styles/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { generateId } from "@readany/core/utils";
import type { KnowledgeNote } from "@readany/core/types";
import { useAITextAction, type AITextActionType } from "@readany/core/hooks/use-ai-text-action";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<RootStackParamList, "KnowledgeEditor">;

export function KnowledgeEditorScreen({ route, navigation }: Props) {
  const { bookId, docId } = route.params;
  const colors = useColors();
  const s = makeStyles(colors);
  const { t } = useTranslation();

  const { knowledgeNotes, addKnowledgeNote, updateKnowledgeNote } = useAnnotationStore();
  const aiConfig = useSettingsStore((state) => state.aiConfig);
  const { isRunning, result, error, run, cancel, clear } = useAITextAction(aiConfig);

  const existingDoc = docId ? knowledgeNotes.find((n) => n.id === docId) : null;

  const [title, setTitle] = useState(existingDoc?.title || "");
  const [content, setContent] = useState(existingDoc?.content || "");
  const idRef = useRef<string>(docId || generateId());
  const isNewRef = useRef(!docId);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSavedRef = useRef(false);
  const tiptapEditorRef = useRef<TiptapEditorHandle>(null);

  // AI action state
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [selectionForAI, setSelectionForAI] = useState<{ start: number; end: number } | null>(null);
  // Snapshot of content at the moment AI panel opens — prevents index drift if
  // the user or auto-save mutates `content` while AI is generating.
  const contentSnapshotRef = useRef<string>("");

  // Auto-save debounced
  const scheduleSave = useCallback(
    (newTitle: string, newContent: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const now = Date.now();
        if (isNewRef.current && !hasSavedRef.current) {
          const note: KnowledgeNote = {
            id: idRef.current,
            bookId,
            title: newTitle || t("knowledge.untitled", "无标题"),
            content: newContent,
            createdAt: now,
            updatedAt: now,
          };
          addKnowledgeNote(note);
          hasSavedRef.current = true;
        } else {
          updateKnowledgeNote(idRef.current, {
            title: newTitle || t("knowledge.untitled", "无标题"),
            content: newContent,
          });
        }
      }, 800);
    },
    [bookId, addKnowledgeNote, updateKnowledgeNote, t],
  );

  const handleTitleChange = useCallback(
    (text: string) => {
      setTitle(text);
      scheduleSave(text, content);
    },
    [content, scheduleSave],
  );

  const handleContentChange = useCallback(
    (text: string) => {
      setContent(text);
      scheduleSave(title, text);
    },
    [title, scheduleSave],
  );

  const handleAcceptAIResult = useCallback(() => {
    if (!result || !selectionForAI) return;
    const { end } = selectionForAI;
    const base = contentSnapshotRef.current;
    const newContent = `${base.substring(0, end)}\n\n${result}${base.substring(end)}`;
    handleContentChange(newContent);
    setShowAIPanel(false);
    setSelectedText("");
    setSelectionForAI(null);
    clear();
  }, [result, selectionForAI, handleContentChange, clear]);

  const handleReplaceWithAIResult = useCallback(() => {
    if (!result || !selectionForAI) return;
    const { start, end } = selectionForAI;
    const base = contentSnapshotRef.current;
    const newContent = base.substring(0, start) + result + base.substring(end);
    handleContentChange(newContent);
    setShowAIPanel(false);
    setSelectedText("");
    setSelectionForAI(null);
    clear();
  }, [result, selectionForAI, handleContentChange, clear]);

  const handleOpenAIPanel = useCallback(
    (text: string, selection: { start: number; end: number }) => {
      if (!text.trim()) return;
      // Snapshot current content so accept/replace use stable indices
      contentSnapshotRef.current = content;
      setSelectedText(text);
      setSelectionForAI(selection);
      clear();
      setShowAIPanel(true);
    },
    [content, clear],
  );

  const handleRunAIAction = useCallback(
    (action: AITextActionType) => {
      run(selectedText, action);
    },
    [run, selectedText],
  );

  const handleBack = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const now = Date.now();
    if (isNewRef.current && !hasSavedRef.current) {
      if (title.trim() || content.trim()) {
        const note: KnowledgeNote = {
          id: idRef.current,
          bookId,
          title: title || t("knowledge.untitled", "无标题"),
          content,
          createdAt: now,
          updatedAt: now,
        };
        addKnowledgeNote(note);
      }
    } else {
      updateKnowledgeNote(idRef.current, {
        title: title || t("knowledge.untitled", "无标题"),
        content,
      });
    }
    navigation.goBack();
  }, [title, content, bookId, addKnowledgeNote, updateKnowledgeNote, navigation, t]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={handleBack}>
          <ChevronLeftIcon size={20} color={colors.foreground} />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <TextInput
            style={s.titleInput}
            value={title}
            onChangeText={handleTitleChange}
            placeholder={t("knowledge.untitled", "无标题")}
            placeholderTextColor={withOpacity(colors.mutedForeground, 0.5)}
            returnKeyType="next"
          />
          <Text style={s.titleSubtext}>
            {docId
              ? `${t("common.edited", "已编辑")} · ${new Date(existingDoc?.updatedAt ?? Date.now()).toLocaleDateString()}`
              : t("knowledge.newDocument", "新文档")}
          </Text>
        </View>

        <TouchableOpacity style={s.doneBtn} onPress={handleBack}>
          <Text style={s.doneBtnText}>{t("common.done", "完成")}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Editor ── */}
      <TiptapEditor
        ref={tiptapEditorRef}
        initialContent={content}
        onChange={handleContentChange}
        placeholder={t("knowledge.editorPlaceholder", "开始记录知识...")}
        bookId={bookId}
        onAIAction={handleOpenAIPanel}
        style={s.editorWrap}
      />

      {/* ── AI Action Panel ── */}
      <Modal
        visible={showAIPanel}
        transparent
        animationType="slide"
        onRequestClose={() => {
          cancel();
          setShowAIPanel(false);
          clear();
        }}
      >
        <View style={s.aiOverlay}>
          <View style={s.aiSheet}>
            {/* Handle bar */}
            <View style={s.aiHandle} />

            {/* Header */}
            <View style={s.aiHeader}>
              <View style={s.aiHeaderLeft}>
                <View style={s.aiIconWrap}>
                  <SparklesIcon size={14} color={colors.primary} />
                </View>
                <Text style={s.aiTitle}>{t("knowledge.aiActions", "AI 助写")}</Text>
              </View>
              <TouchableOpacity
                style={s.aiCloseBtn}
                onPress={() => {
                  cancel();
                  setShowAIPanel(false);
                  clear();
                }}
              >
                <Text style={s.aiCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Selected text preview */}
            <View style={s.selectedTextBox}>
              <Text style={s.selectedTextLabel}>{t("knowledge.selectedText", "选中内容")}</Text>
              <Text style={s.selectedTextContent} numberOfLines={3}>
                {selectedText}
              </Text>
            </View>

            {/* Action buttons */}
            {!isRunning && !result && !error && (
              <View style={s.aiActionRow}>
                <TouchableOpacity
                  style={s.aiActionBtn}
                  onPress={() => handleRunAIAction("expand")}
                  activeOpacity={0.75}
                >
                  <EditIcon size={18} color={colors.primary} />
                  <Text style={s.aiActionBtnText}>{t("knowledge.aiExpand", "扩写")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.aiActionBtn}
                  onPress={() => handleRunAIAction("explain")}
                  activeOpacity={0.75}
                >
                  <LightbulbIcon size={18} color={colors.primary} />
                  <Text style={s.aiActionBtnText}>{t("knowledge.aiExplain", "解释")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.aiActionBtn}
                  onPress={() => handleRunAIAction("translate")}
                  activeOpacity={0.75}
                >
                  <LanguagesIcon size={18} color={colors.primary} />
                  <Text style={s.aiActionBtnText}>{t("knowledge.aiTranslate", "翻译")}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Running indicator */}
            {isRunning && (
              <View style={s.aiRunning}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={s.aiRunningText}>{t("knowledge.aiGenerating", "生成中...")}</Text>
                <TouchableOpacity style={s.aiCancelBtn} onPress={cancel}>
                  <Text style={s.aiCancelText}>{t("common.cancel", "取消")}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Error */}
            {error && !isRunning && (
              <View style={s.aiError}>
                <Text style={s.aiErrorText}>{error}</Text>
                <TouchableOpacity style={s.aiRetryBtn} onPress={() => clear()}>
                  <Text style={s.aiRetryText}>{t("common.retry", "重试")}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Result */}
            {result && !isRunning && (
              <>
                <ScrollView style={s.aiResultScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  <Text style={s.aiResultText}>{result}</Text>
                </ScrollView>
                <View style={s.aiResultActions}>
                  <TouchableOpacity
                    style={s.aiInsertBtn}
                    onPress={handleAcceptAIResult}
                    activeOpacity={0.85}
                  >
                    <Text style={s.aiInsertBtnText}>
                      {t("knowledge.insertAfter", "插入到后面")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.aiReplaceBtn}
                    onPress={handleReplaceWithAIResult}
                    activeOpacity={0.85}
                  >
                    <Text style={s.aiReplaceBtnText}>
                      {t("knowledge.replaceSelection", "替换")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // ── Header ─────────────────────────────────────────────
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
      gap: 8,
    },
    backBtn: {
      width: 34,
      height: 34,
      borderRadius: radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.muted,
    },
    headerCenter: {
      flex: 1,
      gap: 1,
    },
    titleInput: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      color: colors.foreground,
      padding: 0,
      letterSpacing: -0.3,
    },
    titleSubtext: {
      fontSize: 11,
      color: withOpacity(colors.mutedForeground, 0.6),
    },
    doneBtn: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
    },
    doneBtnText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: colors.primaryForeground,
    },
    editorWrap: { flex: 1 },

    // ── AI panel ────────────────────────────────────────────
    aiOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    aiSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      paddingHorizontal: 16,
      paddingBottom: 32,
      paddingTop: 8,
      maxHeight: "80%",
      gap: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
    },
    aiHandle: {
      width: 36,
      height: 4,
      borderRadius: radius.full,
      backgroundColor: withOpacity(colors.mutedForeground, 0.25),
      alignSelf: "center",
      marginBottom: 4,
    },
    aiHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    aiHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    aiIconWrap: {
      width: 28,
      height: 28,
      borderRadius: radius.md,
      backgroundColor: withOpacity(colors.primary, 0.12),
      alignItems: "center",
      justifyContent: "center",
    },
    aiTitle: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
      color: colors.foreground,
    },
    aiCloseBtn: {
      width: 28,
      height: 28,
      borderRadius: radius.full,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    aiCloseBtnText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontWeight: fontWeight.medium,
    },

    // Selected text box
    selectedTextBox: {
      backgroundColor: withOpacity(colors.primary, 0.06),
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    selectedTextLabel: {
      fontSize: 11,
      color: colors.mutedForeground,
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    selectedTextContent: {
      fontSize: fontSize.sm,
      color: colors.foreground,
      lineHeight: 20,
      fontStyle: "italic",
    },

    // Action buttons
    aiActionRow: {
      flexDirection: "row",
      gap: 8,
    },
    aiActionBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: radius.xl,
      backgroundColor: colors.muted,
      alignItems: "center",
      borderWidth: 0.5,
      borderColor: colors.border,
      gap: 4,
    },
    aiActionBtnText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.medium,
      color: colors.foreground,
    },

    // Running
    aiRunning: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 6,
    },
    aiRunningText: {
      fontSize: fontSize.sm,
      color: colors.mutedForeground,
      flex: 1,
    },
    aiCancelBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.md,
      backgroundColor: withOpacity(colors.destructive, 0.1),
    },
    aiCancelText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.medium,
      color: colors.destructive,
    },

    // Error
    aiError: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: withOpacity(colors.destructive, 0.08),
      borderRadius: radius.lg,
      padding: 12,
    },
    aiErrorText: {
      flex: 1,
      fontSize: fontSize.xs,
      color: colors.destructive,
      lineHeight: 18,
    },
    aiRetryBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.md,
      backgroundColor: withOpacity(colors.primary, 0.1),
    },
    aiRetryText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.medium,
      color: colors.primary,
    },

    // Result
    aiResultScroll: {
      maxHeight: 180,
      backgroundColor: withOpacity(colors.muted, 0.6),
      borderRadius: radius.xl,
      padding: 12,
    },
    aiResultText: {
      fontSize: fontSize.sm,
      color: colors.foreground,
      lineHeight: 21,
    },
    aiResultActions: {
      flexDirection: "row",
      gap: 8,
    },
    aiInsertBtn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 3,
    },
    aiInsertBtnText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: colors.primaryForeground,
    },
    aiReplaceBtn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: radius.full,
      backgroundColor: colors.muted,
      alignItems: "center",
      borderWidth: 0.5,
      borderColor: colors.border,
    },
    aiReplaceBtnText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.foreground,
    },
  });
