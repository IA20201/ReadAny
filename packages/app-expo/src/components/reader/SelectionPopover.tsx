import {
  CopyIcon,
  HighlighterIcon,
  LanguagesIcon,
  NotebookPenIcon,
  SparklesIcon,
  Trash2Icon,
  Volume2Icon,
  XIcon,
} from "@/components/ui/Icon";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import type { SelectionEvent } from "@/hooks/use-reader-bridge";
import { radius, spacing, useColors } from "@/styles/theme";
import type { ThemeColors } from "@/styles/theme";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
/**
 * SelectionPopover — floating action bar shown when text is selected in the reader.
 * Provides highlight (5 colors), note, copy, translate, AI chat, TTS, and delete actions.
 * Matches app-mobile styling with icon buttons and expandable color picker.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HIGHLIGHT_COLORS = [
  { key: "yellow", hex: "#facc15" },
  { key: "red", hex: "#f87171" },
  { key: "green", hex: "#4ade80" },
  { key: "blue", hex: "#60a5fa" },
  { key: "violet", hex: "#a78bfa" },
  { key: "pink", hex: "#f472b6" },
] as const;

const POPOVER_MARGIN = 8;
const POPOVER_PADDING = 4;
const BUTTON_SIZE = 36;
const GAP = 2;

interface Props {
  selection: SelectionEvent;
  viewportOffsetY?: number;
  onHighlight: (color: string) => void;
  onDismiss: () => void;
  onCopy: () => void;
  onAIChat: () => void;
  onNote?: (text: string, cfi: string) => void;
  onTranslate?: (text: string) => void;
  onRemoveHighlight?: () => void;
  existingHighlight?: { id: string; color: string; note?: string } | null;
}

export function SelectionPopover({
  selection,
  viewportOffsetY = 0,
  onHighlight,
  onDismiss,
  onCopy,
  onAIChat,
  onNote,
  onTranslate,
  onRemoveHighlight,
  existingHighlight,
}: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showColors, setShowColors] = useState(!!existingHighlight);
  const [noteContent, setNoteContent] = useState(existingHighlight?.note || "");

  useEffect(() => {
    setNoteContent(existingHighlight?.note || "");
  }, [existingHighlight?.id, existingHighlight?.note, selection.cfi]);

  const buttonCount =
    5 + (onNote ? 1 : 0) + (onTranslate ? 1 : 0) + (existingHighlight && onRemoveHighlight ? 1 : 0);
  const colorRowHeight = showColors ? 40 : 0;
  const popoverHeight = 44 + colorRowHeight + POPOVER_PADDING * 2 + GAP;
  const popoverWidth = Math.min(
    buttonCount * (BUTTON_SIZE + GAP) + POPOVER_PADDING * 2,
    windowWidth - POPOVER_MARGIN * 2,
  );

  const position = useMemo(() => {
    const selTop = selection.position.selectionTop + viewportOffsetY;
    const selBottom = selection.position.selectionBottom + viewportOffsetY;
    const safeTop = insets.top + 6;
    const safeBottom = insets.bottom + 6;
    const anchorGap = windowWidth < 520 ? 4 : 6;

    let y: number;
    const yAbove = selTop - popoverHeight - anchorGap;
    const yBelow = selBottom + anchorGap;
    const aboveValid = yAbove >= safeTop;
    const belowValid = yBelow + popoverHeight + POPOVER_MARGIN <= windowHeight - safeBottom;
    let anchorX = selection.position.anchorTopX ?? selection.position.x;

    if (aboveValid) {
      y = yAbove;
    } else if (belowValid) {
      y = yBelow;
      anchorX = selection.position.anchorBottomX ?? selection.position.x;
    } else {
      y = Math.max(safeTop, Math.min(yBelow, windowHeight - popoverHeight - POPOVER_MARGIN));
      const distanceAbove = Math.abs(y - yAbove);
      const distanceBelow = Math.abs(y - yBelow);
      anchorX =
        distanceAbove <= distanceBelow
          ? (selection.position.anchorTopX ?? selection.position.x)
          : (selection.position.anchorBottomX ?? selection.position.x);
    }

    const x = Math.max(
      POPOVER_MARGIN,
      Math.min(anchorX - popoverWidth / 2, windowWidth - popoverWidth - POPOVER_MARGIN),
    );

    return { x, y };
  }, [
    selection.position,
    viewportOffsetY,
    insets.top,
    insets.bottom,
    popoverWidth,
    popoverHeight,
    windowHeight,
    windowWidth,
  ]);

  const animatedX = useMemo(() => new Animated.Value(position.x), []);
  const animatedY = useMemo(() => new Animated.Value(position.y), []);
  const isPhoneLayout = windowWidth < 768;

  useEffect(() => {
    if (!isPhoneLayout) {
      animatedX.setValue(position.x);
      animatedY.setValue(position.y);
      return;
    }

    Animated.parallel([
      Animated.timing(animatedX, {
        toValue: position.x,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(animatedY, {
        toValue: position.y,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animatedX, animatedY, isPhoneLayout, position.x, position.y]);

  const handleCopy = useCallback(() => {
    Clipboard.setStringAsync(selection.text);
    onCopy();
  }, [selection.text, onCopy]);

  const handleSpeak = useCallback(() => {
    Speech.speak(selection.text, { language: undefined });
    onDismiss();
  }, [selection.text, onDismiss]);

  const handleNote = useCallback(() => {
    setShowNoteModal(true);
  }, []);

  const handleSaveNote = useCallback(() => {
    if (onNote) {
      onNote(noteContent, selection.cfi);
    }
    setShowNoteModal(false);
    onDismiss();
  }, [noteContent, selection.cfi, onNote, onDismiss]);

  const handleTranslate = useCallback(() => {
    if (onTranslate) {
      onTranslate(selection.text);
    }
    onDismiss();
  }, [selection.text, onTranslate, onDismiss]);

  const handleRemove = useCallback(() => {
    if (onRemoveHighlight) {
      onRemoveHighlight();
    }
    onDismiss();
  }, [onRemoveHighlight, onDismiss]);

  const toggleColors = useCallback(() => {
    setShowColors((prev) => !prev);
  }, []);

  return (
    <View style={[s.overlay]} pointerEvents="box-none">
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onDismiss} />
      <Animated.View
        style={[
          s.popover,
          {
            transform: [{ translateX: animatedX }, { translateY: animatedY }],
          },
        ]}
      >
        {showColors && (
          <View style={s.colorRow}>
            {HIGHLIGHT_COLORS.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[
                  s.colorDot,
                  { backgroundColor: c.hex },
                  existingHighlight?.color === c.key && s.colorDotActive,
                ]}
                onPress={() => onHighlight(c.key)}
              />
            ))}
          </View>
        )}

        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.iconBtn, showColors && s.iconBtnActive]}
            onPress={toggleColors}
          >
            <HighlighterIcon size={18} color={showColors ? colors.primary : colors.foreground} />
          </TouchableOpacity>

          {onNote && (
            <TouchableOpacity style={s.iconBtn} onPress={handleNote}>
              <NotebookPenIcon size={18} color={colors.foreground} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.iconBtn} onPress={handleCopy}>
            <CopyIcon size={18} color={colors.foreground} />
          </TouchableOpacity>

          {onTranslate && (
            <TouchableOpacity style={s.iconBtn} onPress={handleTranslate}>
              <LanguagesIcon size={18} color={colors.foreground} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.iconBtn} onPress={onAIChat}>
            <SparklesIcon size={18} color={colors.foreground} />
          </TouchableOpacity>

          <TouchableOpacity style={s.iconBtn} onPress={handleSpeak}>
            <Volume2Icon size={18} color={colors.foreground} />
          </TouchableOpacity>

          {existingHighlight && onRemoveHighlight && (
            <TouchableOpacity style={s.iconBtn} onPress={handleRemove}>
              <Trash2Icon size={18} color={colors.destructive} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <Modal
        visible={showNoteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNoteModal(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setShowNoteModal(false)}
          />
          <View style={s.noteModal}>
            <View style={s.noteModalHeader}>
              <Text style={s.noteModalTitle}>{t("reader.addNote", "添加笔记")}</Text>
              <TouchableOpacity style={s.noteCloseBtn} onPress={() => setShowNoteModal(false)}>
                <XIcon size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={s.noteModalPreview} numberOfLines={2}>
              {selection.text}
            </Text>
            <View style={s.editorContainer}>
              <RichTextEditor
                initialContent={noteContent}
                onChange={setNoteContent}
                placeholder={t("reader.notePlaceholder", "写下你的想法...")}
                autoFocus
              />
            </View>
            <View style={s.noteModalActions}>
              <TouchableOpacity style={s.noteCancelBtn} onPress={() => setShowNoteModal(false)}>
                <Text style={s.noteCancelText}>{t("common.cancel", "取消")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.noteSaveBtn} onPress={handleSaveNote}>
                <Text style={s.noteSaveText}>{t("common.save", "保存")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

import { fontSize as fs, fontWeight as fw } from "@/styles/theme";

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 100,
    },
    popover: {
      position: "absolute",
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: POPOVER_PADDING,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    colorRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginBottom: GAP,
    },
    colorDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
    colorDotActive: {
      borderWidth: 2,
      borderColor: colors.primary,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: GAP,
    },
    iconBtn: {
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBtnActive: {
      backgroundColor: colors.muted,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    noteModal: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      padding: spacing.lg,
      maxHeight: "85%",
    },
    noteModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    noteModalTitle: {
      fontSize: fs.lg,
      fontWeight: fw.semibold,
      color: colors.foreground,
    },
    noteCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.muted,
    },
    noteModalPreview: {
      fontSize: fs.sm,
      color: colors.mutedForeground,
      marginBottom: spacing.md,
      fontStyle: "italic",
      lineHeight: 20,
      paddingHorizontal: spacing.sm,
      borderLeftWidth: 2,
      borderLeftColor: colors.primary,
    },
    editorContainer: {
      height: 200,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    noteInput: {
      backgroundColor: colors.muted,
      borderRadius: radius.lg,
      padding: spacing.md,
      fontSize: fs.base,
      color: colors.foreground,
      minHeight: 100,
      textAlignVertical: "top",
    },
    noteModalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: spacing.md,
      marginTop: spacing.md,
    },
    noteCancelBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
    },
    noteCancelText: {
      fontSize: fs.sm,
      fontWeight: fw.medium,
      color: colors.mutedForeground,
    },
    noteSaveBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
    },
    noteSaveText: {
      fontSize: fs.sm,
      fontWeight: fw.medium,
      color: colors.primaryForeground,
    },
  });
