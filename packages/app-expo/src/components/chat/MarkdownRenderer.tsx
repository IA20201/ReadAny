import { fontSize as fs, radius, useColors } from "@/styles/theme";
import type { ThemeColors } from "@/styles/theme";
import * as Clipboard from "expo-clipboard";
import { useCallback, useMemo, ReactNode } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import Markdown, { RenderRules, ASTNode } from "react-native-markdown-display";
import { MermaidView } from "@/components/common/MermaidView";

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  styleOverrides?: Record<string, any>;
}

function CodeBlockWithCopy({ code, style, colors }: { code: string; style: any; colors: ThemeColors }) {
  return (
    <View style={style}>
      <TouchableOpacity 
        onPress={() => Clipboard.setStringAsync(code)}
        style={{ 
          position: 'absolute', 
          top: 8, 
          right: 8, 
          padding: 4,
          backgroundColor: colors.card,
          borderRadius: 4,
          zIndex: 10,
        }}
      >
        <Text style={{ fontSize: 10, color: colors.mutedForeground }}>复制</Text>
      </TouchableOpacity>
      <Text style={style}>{code}</Text>
    </View>
  );
}

// 获取代码块的语言
function getCodeLanguage(node: ASTNode): string {
  // 尝试从 sourceInfo 获取 (markdown-it 的 token.info)
  if ((node as any).sourceInfo) {
    return String((node as any).sourceInfo).toLowerCase().trim();
  }
  
  // 尝试从 attributes.lang 获取
  if (node.attributes?.lang) {
    return String(node.attributes.lang).toLowerCase().trim();
  }
  
  // 尝试从 attributes.className 获取
  if (node.attributes?.className) {
    const className = node.attributes.className;
    if (Array.isArray(className)) {
      const langClass = className.find((c: string) => c.startsWith('language-'));
      if (langClass) {
        return langClass.replace('language-', '').toLowerCase().trim();
      }
    } else if (typeof className === 'string') {
      return className.replace('language-', '').toLowerCase().trim();
    }
  }
  
  return '';
}

export function MarkdownRenderer({ content, isStreaming, styleOverrides }: MarkdownRendererProps) {
  const colors = useColors();
  const baseStyles = makeMarkdownStyles(colors);
  const styles = styleOverrides ? { ...baseStyles, ...styleOverrides } : baseStyles;

  const rules = useMemo<RenderRules>(() => ({
    fence: (node: ASTNode, children: ReactNode[], parentNodes: ASTNode[], style: any) => {
      const code = node.content || '';
      const lang = getCodeLanguage(node);
      
      console.log('Fence - lang:', lang, 'content:', code.substring(0, 30));
      
      if (lang === 'mermaid') {
        return (
          <MermaidView key={node.key} chart={code} />
        );
      }
      
      return (
        <CodeBlockWithCopy 
          key={node.key} 
          code={code} 
          style={style.fence} 
          colors={colors} 
        />
      );
    },
    code_block: (node: ASTNode, children: ReactNode[], parentNodes: ASTNode[], style: any) => {
      const code = node.content || '';
      const lang = getCodeLanguage(node);
      
      console.log('Code_block - lang:', lang, 'content:', code.substring(0, 30));
      
      if (lang === 'mermaid') {
        return (
          <MermaidView key={node.key} chart={code} />
        );
      }
      
      return (
        <CodeBlockWithCopy 
          key={node.key} 
          code={code} 
          style={style.code_block} 
          colors={colors} 
        />
      );
    },
  }), [colors]);

  return (
    <View>
      <Markdown style={styles} rules={rules} mergeStyle>
        {content}
      </Markdown>
      {isStreaming && (
        <View style={cursorStyles.cursorWrap}>
          <View style={[cursorStyles.cursor, { backgroundColor: colors.foreground }]} />
        </View>
      )}
    </View>
  );
}

const cursorStyles = StyleSheet.create({
  cursorWrap: { flexDirection: "row", marginTop: 2 },
  cursor: { width: 2, height: 16, borderRadius: 1, opacity: 0.7 },
});

const makeMarkdownStyles = (colors: ThemeColors) =>
  ({
    body: {
      color: colors.foreground,
      fontSize: fs.sm,
      lineHeight: 20,
    },
    heading1: {
      color: colors.foreground,
      fontSize: fs.lg,
      fontWeight: "700",
      marginBottom: 8,
      marginTop: 12,
    },
    heading2: {
      color: colors.foreground,
      fontSize: fs.md,
      fontWeight: "600",
      marginBottom: 6,
      marginTop: 10,
    },
    heading3: {
      color: colors.foreground,
      fontSize: fs.base,
      fontWeight: "600",
      marginBottom: 4,
      marginTop: 8,
    },
    paragraph: {
      color: colors.foreground,
      fontSize: fs.sm,
      lineHeight: 20,
      marginBottom: 8,
      marginTop: 0,
    },
    strong: { fontWeight: "700" },
    em: { fontStyle: "italic" },
    link: { color: colors.blue, textDecorationLine: "none" },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: colors.border,
      paddingLeft: 12,
      marginLeft: 0,
      marginVertical: 6,
      backgroundColor: "transparent",
    },
    code_inline: {
      backgroundColor: colors.muted,
      color: colors.foreground,
      fontSize: fs.xs + 1,
      fontFamily: "Menlo",
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: radius.sm,
    },
    code_block: {
      backgroundColor: colors.muted,
      color: colors.foreground,
      fontSize: fs.xs + 1,
      fontFamily: "Menlo",
      padding: 12,
      borderRadius: radius.md,
      marginVertical: 6,
    },
    fence: {
      backgroundColor: colors.muted,
      color: colors.foreground,
      fontSize: fs.xs + 1,
      fontFamily: "Menlo",
      padding: 12,
      borderRadius: radius.md,
      marginVertical: 6,
    },
    table: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      marginVertical: 6,
    },
    thead: {
      backgroundColor: colors.muted,
    },
    th: {
      color: colors.foreground,
      fontSize: fs.xs,
      fontWeight: "600",
      padding: 6,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    td: {
      color: colors.foreground,
      fontSize: fs.xs,
      padding: 6,
      borderBottomWidth: 0.5,
      borderColor: colors.border,
    },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: {
      marginBottom: 4,
      flexDirection: "row",
    },
    hr: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: 12,
    },
    image: {
      maxWidth: 300,
      borderRadius: radius.md,
    },
  }) as const;
