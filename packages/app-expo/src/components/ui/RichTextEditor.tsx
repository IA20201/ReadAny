import { useColors, radius } from "@/styles/theme";
import { useEditorBridge, RichText } from "@10play/tentap-editor";
import { useMemo, useEffect, useState, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, Text, TextInput, Modal } from "react-native";
import {
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  ListIcon,
  ListOrderedIcon,
  CodeIcon,
  Link2Icon,
  QuoteIcon,
  MinusIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Undo2Icon,
  Redo2Icon,
  XIcon,
  CheckIcon,
} from "@/components/ui/Icon";

interface RichTextEditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function RichTextEditor({
  initialContent = "",
  onChange,
  placeholder = "写下你的想法...",
  autoFocus = false,
}: RichTextEditorProps) {
  const colors = useColors();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const theme = useMemo(() => ({
    webview: {
      backgroundColor: colors.background,
    },
    webviewContainer: {},
  }), [colors]);

  const customCss = useMemo(() => `
    * {
      background-color: ${colors.background} !important;
      color: ${colors.foreground} !important;
    }
    body {
      font-size: 15px;
      line-height: 1.6;
      padding: 12px 16px;
      margin: 0;
    }
    p {
      margin: 8px 0;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      margin: 16px 0 8px;
      color: ${colors.foreground} !important;
    }
    h2 {
      font-size: 20px;
      font-weight: 600;
      margin: 14px 0 6px;
      color: ${colors.foreground} !important;
    }
    h3 {
      font-size: 16px;
      font-weight: 600;
      margin: 12px 0 4px;
      color: ${colors.foreground} !important;
    }
    blockquote {
      border-left: 3px solid ${colors.primary};
      padding-left: 12px;
      margin: 8px 0;
      color: ${colors.mutedForeground};
      background-color: ${colors.muted};
      padding: 8px 12px;
      border-radius: 0 8px 8px 0;
    }
    code {
      background-color: ${colors.muted};
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 13px;
      color: ${colors.foreground} !important;
    }
    pre {
      background-color: ${colors.muted};
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
    }
    ul, ol {
      padding-left: 20px;
      margin: 8px 0;
    }
    li {
      margin: 4px 0;
    }
    a {
      color: ${colors.primary};
      text-decoration: underline;
    }
    strong {
      font-weight: 600;
      color: ${colors.foreground} !important;
    }
    em {
      color: ${colors.foreground} !important;
    }
    hr {
      border: none;
      border-top: 1px solid ${colors.border};
      margin: 16px 0;
    }
    .ProseMirror p.is-editor-empty:first-child::before {
      color: ${colors.mutedForeground};
      content: "${placeholder}";
      float: left;
      height: 0;
      pointer-events: none;
    }
    .ProseMirror {
      outline: none;
    }
    .ProseMirror-focused {
      outline: none;
    }
  `, [colors, placeholder]);

  const editor = useEditorBridge({
    autofocus: autoFocus,
    avoidIosKeyboard: true,
    initialContent,
    theme,
  });

  useEffect(() => {
    if (editor && customCss) {
      editor.injectCSS(customCss, "custom-theme");
    }
  }, [editor, customCss]);

  useEffect(() => {
    if (!editor || !onChange) return;
    
    const unsubscribe = editor._subscribeToContentUpdate(() => {
      editor.getHTML().then((html) => {
        onChange(html);
      });
    });
    
    return unsubscribe;
  }, [editor, onChange]);

  const handleSetLink = useCallback(() => {
    if (linkUrl.trim()) {
      editor.setLink(linkUrl.trim());
    } else {
      editor.setLink(null);
    }
    setShowLinkModal(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const openLinkModal = useCallback(() => {
    const currentLink = editor.getEditorState?.()?.activeLink || "";
    setLinkUrl(currentLink);
    setShowLinkModal(true);
  }, [editor]);

  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarGroup}>
          <ToolbarButton
            onPress={() => editor.undo()}
            disabled={!editor.getEditorState?.()?.canUndo}
            colors={colors}
            styles={styles}
          >
            <Undo2Icon size={16} color={colors.mutedForeground} />
          </ToolbarButton>
          <ToolbarButton
            onPress={() => editor.redo()}
            disabled={!editor.getEditorState?.()?.canRedo}
            colors={colors}
            styles={styles}
          >
            <Redo2Icon size={16} color={colors.mutedForeground} />
          </ToolbarButton>
        </View>

        <View style={styles.toolbarDivider} />

        <View style={styles.toolbarGroup}>
          <ToolbarButton
            onPress={() => editor.toggleHeading(1)}
            isActive={editor.getEditorState?.()?.headingLevel === 1}
            colors={colors}
            styles={styles}
          >
            <Heading1Icon size={16} color={colors.mutedForeground} />
          </ToolbarButton>
          <ToolbarButton
            onPress={() => editor.toggleHeading(2)}
            isActive={editor.getEditorState?.()?.headingLevel === 2}
            colors={colors}
            styles={styles}
          >
            <Heading2Icon size={16} color={colors.mutedForeground} />
          </ToolbarButton>
          <ToolbarButton
            onPress={() => editor.toggleHeading(3)}
            isActive={editor.getEditorState?.()?.headingLevel === 3}
            colors={colors}
            styles={styles}
          >
            <Heading3Icon size={16} color={colors.mutedForeground} />
          </ToolbarButton>
        </View>

        <View style={styles.toolbarDivider} />

        <View style={styles.toolbarGroup}>
          <ToolbarButton
            onPress={() => editor.toggleBold()}
            isActive={editor.getEditorState?.()?.isBoldActive}
            colors={colors}
            styles={styles}
          >
            <BoldIcon size={16} color={colors.mutedForeground} />
          </ToolbarButton>
          <ToolbarButton
            onPress={() => editor.toggleItalic()}
            isActive={editor.getEditorState?.()?.isItalicActive}
            colors={colors}
            styles={styles}
          >
            <ItalicIcon size={16} color={colors.mutedForeground} />
          </ToolbarButton>
          <ToolbarButton
            onPress={() => editor.toggleStrike()}
            isActive={editor.getEditorState?.()?.isStrikeActive}
            colors={colors}
            styles={styles}
          >
            <StrikethroughIcon size={16} color={colors.mutedForeground} />
          </ToolbarButton>
          <ToolbarButton
            onPress={() => editor.toggleCode()}
            isActive={editor.getEditorState?.()?.isCodeActive}
            colors={colors}
            styles={styles}
          >
            <CodeIcon size={16} color={colors.mutedForeground} />
          </ToolbarButton>
          <ToolbarButton
            onPress={openLinkModal}
            isActive={editor.getEditorState?.()?.isLinkActive}
            colors={colors}
            styles={styles}
          >
            <Link2Icon size={16} color={colors.mutedForeground} />
          </ToolbarButton>
        </View>

        <View style={styles.toolbarDivider} />

        <View style={styles.toolbarGroup}>
          <ToolbarButton
            onPress={() => editor.toggleBulletList()}
            isActive={editor.getEditorState?.()?.isBulletListActive}
            colors={colors}
            styles={styles}
          >
            <ListIcon size={16} color={colors.mutedForeground} />
          </ToolbarButton>
          <ToolbarButton
            onPress={() => editor.toggleOrderedList()}
            isActive={editor.getEditorState?.()?.isOrderedListActive}
            colors={colors}
            styles={styles}
          >
            <ListOrderedIcon size={16} color={colors.mutedForeground} />
          </ToolbarButton>
          <ToolbarButton
            onPress={() => editor.toggleBlockquote()}
            isActive={editor.getEditorState?.()?.isBlockquoteActive}
            colors={colors}
            styles={styles}
          >
            <QuoteIcon size={16} color={colors.mutedForeground} />
          </ToolbarButton>
        </View>
      </View>

      <View style={[styles.editorWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <RichText editor={editor} />
      </View>

      <Modal
        visible={showLinkModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLinkModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.linkModal}>
            <View style={styles.linkModalHeader}>
              <Text style={styles.linkModalTitle}>插入链接</Text>
              <TouchableOpacity onPress={() => setShowLinkModal(false)}>
                <XIcon size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.linkInput}
              value={linkUrl}
              onChangeText={setLinkUrl}
              placeholder="输入链接地址"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <View style={styles.linkModalActions}>
              <TouchableOpacity
                style={styles.linkCancelBtn}
                onPress={() => setShowLinkModal(false)}
              >
                <Text style={styles.linkCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkConfirmBtn} onPress={handleSetLink}>
                <Text style={styles.linkConfirmText}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface ToolbarButtonProps {
  onPress: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
}

function ToolbarButton({ onPress, isActive, disabled, children, colors, styles }: ToolbarButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.toolbarButton,
        isActive && styles.toolbarButtonActive,
        disabled && styles.toolbarButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {children}
    </TouchableOpacity>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    toolbar: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: colors.muted,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 2,
    },
    toolbarGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    toolbarButton: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    toolbarButtonActive: {
      backgroundColor: colors.primary + "20",
    },
    toolbarButtonDisabled: {
      opacity: 0.3,
    },
    toolbarDivider: {
      width: 1,
      height: 20,
      backgroundColor: colors.border,
      marginHorizontal: 6,
    },
    editorWrapper: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
    },
    linkModal: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: 16,
      width: "85%",
      maxWidth: 320,
    },
    linkModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    linkModalTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.foreground,
    },
    linkInput: {
      backgroundColor: colors.muted,
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.foreground,
      marginBottom: 16,
    },
    linkModalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
    },
    linkCancelBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: radius.sm,
    },
    linkCancelText: {
      color: colors.mutedForeground,
      fontSize: 15,
    },
    linkConfirmBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: radius.sm,
    },
    linkConfirmText: {
      color: colors.primaryForeground,
      fontSize: 15,
      fontWeight: "500",
    },
  });
