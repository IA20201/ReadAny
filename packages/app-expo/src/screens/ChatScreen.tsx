/**
 * ChatScreen — mobile standalone AI chat matching Tauri mobile ChatPage layout.
 * Features: header with history/model/context/new, empty state with suggestions,
 * message list with part-based rendering, streaming indicators, thread sidebar with delete.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Animated,
  Dimensions,
  Pressable,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useChatStore, useChatReaderStore, useSettingsStore } from "@readany/core/stores";
import { useStreamingChat } from "@readany/core/hooks";
import { convertToMessageV2, mergeMessagesWithStreaming } from "@readany/core/utils/chat-utils";
import type { MessageV2, Part, TextPart, ReasoningPart, ToolCallPart, CitationPart, QuotePart } from "@readany/core/types/message";
import { useLibraryStore } from "@/stores/library-store";
import { colors, radius, fontSize, fontWeight, useColors } from "@/styles/theme";
import {
  BrainIcon,
  ScrollTextIcon,
  LightbulbIcon,
  SearchIcon,
  BookOpenIcon,
  HistoryIcon,
  MessageCirclePlusIcon,
  XIcon,
  StopCircleIcon,
  ChevronDownIcon,
  CheckIcon,
  Trash2Icon,
  LoaderIcon,
} from "@/components/ui/Icon";

const SCREEN_WIDTH = Dimensions.get("window").width;

const SUGGESTIONS = [
  { key: "chat.suggestions.summarizeReading", Icon: ScrollTextIcon },
  { key: "chat.suggestions.analyzeArguments", Icon: LightbulbIcon },
  { key: "chat.suggestions.findConcepts", Icon: SearchIcon },
  { key: "chat.suggestions.generateNotes", Icon: BookOpenIcon },
] as const;

const TOOL_LABEL_KEYS: Record<string, string> = {
  ragSearch: "toolLabels.ragSearch",
  ragToc: "toolLabels.ragToc",
  ragContext: "toolLabels.ragContext",
  summarize: "toolLabels.summarize",
  extractEntities: "toolLabels.extractEntities",
  analyzeArguments: "toolLabels.analyzeArguments",
  findQuotes: "toolLabels.findQuotes",
  getAnnotations: "toolLabels.getAnnotations",
  compareSections: "toolLabels.compareSections",
  getCurrentChapter: "toolLabels.getCurrentChapter",
  getSelection: "toolLabels.getSelection",
  getReadingProgress: "toolLabels.getReadingProgress",
  getRecentHighlights: "toolLabels.getRecentHighlights",
  getSurroundingContext: "toolLabels.getSurroundingContext",
  listBooks: "toolLabels.listBooks",
  searchAllHighlights: "toolLabels.searchAllHighlights",
  searchAllNotes: "toolLabels.searchAllNotes",
  getReadingStats: "toolLabels.getReadingStats",
  getSkills: "toolLabels.getSkills",
  mindmap: "toolLabels.mindmap",
};

function formatRelativeTime(ts: number, _t: (key: string) => string): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

// ──────────────────────────────── Model Selector ────────────────────────────────

function ModelSelector() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { aiConfig, setActiveModel, setActiveEndpoint } = useSettingsStore();
  const currentModel = aiConfig.activeModel;
  const activeEndpointId = aiConfig.activeEndpointId;

  const endpointsWithModels = aiConfig.endpoints.filter((ep) => ep.models.length > 0);
  const totalModels = endpointsWithModels.reduce((sum, ep) => sum + ep.models.length, 0);
  const multipleEndpoints = endpointsWithModels.length > 1;
  const canSwitch = totalModels > 1;

  const displayName = currentModel
    ? currentModel.length > 16
      ? `${currentModel.slice(0, 14)}...`
      : currentModel
    : t("chat.currentModel", "选择模型");

  const handleSelect = (endpointId: string, model: string) => {
    if (endpointId !== activeEndpointId) {
      setActiveEndpoint(endpointId);
    }
    setActiveModel(model);
    setOpen(false);
  };

  return (
    <View>
      <TouchableOpacity
        style={modelStyles.trigger}
        onPress={() => canSwitch && setOpen(!open)}
        activeOpacity={canSwitch ? 0.7 : 1}
      >
        <Text style={modelStyles.triggerText} numberOfLines={1}>
          {displayName}
        </Text>
        {canSwitch && <ChevronDownIcon size={12} color={colors.mutedForeground} />}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={modelStyles.overlay} onPress={() => setOpen(false)}>
          <View style={modelStyles.dropdown}>
            <ScrollView style={modelStyles.dropdownScroll} showsVerticalScrollIndicator={false}>
              {endpointsWithModels.map((ep) => (
                <View key={ep.id}>
                  {multipleEndpoints && (
                    <Text style={modelStyles.epLabel}>{ep.name || ep.baseUrl}</Text>
                  )}
                  {ep.models.map((model) => {
                    const isActive = model === currentModel && ep.id === activeEndpointId;
                    return (
                      <TouchableOpacity
                        key={`${ep.id}-${model}`}
                        style={[modelStyles.modelItem, isActive && modelStyles.modelItemActive]}
                        onPress={() => handleSelect(ep.id, model)}
                      >
                        <Text
                          style={[modelStyles.modelText, isActive && modelStyles.modelTextActive]}
                          numberOfLines={1}
                        >
                          {model}
                        </Text>
                        {isActive && <CheckIcon size={12} color={colors.indigo} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const modelStyles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: radius.full,
    borderWidth: 0.5,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  triggerText: { fontSize: fontSize.xs, color: colors.mutedForeground, maxWidth: 100 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" },
  dropdown: {
    width: 224,
    maxHeight: 300,
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 4,
  },
  dropdownScroll: { maxHeight: 288 },
  epLabel: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 2,
    fontSize: 9,
    fontWeight: fontWeight.medium,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modelItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.lg,
  },
  modelItemActive: { backgroundColor: "rgba(99,102,241,0.1)" },
  modelText: { fontSize: fontSize.xs, color: colors.foreground, flex: 1 },
  modelTextActive: { color: colors.indigo },
});

// ──────────────────────────────── Context Popover ────────────────────────────────

function ContextPopover() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const books = useLibraryStore((s) => s.books);
  const { selectedBooks, addSelectedBook, removeSelectedBook } = useChatReaderStore();

  return (
    <View>
      <TouchableOpacity
        style={ctxStyles.trigger}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <BookOpenIcon size={14} color={colors.mutedForeground} />
        <Text style={ctxStyles.triggerText}>
          {selectedBooks.length > 0
            ? t("chat.booksCount", { count: selectedBooks.length }) || `${selectedBooks.length} 本书`
            : t("chat.context", "上下文")}
        </Text>
        {selectedBooks.length > 0 && (
          <TouchableOpacity
            style={ctxStyles.clearBtn}
            onPress={() => {
              for (const id of selectedBooks) removeSelectedBook(id);
            }}
          >
            <XIcon size={10} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={ctxStyles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={ctxStyles.dropdown} onPress={(e) => e.stopPropagation()}>
            <Text style={ctxStyles.dropdownTitle}>
              {t("chat.selectBooksForContext", "选择书籍作为上下文")}
            </Text>
            <ScrollView style={ctxStyles.dropdownScroll} showsVerticalScrollIndicator={false}>
              {books.map((book) => {
                const isSelected = selectedBooks.includes(book.id);
                return (
                  <TouchableOpacity
                    key={book.id}
                    style={ctxStyles.bookItem}
                    onPress={() =>
                      isSelected ? removeSelectedBook(book.id) : addSelectedBook(book.id)
                    }
                  >
                    <View
                      style={[ctxStyles.checkbox, isSelected && ctxStyles.checkboxActive]}
                    >
                      {isSelected && <CheckIcon size={10} color={colors.primaryForeground} />}
                    </View>
                    <Text style={ctxStyles.bookTitle} numberOfLines={1}>
                      {book.meta.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {books.length === 0 && (
                <Text style={ctxStyles.emptyText}>
                  {t("chat.noBooksInLibrary", "书库中暂无书籍")}
                </Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const ctxStyles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.full,
    borderWidth: 0.5,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  triggerText: { fontSize: fontSize.xs, color: colors.mutedForeground },
  clearBtn: { marginLeft: 2, padding: 2, borderRadius: radius.full },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" },
  dropdown: {
    width: 288,
    maxHeight: 340,
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 6,
  },
  dropdownTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.mutedForeground,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dropdownScroll: { maxHeight: 260 },
  bookItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: radius.lg,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  bookTitle: { fontSize: fontSize.sm, color: colors.foreground, flex: 1 },
  emptyText: {
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    textAlign: "center",
    paddingVertical: 24,
  },
});

// ──────────────────────────────── Streaming Indicator ────────────────────────────────

function StreamingIndicatorView({
  step,
}: {
  step: "thinking" | "tool_calling" | "responding" | "idle";
}) {
  const { t } = useTranslation();
  if (step === "idle") return null;

  const config =
    step === "thinking"
      ? { color: "#8b5cf6", label: t("streaming.thinking", "思考中...") }
      : step === "tool_calling"
        ? { color: colors.blue, label: t("streaming.toolCalling", "调用工具...") }
        : { color: colors.emerald, label: t("streaming.responding", "回复中...") };

  return (
    <View style={streamStyles.row}>
      <ActivityIndicator size="small" color={config.color} />
      <Text style={[streamStyles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const streamStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  text: { fontSize: fontSize.xs },
});

// ──────────────────────────────── Part Renderers ────────────────────────────────

function UserQuoteBlock({ part }: { part: QuotePart }) {
  return (
    <View style={partStyles.quoteBlock}>
      <Text style={partStyles.quoteIcon}>❝</Text>
      <View style={partStyles.quoteContent}>
        <Text style={partStyles.quoteText}>
          {part.text.length > 200 ? `${part.text.slice(0, 200)}...` : part.text}
        </Text>
        {part.source && <Text style={partStyles.quoteSource}>— {part.source}</Text>}
      </View>
    </View>
  );
}

function TextPartView({ part }: { part: TextPart }) {
  if (!part.text.trim()) {
    if (part.status === "running") {
      return (
        <View style={partStyles.cursorWrap}>
          <View style={partStyles.cursor} />
        </View>
      );
    }
    return null;
  }
  return <Text style={partStyles.textContent}>{part.text}</Text>;
}

function ReasoningPartView({ part }: { part: ReasoningPart }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(part.status === "running");

  useEffect(() => {
    if (part.status === "running") setIsOpen(true);
  }, [part.status]);

  if (!part.text.trim()) return null;

  return (
    <View style={partStyles.reasoningWrap}>
      <TouchableOpacity
        style={partStyles.reasoningHeader}
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.7}
      >
        <View style={partStyles.reasoningHeaderLeft}>
          {part.status === "running" ? (
            <View style={partStyles.reasoningDot} />
          ) : (
            <BrainIcon size={14} color="#7c3aed" />
          )}
          <Text style={partStyles.reasoningTitle}>
            {part.status === "running"
              ? t("streaming.reasoningRunning", "正在思考...")
              : t("streaming.reasoningDone", "思考完成")}
          </Text>
        </View>
        <ChevronDownIcon
          size={14}
          color="#a78bfa"
        />
      </TouchableOpacity>
      {isOpen && (
        <View style={partStyles.reasoningBody}>
          <Text style={partStyles.reasoningText}>{part.text}</Text>
        </View>
      )}
    </View>
  );
}

function ToolCallPartView({ part }: { part: ToolCallPart }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const label = TOOL_LABEL_KEYS[part.name] ? t(TOOL_LABEL_KEYS[part.name]) : part.name;
  const queryText = part.args?.query ? String(part.args.query) : "";

  const statusColor =
    part.status === "running"
      ? colors.blue
      : part.status === "completed"
        ? colors.emerald
        : part.status === "error"
          ? colors.destructive
          : colors.mutedForeground;

  return (
    <View style={partStyles.toolWrap}>
      <TouchableOpacity
        style={partStyles.toolHeader}
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.7}
      >
        <View style={partStyles.toolHeaderLeft}>
          {part.status === "running" ? (
            <ActivityIndicator size="small" color={colors.blue} />
          ) : (
            <View style={[partStyles.toolDot, { backgroundColor: statusColor }]} />
          )}
          <Text style={partStyles.toolLabel}>{label}</Text>
          {queryText ? (
            <Text style={partStyles.toolQuery} numberOfLines={1}>
              {queryText.slice(0, 30)}
            </Text>
          ) : null}
        </View>
        <ChevronDownIcon size={14} color={colors.mutedForeground} />
      </TouchableOpacity>
      {isOpen && (
        <View style={partStyles.toolBody}>
          {part.args && Object.keys(part.args).length > 0 && (
            <View style={partStyles.toolSection}>
              <Text style={partStyles.toolSectionTitle}>{t("common.params", "参数")}</Text>
              <View style={partStyles.toolCodeBlock}>
                {Object.entries(part.args).map(([key, value]) => (
                  <Text key={key} style={partStyles.toolCodeLine}>
                    <Text style={partStyles.toolCodeKey}>{key}: </Text>
                    <Text style={partStyles.toolCodeValue}>
                      {typeof value === "string" && value.length > 80
                        ? `${value.slice(0, 80)}...`
                        : String(value)}
                    </Text>
                  </Text>
                ))}
              </View>
            </View>
          )}
          {part.result !== undefined && (
            <View style={partStyles.toolSection}>
              <Text style={partStyles.toolSectionTitle}>{t("common.result", "结果")}</Text>
              <View style={partStyles.toolCodeBlock}>
                <Text style={partStyles.toolCodeValue} numberOfLines={12}>
                  {typeof part.result === "string" && part.result.length > 300
                    ? `${part.result.slice(0, 300)}...`
                    : JSON.stringify(part.result, null, 2)}
                </Text>
              </View>
            </View>
          )}
          {part.error && (
            <View style={partStyles.toolErrorBlock}>
              <Text style={partStyles.toolErrorText}>{part.error}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const partStyles = StyleSheet.create({
  // Quote
  quoteBlock: {
    flexDirection: "row",
    gap: 8,
    borderRadius: radius.lg,
    backgroundColor: "rgba(99,102,241,0.05)",
    borderWidth: 0.5,
    borderColor: "rgba(99,102,241,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 4,
  },
  quoteIcon: { fontSize: 12, color: "rgba(99,102,241,0.5)", marginTop: 2 },
  quoteContent: { flex: 1 },
  quoteText: { fontSize: fontSize.xs, lineHeight: 18, color: "rgba(232,232,237,0.8)" },
  quoteSource: { fontSize: 9, color: colors.mutedForeground, marginTop: 4 },

  // Text
  textContent: { fontSize: fontSize.sm, lineHeight: 20, color: colors.foreground },
  cursorWrap: { paddingVertical: 2 },
  cursor: {
    width: 3,
    height: 16,
    borderRadius: 1,
    backgroundColor: colors.indigo,
    opacity: 0.8,
  },

  // Reasoning
  reasoningWrap: {
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: "rgba(139,92,246,0.3)",
    backgroundColor: "rgba(139,92,246,0.05)",
    overflow: "hidden",
    marginVertical: 4,
  },
  reasoningHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reasoningHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  reasoningDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#a78bfa",
    opacity: 0.8,
  },
  reasoningTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: "#8b5cf6" },
  reasoningBody: {
    borderTopWidth: 0.5,
    borderTopColor: "rgba(139,92,246,0.2)",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 12,
    maxHeight: 192,
  },
  reasoningText: { fontSize: fontSize.sm, lineHeight: 20, color: "#c4b5fd" },

  // Tool call
  toolWrap: {
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: "hidden",
    marginVertical: 4,
  },
  toolHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toolHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  toolDot: { width: 8, height: 8, borderRadius: 4 },
  toolLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.foreground },
  toolQuery: { fontSize: fontSize.xs, color: colors.mutedForeground, flex: 1, marginLeft: 4 },
  toolBody: {
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: 12,
    gap: 12,
  },
  toolSection: { gap: 6 },
  toolSectionTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: colors.mutedForeground },
  toolCodeBlock: {
    borderRadius: radius.sm,
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 8,
  },
  toolCodeLine: { fontSize: fontSize.xs, marginBottom: 2 },
  toolCodeKey: { color: colors.mutedForeground },
  toolCodeValue: { color: colors.foreground, fontSize: fontSize.xs },
  toolErrorBlock: {
    borderRadius: radius.sm,
    borderWidth: 0.5,
    borderColor: "rgba(229,57,53,0.3)",
    backgroundColor: "rgba(229,57,53,0.05)",
    padding: 8,
  },
  toolErrorText: { fontSize: fontSize.xs, color: colors.destructive },
});

// ──────────────────────────────── Message Bubble ────────────────────────────────

function MessageBubble({
  message,
  isStreaming,
  currentStep,
}: {
  message: MessageV2;
  isStreaming?: boolean;
  currentStep?: "thinking" | "tool_calling" | "responding" | "idle";
}) {
  if (message.role === "user") {
    const quoteParts = message.parts.filter((p) => p.type === "quote") as QuotePart[];
    const textParts = message.parts.filter((p) => p.type === "text") as TextPart[];

    return (
      <View style={msgStyles.userRow}>
        <View style={msgStyles.userBubble}>
          {quoteParts.length > 0 && (
            <View style={msgStyles.quotesWrap}>
              {quoteParts.map((q) => (
                <UserQuoteBlock key={q.id} part={q} />
              ))}
            </View>
          )}
          {textParts.length > 0 && (
            <Text style={msgStyles.userText}>
              {textParts.map((p) => p.text).join("")}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Assistant message
  const hasContent = message.parts.some(
    (p) => (p.type === "text" && p.text.trim()) || p.type !== "text",
  );
  if (!hasContent) return null;

  const lastPart = message.parts[message.parts.length - 1];
  const isLastPartRunningText = lastPart?.type === "text" && lastPart.status === "running";
  const isLastPartActiveToolCall =
    lastPart?.type === "tool_call" &&
    (lastPart.status === "pending" || lastPart.status === "running");
  const showGapIndicator =
    isStreaming &&
    currentStep !== "idle" &&
    lastPart &&
    !isLastPartRunningText &&
    !isLastPartActiveToolCall;

  return (
    <View style={msgStyles.assistantRow}>
      {message.parts.map((part) => {
        switch (part.type) {
          case "text":
            return <TextPartView key={part.id} part={part as TextPart} />;
          case "reasoning":
            return <ReasoningPartView key={part.id} part={part as ReasoningPart} />;
          case "tool_call":
            return <ToolCallPartView key={part.id} part={part as ToolCallPart} />;
          case "citation":
            return null;
          case "quote":
            return null;
          default:
            return null;
        }
      })}
      {showGapIndicator && <StreamingIndicatorView step="thinking" />}
    </View>
  );
}

const msgStyles = StyleSheet.create({
  userRow: { marginTop: 16, alignItems: "flex-end" },
  userBubble: {
    maxWidth: "85%",
    borderRadius: radius.xxl,
    backgroundColor: colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quotesWrap: { marginBottom: 8, gap: 6 },
  userText: { fontSize: fontSize.sm, lineHeight: 20, color: colors.foreground },
  assistantRow: { width: "100%", gap: 4 },
});

// ──────────────────────────────── Thread Sidebar ────────────────────────────────

function ThreadsSidebar({
  open,
  onClose,
  onSelect,
  onNewThread,
  sidebarAnim,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (threadId: string) => void;
  onNewThread: () => void;
  sidebarAnim: Animated.Value;
}) {
  const { t } = useTranslation();
  const { getThreadsForContext, generalActiveThreadId, removeThread } = useChatStore();
  const generalThreads = getThreadsForContext();

  return (
    <>
      {open && (
        <Pressable style={s.sidebarOverlay} onPress={onClose} />
      )}
      <Animated.View style={[s.sidebar, { transform: [{ translateX: sidebarAnim }] }]}>
        <SafeAreaView style={s.sidebarInner} edges={["top"]}>
          <View style={s.sidebarHeader}>
            <Text style={s.sidebarTitle}>{t("chat.history", "对话历史")}</Text>
            <TouchableOpacity onPress={onClose} style={s.headerIconBtn}>
              <XIcon size={14} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={s.sidebarList} showsVerticalScrollIndicator={false}>
            {generalThreads.length === 0 && (
              <Text style={s.sidebarEmpty}>{t("chat.noConversations", "暂无对话")}</Text>
            )}
            {generalThreads.map((thread) => {
              const lastMsg =
                thread.messages.length > 0
                  ? thread.messages[thread.messages.length - 1]
                  : null;
              const preview = lastMsg?.content?.slice(0, 60) || "";

              return (
                <TouchableOpacity
                  key={thread.id}
                  style={[
                    s.sidebarItem,
                    thread.id === generalActiveThreadId && s.sidebarItemActive,
                  ]}
                  onPress={() => {
                    onSelect(thread.id);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.sidebarItemContent}>
                    <View style={s.sidebarItemRow}>
                      <Text style={s.sidebarItemTitle} numberOfLines={1}>
                        {thread.title || t("chat.newChat", "新对话")}
                      </Text>
                      <Text style={s.sidebarItemTime}>
                        {formatRelativeTime(thread.updatedAt || thread.createdAt, t)}
                      </Text>
                    </View>
                    {preview ? (
                      <Text style={s.sidebarItemPreview} numberOfLines={1}>
                        {preview}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={s.sidebarDeleteBtn}
                    onPress={() => removeThread(thread.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2Icon size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </>
  );
}

// ──────────────────────────────── ChatScreen ────────────────────────────────

export function ChatScreen() {
  const c = useColors();
  const { t } = useTranslation();
  const [inputText, setInputText] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [deepThinking, setDeepThinking] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 0.75)).current;
  const flatListRef = useRef<FlatList>(null);

  const {
    threads,
    loadAllThreads,
    initialized,
    createThread,
    setGeneralActiveThread,
    getActiveThreadId,
    generalActiveThreadId,
    getThreadsForContext,
  } = useChatStore();

  const { bookId: contextBookId, bookTitle } = useChatReaderStore();

  const { isStreaming, currentMessage, currentStep, sendMessage, stopStream, error } =
    useStreamingChat({
      bookId: contextBookId || undefined,
    });

  const activeThreadId = getActiveThreadId();
  const activeThread = useMemo(
    () => threads.find((th) => th.id === activeThreadId),
    [threads, activeThreadId],
  );

  // Convert messages to V2 format and merge with streaming
  const displayMessages = useMemo(
    () => convertToMessageV2(activeThread?.messages || []),
    [activeThread?.messages],
  );
  const allMessages = useMemo(
    () => mergeMessagesWithStreaming(displayMessages, currentMessage, isStreaming),
    [displayMessages, currentMessage, isStreaming],
  );

  useEffect(() => {
    if (!initialized) loadAllThreads();
  }, [initialized, loadAllThreads]);

  const toggleSidebar = useCallback(
    (open: boolean) => {
      setShowSidebar(open);
      Animated.spring(sidebarAnim, {
        toValue: open ? 0 : -SCREEN_WIDTH * 0.75,
        useNativeDriver: true,
        friction: 20,
        tension: 100,
      }).start();
    },
    [sidebarAnim],
  );

  const handleSend = useCallback(
    async (content?: string, useDeepThinking?: boolean) => {
      const text = (content || inputText).trim();
      if (!text || isStreaming) return;
      if (!content) setInputText("");

      const { aiConfig } = useSettingsStore.getState();
      const endpoint = aiConfig.endpoints.find((e) => e.id === aiConfig.activeEndpointId);
      if (!endpoint?.apiKey || !aiConfig.activeModel) {
        // TODO: config guide dialog
        return;
      }

      const dt = useDeepThinking !== undefined ? useDeepThinking : deepThinking;

      if (!activeThreadId) {
        await createThread(undefined, text.slice(0, 50));
        setTimeout(() => sendMessage(text, contextBookId || undefined, dt), 50);
      } else {
        sendMessage(text, contextBookId || undefined, dt);
      }
    },
    [inputText, isStreaming, sendMessage, deepThinking, activeThreadId, createThread, contextBookId],
  );

  const handleNewThread = useCallback(() => {
    setGeneralActiveThread(null);
    toggleSidebar(false);
  }, [setGeneralActiveThread, toggleSidebar]);

  const handleSelectThread = useCallback(
    (threadId: string) => {
      setGeneralActiveThread(threadId);
    },
    [setGeneralActiveThread],
  );

  const isEmpty = allMessages.length === 0;

  const lastMsg = allMessages[allMessages.length - 1];
  const showStreamingIndicator =
    isStreaming &&
    currentStep &&
    currentStep !== "idle" &&
    (!lastMsg || lastMsg.role !== "assistant" || lastMsg.parts.length === 0);

  const isLastMsgStreaming =
    isStreaming && !!lastMsg && lastMsg.role === "assistant" && lastMsg.parts.length > 0;

  const renderMessage = useCallback(
    ({ item, index }: { item: MessageV2; index: number }) => (
      <MessageBubble
        message={item}
        isStreaming={index === allMessages.length - 1 && isLastMsgStreaming}
        currentStep={currentStep}
      />
    ),
    [allMessages.length, isLastMsgStreaming, currentStep],
  );

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]} edges={["top"]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <View style={s.headerLeft}>
          <TouchableOpacity style={s.headerIconBtn} onPress={() => toggleSidebar(true)}>
            <HistoryIcon size={16} color={c.mutedForeground} />
          </TouchableOpacity>
          {bookTitle ? (
            <Text style={[s.headerContextText, { color: c.mutedForeground }]} numberOfLines={1}>
              {t("chat.context", "上下文")}:{" "}
              <Text style={{ fontWeight: fontWeight.medium, color: c.foreground }}>{bookTitle}</Text>
            </Text>
          ) : (
            <ContextPopover />
          )}
        </View>
        <View style={s.headerRight}>
          <ModelSelector />
          <TouchableOpacity style={s.headerIconBtn} onPress={handleNewThread}>
            <MessageCirclePlusIcon size={16} color={c.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={s.body}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Empty state */}
        {isEmpty && !isStreaming && (
          <ScrollView contentContainerStyle={s.emptyContainer} showsVerticalScrollIndicator={false}>
            <View style={s.emptyTop}>
              <View style={[s.brainIconWrap, { backgroundColor: c.indigo + "1A" }]}>
                <BrainIcon size={40} color={c.indigo} />
              </View>
              <Text style={[s.emptyTitle, { color: c.foreground }]}>
                {t("chat.howCanIHelp", "有什么可以帮你的？")}
              </Text>
              <Text style={[s.emptySubtitle, { color: c.mutedForeground }]}>
                {t("chat.askAboutBooks", "向 AI 提问关于你的书籍，获取摘要等")}
              </Text>
            </View>
            <View style={s.suggestSection}>
              <Text style={[s.suggestLabel, { color: c.mutedForeground }]}>
                {t("chat.getStarted", "快速开始")}
              </Text>
              <View style={s.suggestGrid}>
                {SUGGESTIONS.map(({ key, Icon }) => (
                  <TouchableOpacity
                    key={key}
                    style={[s.suggestCard, { backgroundColor: c.muted }]}
                    activeOpacity={0.7}
                    onPress={() => handleSend(t(key))}
                  >
                    <Icon size={20} color={c.mutedForeground} />
                    <Text style={[s.suggestText, { color: c.foreground }]}>{t(key)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        )}

        {/* Message list */}
        {!isEmpty && (
          <FlatList
            ref={flatListRef}
            data={allMessages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {/* Streaming indicator (when no assistant message yet) */}
        {showStreamingIndicator && <StreamingIndicatorView step={currentStep!} />}

        {/* Error display */}
        {error && (
          <View style={s.errorBanner}>
            <Text style={s.errorText}>{error.message}</Text>
          </View>
        )}

        {/* Input area */}
        <View style={s.inputWrap}>
          <View style={[s.inputBox, { borderColor: c.border, backgroundColor: c.card }]}>
            <TextInput
              style={[s.textInput, { color: c.foreground }]}
              placeholder={t("chat.askPlaceholder", "输入你的问题...")}
              placeholderTextColor={c.mutedForeground}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={4000}
              returnKeyType="default"
              editable={!isStreaming}
            />
            <View style={s.inputBottomRow}>
              <View style={s.inputToolbar}>
                <TouchableOpacity
                  style={[s.deepThinkBtn, { borderColor: c.border }, deepThinking && s.deepThinkBtnActive]}
                  onPress={() => setDeepThinking(!deepThinking)}
                >
                  <BrainIcon size={12} color={deepThinking ? "#a855f7" : c.mutedForeground} />
                  <Text style={[s.deepThinkLabel, { color: c.mutedForeground }, deepThinking && s.deepThinkLabelActive]}>
                    {t("chat.deepThinking", "深度思考")}
                  </Text>
                </TouchableOpacity>
              </View>
              {isStreaming ? (
                <TouchableOpacity style={s.stopBtn} onPress={stopStream}>
                  <StopCircleIcon size={14} color={c.destructive} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[s.sendBtn, { backgroundColor: c.primary }, !inputText.trim() && s.sendBtnDisabled]}
                  onPress={() => handleSend()}
                  disabled={!inputText.trim()}
                >
                  <Text style={[s.sendBtnText, { color: c.primaryForeground }]}>↑</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          {deepThinking && (
            <Text style={[s.deepThinkHint, { color: c.mutedForeground }]}>
              {t("chat.deepThinkingHint", "深度思考模式：AI 将更加仔细地分析和推理")}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Thread Sidebar */}
      <ThreadsSidebar
        open={showSidebar}
        onClose={() => toggleSidebar(false)}
        onSelect={handleSelectThread}
        onNewThread={handleNewThread}
        sidebarAnim={sidebarAnim}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  // Header
  header: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(61,61,64,0.5)",
    paddingHorizontal: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContextText: { fontSize: fontSize.xs, color: colors.mutedForeground, flex: 1 },
  headerContextBook: { fontWeight: fontWeight.medium, color: colors.foreground },
  body: { flex: 1 },
  // Empty state
  emptyContainer: { flexGrow: 1, justifyContent: "center", padding: 24 },
  emptyTop: { alignItems: "center", gap: 12, marginBottom: 32 },
  brainIconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: "rgba(99,102,241,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: colors.foreground },
  emptySubtitle: { fontSize: fontSize.sm, color: colors.mutedForeground },
  suggestSection: { gap: 8 },
  suggestLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  suggestGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  suggestCard: {
    width: "48%",
    backgroundColor: "rgba(51,51,54,0.7)",
    borderRadius: radius.xl,
    padding: 14,
    gap: 10,
  },
  suggestText: { fontSize: fontSize.xs, color: colors.foreground, lineHeight: 16 },
  // Messages
  messageList: { paddingTop: 12, paddingBottom: 8, paddingHorizontal: 16, gap: 12 },
  streamingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  streamingText: { fontSize: fontSize.xs, color: colors.indigo },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "rgba(229,57,53,0.1)",
    borderRadius: radius.lg,
    padding: 10,
  },
  errorText: { fontSize: fontSize.xs, color: colors.destructive },
  // Input
  inputWrap: { paddingHorizontal: 12, paddingBottom: 4 },
  inputBox: {
    borderRadius: radius.xxl,
    borderWidth: 0.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  textInput: {
    fontSize: fontSize.sm,
    color: colors.foreground,
    maxHeight: 120,
    minHeight: 36,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    lineHeight: 20,
  },
  inputBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  inputToolbar: { flexDirection: "row", alignItems: "center", gap: 4 },
  deepThinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.full,
    borderWidth: 0.5,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deepThinkBtnActive: {
    borderColor: "rgba(168,85,247,0.3)",
    backgroundColor: "rgba(168,85,247,0.08)",
  },
  deepThinkLabel: { fontSize: fontSize.xs, color: colors.mutedForeground },
  deepThinkLabelActive: { color: "#a855f7" },
  deepThinkHint: {
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    textAlign: "center",
    marginTop: 6,
  },
  sendBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: 14, fontWeight: fontWeight.bold, color: colors.primaryForeground },
  stopBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(229,57,53,0.1)",
  },
  // Sidebar
  sidebarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.2)",
    zIndex: 10,
  },
  sidebar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: SCREEN_WIDTH * 0.75,
    maxWidth: 300,
    backgroundColor: colors.background,
    borderTopRightRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
    borderRightWidth: 0.5,
    borderRightColor: colors.border,
    zIndex: 20,
    elevation: 10,
  },
  sidebarInner: { flex: 1, paddingHorizontal: 12, paddingVertical: 12 },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sidebarTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.foreground },
  sidebarList: { flex: 1 },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
    marginBottom: 4,
  },
  sidebarItemActive: { backgroundColor: "rgba(99,102,241,0.1)" },
  sidebarItemContent: { flex: 1 },
  sidebarItemRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sidebarItemTitle: {
    fontSize: fontSize.sm,
    color: colors.foreground,
    fontWeight: fontWeight.medium,
    flex: 1,
  },
  sidebarItemTime: { fontSize: 10, color: "rgba(124,124,130,0.5)" },
  sidebarItemPreview: {
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  sidebarDeleteBtn: { padding: 4, borderRadius: radius.sm },
  sidebarEmpty: {
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    textAlign: "center",
    paddingTop: 32,
  },
});
