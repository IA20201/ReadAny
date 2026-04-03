import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import {
  BookOpenIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EditIcon,
  ScrollTextIcon,
  HighlighterIcon,
  LibraryIcon,
  NotebookPenIcon,
  PlusIcon,
  SearchIcon,
  ShareIcon,
  Trash2Icon,
  XIcon,
} from "@/components/ui/Icon";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import type { TabParamList } from "@/navigation/TabNavigator";
import { useAnnotationStore, useLibraryStore } from "@/stores";
import {
  type ThemeColors,
  fontSize,
  fontWeight,
  radius,
  useColors,
  useTheme,
  withOpacity,
} from "@/styles/theme";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { HighlightWithBook } from "@readany/core/db/database";
import { AnnotationExporter, type ExportFormat } from "@readany/core/export";
import { getPlatformService } from "@readany/core/services";
import { HIGHLIGHT_COLOR_HEX } from "@readany/core/types";
import type { Highlight } from "@readany/core/types";
/**
 * NotesScreen — matching Tauri mobile NotesPage exactly.
 * Features: stats header, book notebooks list with covers, detail view with
 * highlights/notes tabs, chapter grouping, color dots, edit/delete, export, search.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const NOTE_PNG = require("../../assets/note.png");
const NOTE_DARK_PNG = require("../../assets/note-dark.png");

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DetailTab = "notes" | "highlights" | "knowledge";
type Props = BottomTabScreenProps<TabParamList, "Notes">;

export function NotesView({
  initialBookId,
  showBackButton,
  edges = ["top"],
  hideDetailHeader,
}: {
  initialBookId?: string | null;
  showBackButton?: boolean;
  edges?: ("top" | "bottom" | "left" | "right")[];
  hideDetailHeader?: boolean;
}) {
  const colors = useColors();
  const { isDark } = useTheme();
  const s = makeStyles(colors);
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const {
    highlightsWithBooks,
    loadAllHighlightsWithBooks,
    removeHighlight,
    updateHighlight,
    stats,
    loadStats,
    knowledgeNotes,
    loadKnowledgeNotes,
  } = useAnnotationStore();
  const books = useLibraryStore((s) => s.books);

  const [selectedBookId, setSelectedBookId] = useState<string | null>(initialBookId || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [detailTab, setDetailTab] = useState<DetailTab>("notes");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [resolvedCovers, setResolvedCovers] = useState<Map<string, string>>(new Map());

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      Promise.all([loadAllHighlightsWithBooks(500), loadStats()]).finally(() =>
        setIsLoading(false),
      );

      return () => {
        setSelectedBookId(null);
        setEditingId(null);
        setSearchQuery("");
      };
    }, [loadAllHighlightsWithBooks, loadStats]),
  );

  // Handle incoming bookId
  useEffect(() => {
    if (initialBookId) {
      setSelectedBookId(initialBookId);
      setSearchQuery("");
      setEditingId(null);
      setDetailTab("notes");
    }
  }, [initialBookId]);

  // Load knowledge notes when a book is selected
  useEffect(() => {
    if (selectedBookId) {
      loadKnowledgeNotes(selectedBookId);
    }
  }, [selectedBookId, loadKnowledgeNotes]);

  // Group by book — matching Tauri exactly
  const bookNotebooks = useMemo(() => {
    const grouped = new Map<
      string,
      {
        bookId: string;
        title: string;
        author: string;
        coverUrl: string | null;
        highlights: HighlightWithBook[];
        notesCount: number;
        highlightsOnlyCount: number;
        latestAt: number;
      }
    >();

    for (const h of highlightsWithBooks) {
      const existing = grouped.get(h.bookId);
      if (existing) {
        existing.highlights.push(h);
        if (h.note) existing.notesCount++;
        else existing.highlightsOnlyCount++;
        if (h.createdAt > existing.latestAt) existing.latestAt = h.createdAt;
      } else {
        grouped.set(h.bookId, {
          bookId: h.bookId,
          title: h.bookTitle || t("notes.unknownBook", "未知书籍"),
          author: h.bookAuthor || t("notes.unknownAuthor", "未知作者"),
          coverUrl: h.bookCoverUrl || null,
          highlights: [h],
          notesCount: h.note ? 1 : 0,
          highlightsOnlyCount: h.note ? 0 : 1,
          latestAt: h.createdAt,
        });
      }
    }

    return Array.from(grouped.values()).sort((a, b) => b.latestAt - a.latestAt);
  }, [highlightsWithBooks, t]);

  // Resolve cover URLs from relative paths to absolute paths
  useEffect(() => {
    const resolveCovers = async () => {
      const newMap = new Map<string, string>();
      try {
        const platform = getPlatformService();
        const appData = await platform.getAppDataDir();

        for (const book of bookNotebooks) {
          if (!book.coverUrl) continue;

          if (
            book.coverUrl.startsWith("http") ||
            book.coverUrl.startsWith("blob") ||
            book.coverUrl.startsWith("file")
          ) {
            newMap.set(book.bookId, book.coverUrl);
            continue;
          }

          try {
            const absPath = await platform.joinPath(appData, book.coverUrl);
            newMap.set(book.bookId, absPath);
          } catch {
            // If resolution fails, skip this cover
          }
        }

        setResolvedCovers(newMap);
      } catch (err) {
        console.error("Failed to resolve cover URLs:", err);
      }
    };

    if (bookNotebooks.length > 0) {
      resolveCovers();
    }
  }, [bookNotebooks]);

  const selectedBook = useMemo(() => {
    if (!selectedBookId) return null;
    return bookNotebooks.find((b) => b.bookId === selectedBookId) || null;
  }, [selectedBookId, bookNotebooks]);

  const { notesList, highlightsList } = useMemo(() => {
    if (!selectedBook) return { notesList: [], highlightsList: [] };
    let all = selectedBook.highlights;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      all = all.filter(
        (h) =>
          h.text.toLowerCase().includes(q) ||
          h.note?.toLowerCase().includes(q) ||
          h.chapterTitle?.toLowerCase().includes(q),
      );
    }
    const sorted = all.sort((a, b) => b.createdAt - a.createdAt);
    return {
      notesList: sorted.filter((h) => h.note),
      highlightsList: sorted.filter((h) => !h.note),
    };
  }, [selectedBook, searchQuery]);

  const currentList = detailTab === "notes" ? notesList : highlightsList;

  // Group by chapter
  const itemsByChapter = useMemo(() => {
    const chapters: { chapter: string; items: HighlightWithBook[] }[] = [];
    const chapterMap = new Map<string, HighlightWithBook[]>();
    for (const h of currentList) {
      const chapter = h.chapterTitle || t("notes.unknownChapter", "未知章节");
      const arr = chapterMap.get(chapter) || [];
      arr.push(h);
      chapterMap.set(chapter, arr);
    }
    for (const [chapter, items] of chapterMap) {
      chapters.push({ chapter, items });
    }
    return chapters;
  }, [currentList, t]);

  const handleOpenBook = useCallback(
    (bookId: string, cfi?: string) => {
      nav.navigate("Reader", { bookId, cfi });
    },
    [nav],
  );

  const handleDeleteNote = useCallback(
    (highlight: HighlightWithBook) => {
      Alert.alert(t("common.confirm", "确认"), t("notes.deleteNoteConfirm", "确定删除此笔记？"), [
        { text: t("common.cancel", "取消"), style: "cancel" },
        {
          text: t("common.delete", "删除"),
          style: "destructive",
          onPress: async () => {
            removeHighlight(highlight.id);
            await loadAllHighlightsWithBooks(500);
            loadStats();
          },
        },
      ]);
    },
    [removeHighlight, loadAllHighlightsWithBooks, loadStats, t],
  );

  const handleDeleteHighlight = useCallback(
    (highlight: HighlightWithBook) => {
      Alert.alert(
        t("common.confirm", "确认"),
        t("notes.deleteHighlightConfirm", "确定删除此高亮？"),
        [
          { text: t("common.cancel", "取消"), style: "cancel" },
          {
            text: t("common.delete", "删除"),
            style: "destructive",
            onPress: async () => {
              removeHighlight(highlight.id);
              await loadAllHighlightsWithBooks(500);
              loadStats();
            },
          },
        ],
      );
    },
    [removeHighlight, loadAllHighlightsWithBooks, loadStats, t],
  );

  const startEditNote = useCallback((highlight: HighlightWithBook) => {
    setEditingId(highlight.id);
    setEditNote(highlight.note || "");
  }, []);

  const saveNote = useCallback(
    (id: string) => {
      updateHighlight(id, { note: editNote || undefined });
      setEditingId(null);
      setEditNote("");
    },
    [updateHighlight, editNote],
  );

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditNote("");
  }, []);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setShowExportMenu(false);
      if (!selectedBook) return;

      const book = books.find((b) => b.id === selectedBook.bookId);
      if (!book) return;

      const exporter = new AnnotationExporter();
      const content = exporter.export(selectedBook.highlights as Highlight[], [], book, { format });

      try {
        if (format === "notion") {
          await exporter.copyToClipboard(content);
          Alert.alert(t("common.success", "成功"), t("notes.copiedToClipboard", "已复制到剪贴板"));
        } else {
          const ext = format === "json" ? "json" : "md";
          await exporter.downloadAsFile(content, `${selectedBook.title}-${format}.${ext}`, format);
        }
      } catch (err) {
        console.error("Export failed:", err);
        Alert.alert(t("common.error", "错误"), t("notes.exportFailed", "导出失败"));
      }
    },
    [selectedBook, books, t],
  );

  const totalHighlights = stats?.totalHighlights ?? 0;
  const totalNotes = stats?.highlightsWithNotes ?? 0;
  const totalBooks = stats?.totalBooks ?? 0;

  // Loading
  if (isLoading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={s.loadingWrap}>
          <View style={s.spinner} />
          <Text style={s.loadingText}>{t("common.loading", "加载中...")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Empty
  if (bookNotebooks.length === 0) {
    return (
      <SafeAreaView
        style={[s.container, { backgroundColor: colors.background }]}
        edges={hideDetailHeader ? [] : ["top"]}
      >
        {!hideDetailHeader && (
          <View style={s.header}>
            <Text style={s.headerTitle}>{t("notes.title", "笔记")}</Text>
          </View>
        )}
        <View style={s.emptyWrap}>
          <Image source={isDark ? NOTE_DARK_PNG : NOTE_PNG} style={{ width: 160, height: 160 }} />
          <Text style={s.emptyTitle}>{t("notes.empty", "暂无笔记")}</Text>
          <Text style={s.emptyHint}>{t("notes.emptyHint", "阅读时长按文字添加高亮和笔记")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Detail view
  if (selectedBookId && selectedBook) {
    const bookKnowledgeNotes = knowledgeNotes.filter((n) => n.bookId === selectedBookId);
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={edges}>
        {/* Detail header */}
        {!(hideDetailHeader && selectedBook.highlights.length === 0) && (
          <View style={s.detailHeader}>
            {!hideDetailHeader && (
              <View style={s.detailHeaderTop}>
                {showBackButton && (
                  <TouchableOpacity style={s.backBtn} onPress={() => setSelectedBookId(null)}>
                    <ChevronLeftIcon size={20} color={colors.foreground} />
                  </TouchableOpacity>
                )}

                {/* Book cover */}
                {resolvedCovers.get(selectedBook.bookId) || selectedBook.coverUrl ? (
                  <Image
                    source={{
                      uri: resolvedCovers.get(selectedBook.bookId) || selectedBook.coverUrl || "",
                    }}
                    style={s.detailCover}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={s.detailCoverFallback}>
                    <BookOpenIcon size={14} color={colors.mutedForeground} />
                  </View>
                )}

                <View style={s.detailHeaderInfo}>
                  <Text style={s.detailTitle} numberOfLines={1}>
                    {selectedBook.title}
                  </Text>
                  <Text style={s.detailAuthor} numberOfLines={1}>{selectedBook.author}</Text>
                </View>

                <TouchableOpacity
                  style={s.exportBtn}
                  onPress={() => setShowExportMenu(!showExportMenu)}
                >
                  <ShareIcon size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            )}

            {/* Pill segment tabs */}
            <View style={s.tabRow}>
              <View style={s.tabSwitcher}>
                <TouchableOpacity
                  style={[s.tabBtn, detailTab === "notes" && s.tabBtnActive]}
                  onPress={() => setDetailTab("notes")}
                >
                  <NotebookPenIcon
                    size={11}
                    color={detailTab === "notes" ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={[s.tabBtnText, detailTab === "notes" && s.tabBtnTextActive]}>
                    {t("notebook.notesSection", "笔记")}
                  </Text>
                  <View style={[s.tabCount, detailTab === "notes" && s.tabCountActive]}>
                    <Text style={[s.tabCountText, detailTab === "notes" && s.tabCountTextActive]}>
                      {selectedBook.notesCount || 0}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.tabBtn, detailTab === "highlights" && s.tabBtnActive]}
                  onPress={() => setDetailTab("highlights")}
                >
                  <HighlighterIcon
                    size={11}
                    color={detailTab === "highlights" ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={[s.tabBtnText, detailTab === "highlights" && s.tabBtnTextActive]}>
                    {t("notebook.highlightsSection", "高亮")}
                  </Text>
                  <View style={[s.tabCount, detailTab === "highlights" && s.tabCountActive]}>
                    <Text style={[s.tabCountText, detailTab === "highlights" && s.tabCountTextActive]}>
                      {selectedBook.highlightsOnlyCount || 0}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.tabBtn, detailTab === "knowledge" && s.tabBtnActive]}
                  onPress={() => setDetailTab("knowledge")}
                >
                  <LibraryIcon
                    size={11}
                    color={detailTab === "knowledge" ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={[s.tabBtnText, detailTab === "knowledge" && s.tabBtnTextActive]}>
                    {t("knowledge.title", "知识")}
                  </Text>
                  <View style={[s.tabCount, detailTab === "knowledge" && s.tabCountActive]}>
                    <Text style={[s.tabCountText, detailTab === "knowledge" && s.tabCountTextActive]}>
                      {bookKnowledgeNotes.length}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {detailTab !== "knowledge" && (
                <View style={s.detailSearch}>
                  <SearchIcon size={13} color={colors.mutedForeground} />
                  <TextInput
                    style={s.detailSearchInput}
                    placeholder={t("notes.searchPlaceholder", "搜索...")}
                    placeholderTextColor={colors.mutedForeground}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>
              )}
            </View>
          </View>
        )}

        {/* Detail content */}
        {detailTab === "knowledge" ? (
          <View style={{ flex: 1 }}>
            {bookKnowledgeNotes.length === 0 ? (
              <View style={s.detailEmpty}>
                <View style={s.detailEmptyIconWrap}>
                  <ScrollTextIcon size={28} color={colors.mutedForeground} />
                </View>
                <Text style={s.detailEmptyTitle}>{t("knowledge.noDocuments", "暂无知识文档")}</Text>
                <Text style={s.detailEmptyHint}>{t("knowledge.noDocumentsHint", "点击右下角 + 新建一篇")}</Text>
              </View>
            ) : (
              <ScrollView style={s.detailList} showsVerticalScrollIndicator={false}>
                {bookKnowledgeNotes
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .map((doc) => (
                    <TouchableOpacity
                      key={doc.id}
                      style={s.knowledgeCard}
                      activeOpacity={0.7}
                      onPress={() =>
                        nav.navigate("KnowledgeEditor", {
                          bookId: selectedBookId!,
                          docId: doc.id,
                        })
                      }
                    >
                      <View style={s.knowledgeCardIcon}>
                        <ScrollTextIcon size={16} color={colors.primary} />
                      </View>
                      <View style={s.knowledgeCardBody}>
                        <Text style={s.knowledgeCardTitle} numberOfLines={1}>
                          {doc.title || t("knowledge.untitled", "无标题")}
                        </Text>
                        <Text style={s.knowledgeCardDate}>
                          {new Date(doc.updatedAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <ChevronRightIcon size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  ))}
                <View style={{ height: 100 }} />
              </ScrollView>
            )}
            {/* FAB to create new knowledge doc */}
            <TouchableOpacity
              style={s.fab}
              activeOpacity={0.85}
              onPress={() => nav.navigate("KnowledgeEditor", { bookId: selectedBookId! })}
            >
              <PlusIcon size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : currentList.length === 0 ? (
          <View style={s.detailEmpty}>
            <View style={s.detailEmptyIconWrap}>
              {detailTab === "notes"
                ? <NotebookPenIcon size={28} color={colors.mutedForeground} />
                : <HighlighterIcon size={28} color={colors.mutedForeground} />
              }
            </View>
            <Text style={s.detailEmptyTitle}>
              {searchQuery
                ? t("notes.noSearchResults", "没有匹配结果")
                : detailTab === "notes"
                  ? t("notes.noNotes", "暂无笔记")
                  : t("highlights.noHighlights", "暂无高亮")}
            </Text>
          </View>
        ) : (
          <ScrollView style={s.detailList} showsVerticalScrollIndicator={false}>
            {itemsByChapter.map(({ chapter, items }) => (
              <View key={chapter} style={s.chapterGroup}>
                {/* Chapter pill divider */}
                <View style={s.chapterDivider}>
                  <View style={s.chapterLine} />
                  <View style={s.chapterPill}>
                    <BookOpenIcon size={10} color={colors.mutedForeground} />
                    <Text style={s.chapterName}>{chapter}</Text>
                  </View>
                  <View style={s.chapterLine} />
                </View>

                {items.map((item) =>
                  detailTab === "notes" ? (
                    <NoteCard
                      key={item.id}
                      highlight={item}
                      isEditing={editingId === item.id}
                      editNote={editNote}
                      setEditNote={setEditNote}
                      onStartEdit={() => startEditNote(item)}
                      onSaveNote={() => saveNote(item.id)}
                      onCancelEdit={cancelEdit}
                      onDeleteNote={() => handleDeleteNote(item)}
                      onNavigate={() => handleOpenBook(selectedBook.bookId, item.cfi)}
                      t={t}
                    />
                  ) : (
                    <HighlightCard
                      key={item.id}
                      highlight={item}
                      onDelete={() => handleDeleteHighlight(item)}
                      onNavigate={() => handleOpenBook(selectedBook.bookId, item.cfi)}
                    />
                  ),
                )}
              </View>
            ))}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}

        {/* Export menu */}
        <Modal
          visible={showExportMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowExportMenu(false)}
        >
          <Pressable style={s.exportOverlay} onPress={() => setShowExportMenu(false)} />
          <View style={s.exportDropdown}>
            {(["markdown", "json", "obsidian", "notion"] as const).map((fmt) => (
              <TouchableOpacity key={fmt} style={s.exportItem} onPress={() => handleExport(fmt)}>
                <Text style={s.exportItemText}>
                  {fmt === "markdown"
                    ? "Markdown"
                    : fmt === "json"
                      ? "JSON"
                      : fmt === "obsidian"
                        ? "Obsidian"
                        : "Notion"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Main list view
  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={edges}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <Text style={s.headerTitle}>{t("notes.title", "笔记")}</Text>
          {bookNotebooks.length > 0 && (
            <TouchableOpacity
              style={s.searchToggle}
              onPress={() => {
                setShowSearch(!showSearch);
                if (showSearch) setSearchQuery("");
              }}
            >
              {showSearch ? (
                <XIcon size={18} color={colors.mutedForeground} />
              ) : (
                <SearchIcon size={18} color={colors.mutedForeground} />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={[s.statBadge, { backgroundColor: withOpacity(colors.amber, 0.12) }]}>
            <HighlighterIcon size={13} color={colors.amber} />
            <Text style={[s.statValue, { color: colors.amber }]}>{totalHighlights}</Text>
            <Text style={s.statLabel}>{t("notebook.highlightsSection", "高亮")}</Text>
          </View>
          <View style={[s.statBadge, { backgroundColor: withOpacity(colors.blue, 0.12) }]}>
            <NotebookPenIcon size={13} color={colors.blue} />
            <Text style={[s.statValue, { color: colors.blue }]}>{totalNotes}</Text>
            <Text style={s.statLabel}>{t("notebook.notesSection", "笔记")}</Text>
          </View>
          <View style={[s.statBadge, { backgroundColor: withOpacity(colors.emerald, 0.12) }]}>
            <BookOpenIcon size={13} color={colors.emerald} />
            <Text style={[s.statValue, { color: colors.emerald }]}>{totalBooks}</Text>
            <Text style={s.statLabel}>{t("profile.booksUnit", "本")}</Text>
          </View>
        </View>

        {showSearch && (
          <View style={s.searchBar}>
            <SearchIcon size={14} color={colors.mutedForeground} />
            <TextInput
              style={s.searchInput}
              placeholder={t("notes.searchPlaceholder", "搜索笔记...")}
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <XIcon size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Notebook list */}
      <FlatList
        data={bookNotebooks}
        keyExtractor={(item) => item.bookId}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <NotebookCard
            book={item}
            resolvedCoverUrl={resolvedCovers.get(item.bookId)}
            onPress={() => {
              setSelectedBookId(item.bookId);
              setSearchQuery("");
              setEditingId(null);
              setDetailTab("notes");
            }}
          />
        )}
      />
    </SafeAreaView>
  );
}

/** NotebookCard */
function NotebookCard({
  book,
  onPress,
  resolvedCoverUrl,
}: {
  book: {
    bookId: string;
    title: string;
    author: string;
    coverUrl: string | null;
    highlights: HighlightWithBook[];
    notesCount: number;
    highlightsOnlyCount: number;
  };
  onPress: () => void;
  resolvedCoverUrl?: string;
}) {
  const colors = useColors();
  const s = makeStyles(colors);

  return (
    <TouchableOpacity style={s.notebookCard} activeOpacity={0.75} onPress={onPress}>
      {/* Cover */}
      <View style={s.notebookCoverWrap}>
        {resolvedCoverUrl || book.coverUrl ? (
          <Image
            source={{ uri: resolvedCoverUrl || book.coverUrl || "" }}
            style={s.notebookCover}
            resizeMode="cover"
          />
        ) : (
          <View style={s.notebookCoverFallback}>
            <BookOpenIcon size={22} color={colors.mutedForeground} />
          </View>
        )}
        {/* Total count overlay */}
        <View style={s.notebookCountBadge}>
          <Text style={s.notebookCountText}>{book.highlights.length}</Text>
        </View>
      </View>

      <View style={s.notebookInfo}>
        <Text style={s.notebookTitle} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={s.notebookAuthor} numberOfLines={1}>
          {book.author}
        </Text>
        <View style={s.notebookStats}>
          <View style={s.notebookStatItem}>
            <NotebookPenIcon size={11} color={colors.mutedForeground} />
            <Text style={s.notebookStatText}>{book.notesCount}</Text>
          </View>
          <View style={s.notebookStatDivider} />
          <View style={s.notebookStatItem}>
            <HighlighterIcon size={11} color={colors.mutedForeground} />
            <Text style={s.notebookStatText}>{book.highlightsOnlyCount}</Text>
          </View>
        </View>
      </View>

      <ChevronRightIcon size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

/** Note detail card */
function NoteCard({
  highlight,
  isEditing,
  editNote,
  setEditNote,
  onStartEdit,
  onSaveNote,
  onCancelEdit,
  onDeleteNote,
  onNavigate,
  t,
}: {
  highlight: HighlightWithBook;
  isEditing: boolean;
  editNote: string;
  setEditNote: (note: string) => void;
  onStartEdit: () => void;
  onSaveNote: () => void;
  onCancelEdit: () => void;
  onDeleteNote: () => void;
  onNavigate: () => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const colors = useColors();
  const s = makeStyles(colors);
  const accentColor = HIGHLIGHT_COLOR_HEX[highlight.color] || colors.amber;

  return (
    <View style={s.noteCard}>
      {/* Left color accent bar */}
      <View style={[s.noteAccentBar, { backgroundColor: accentColor }]} />

      <View style={s.noteCardContent}>
        <TouchableOpacity onPress={onNavigate}>
          <Text style={s.noteQuote} numberOfLines={3}>
            {highlight.text}
          </Text>
        </TouchableOpacity>

        {isEditing ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={s.editArea}
          >
            <View style={s.editorContainer}>
              <RichTextEditor
                initialContent={editNote}
                onChange={setEditNote}
                placeholder={t("notebook.addNote", "添加笔记...")}
                autoFocus
              />
            </View>
            <View style={s.editActions}>
              <TouchableOpacity style={s.editCancelBtn} onPress={onCancelEdit}>
                <XIcon size={13} color={colors.mutedForeground} />
                <Text style={s.editCancelText}>{t("common.cancel", "取消")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.editSaveBtn} onPress={onSaveNote}>
                <CheckIcon size={13} color={colors.primaryForeground} />
                <Text style={s.editSaveText}>{t("common.save", "保存")}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        ) : (
          <>
            {highlight.note && (
              <TouchableOpacity style={s.noteBody} onPress={onNavigate}>
                <MarkdownRenderer content={highlight.note} />
              </TouchableOpacity>
            )}
            <View style={s.noteActions}>
              <TouchableOpacity style={s.noteActionBtn} onPress={onStartEdit}>
                <EditIcon size={13} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity style={s.noteActionBtn} onPress={onDeleteNote}>
                <Trash2Icon size={13} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

/** Highlight detail card */
function HighlightCard({
  highlight,
  onDelete,
  onNavigate,
}: {
  highlight: HighlightWithBook;
  onDelete: () => void;
  onNavigate: () => void;
}) {
  const colors = useColors();
  const s = makeStyles(colors);
  const accentColor = HIGHLIGHT_COLOR_HEX[highlight.color] || colors.amber;

  return (
    <View style={s.highlightCard}>
      {/* Left color accent bar */}
      <View style={[s.highlightAccentBar, { backgroundColor: accentColor }]} />
      <View style={s.highlightBody}>
        <TouchableOpacity onPress={onNavigate}>
          <Text style={s.highlightText} numberOfLines={4}>
            {highlight.text}
          </Text>
        </TouchableOpacity>
        {highlight.chapterTitle && (
          <Text style={s.highlightChapter}>{highlight.chapterTitle}</Text>
        )}
      </View>
      <TouchableOpacity style={s.highlightDeleteBtn} onPress={onDelete}>
        <Trash2Icon size={13} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    spinner: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2.5,
      borderColor: withOpacity(colors.primary, 0.2),
      borderTopColor: colors.primary,
    },
    loadingText: { fontSize: fontSize.sm, color: colors.mutedForeground },

    // ── Header ─────────────────────────────────────────────
    header: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerTitle: {
      fontSize: fontSize["2xl"],
      fontWeight: fontWeight.bold,
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    searchToggle: {
      width: 36,
      height: 36,
      borderRadius: radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.muted,
    },
    statsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
    statBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    statValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    statLabel: { fontSize: 11, color: colors.mutedForeground },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: withOpacity(colors.muted, 0.6),
      borderRadius: radius.full,
      borderWidth: 0.5,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 36,
      gap: 8,
      marginTop: 10,
    },
    searchInput: { flex: 1, fontSize: fontSize.sm, color: colors.foreground, padding: 0 },

    // ── Empty ───────────────────────────────────────────────
    emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 10 },
    emptyTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      color: colors.foreground,
    },
    emptyHint: {
      fontSize: fontSize.sm,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 20,
    },

    // ── Notebook list ───────────────────────────────────────
    listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
    notebookCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 0.5,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 10,
      gap: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    notebookCoverWrap: { position: "relative" },
    notebookCover: {
      width: 48,
      height: 68,
      borderRadius: radius.sm,
      backgroundColor: colors.muted,
    },
    notebookCoverFallback: {
      width: 48,
      height: 68,
      borderRadius: radius.sm,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    notebookCountBadge: {
      position: "absolute",
      bottom: -4,
      right: -4,
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      minWidth: 18,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
      borderWidth: 1.5,
      borderColor: colors.card,
    },
    notebookCountText: { fontSize: 10, fontWeight: fontWeight.bold, color: colors.primaryForeground },
    notebookInfo: { flex: 1, gap: 3 },
    notebookTitle: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: colors.foreground,
      lineHeight: 19,
    },
    notebookAuthor: { fontSize: 12, color: colors.mutedForeground },
    notebookStats: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 },
    notebookStatItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    notebookStatDivider: { width: 1, height: 10, backgroundColor: colors.border },
    notebookStatText: { fontSize: 11, color: colors.mutedForeground },

    // ── Detail header ───────────────────────────────────────
    detailHeader: {
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    detailHeaderTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
    },
    backBtn: {
      width: 32,
      height: 32,
      borderRadius: radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.muted,
    },
    detailCover: { width: 28, height: 40, borderRadius: 4, backgroundColor: colors.muted },
    detailCoverFallback: {
      width: 28,
      height: 40,
      borderRadius: 4,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    detailHeaderInfo: { flex: 1, minWidth: 0, gap: 1 },
    detailTitle: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: colors.foreground,
    },
    detailAuthor: { fontSize: 11, color: colors.mutedForeground },
    exportBtn: {
      width: 32,
      height: 32,
      borderRadius: radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.muted,
    },

    // ── Pill segment tabs ───────────────────────────────────
    tabRow: {
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 12,
    },
    tabSwitcher: {
      flexDirection: "row",
      backgroundColor: withOpacity(colors.muted, 0.7),
      borderRadius: radius.full,
      borderWidth: 0.5,
      borderColor: colors.border,
      padding: 3,
      gap: 2,
    },
    tabBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: radius.full,
    },
    tabBtnActive: {
      backgroundColor: colors.background,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    tabBtnText: {
      fontSize: 11,
      fontWeight: fontWeight.medium,
      color: colors.mutedForeground,
    },
    tabBtnTextActive: { color: colors.primary },
    tabCount: {
      backgroundColor: withOpacity(colors.mutedForeground, 0.15),
      borderRadius: radius.full,
      minWidth: 16,
      height: 16,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    tabCountActive: { backgroundColor: withOpacity(colors.primary, 0.15) },
    tabCountText: { fontSize: 10, fontWeight: fontWeight.semibold, color: colors.mutedForeground },
    tabCountTextActive: { color: colors.primary },
    detailSearch: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: withOpacity(colors.muted, 0.5),
      borderRadius: radius.full,
      borderWidth: 0.5,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 32,
    },
    detailSearchInput: { flex: 1, fontSize: fontSize.sm, color: colors.foreground, padding: 0 },

    // ── Detail empty ────────────────────────────────────────
    detailEmpty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
    detailEmptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: radius.xl,
      backgroundColor: withOpacity(colors.muted, 0.7),
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    detailEmptyTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.mutedForeground },
    detailEmptyHint: { fontSize: 12, color: withOpacity(colors.mutedForeground, 0.7), textAlign: "center" },
    detailEmptyText: { fontSize: fontSize.sm, color: colors.mutedForeground },

    // ── Detail list ─────────────────────────────────────────
    detailList: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
    chapterGroup: { marginBottom: 16 },
    chapterDivider: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, marginTop: 4 },
    chapterLine: { flex: 1, height: 0.5, backgroundColor: colors.border },
    chapterPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 0.5,
      borderColor: withOpacity(colors.border, 0.8),
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: withOpacity(colors.muted, 0.4),
    },
    chapterName: {
      fontSize: 11,
      fontWeight: fontWeight.medium,
      color: colors.mutedForeground,
    },

    // ── Note card ───────────────────────────────────────────
    noteCard: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 0.5,
      borderColor: colors.border,
      marginBottom: 8,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 3,
      elevation: 1,
    },
    noteAccentBar: {
      width: 3,
      alignSelf: "stretch",
    },
    noteCardContent: {
      flex: 1,
      padding: 11,
    },
    noteQuote: {
      fontSize: fontSize.sm,
      color: withOpacity(colors.foreground, 0.75),
      lineHeight: 20,
      fontStyle: "italic",
    },
    noteBody: {
      marginTop: 8,
      backgroundColor: withOpacity(colors.muted, 0.6),
      borderRadius: radius.md,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    noteActions: { flexDirection: "row", justifyContent: "flex-end", gap: 2, marginTop: 6 },
    noteActionBtn: {
      padding: 6,
      borderRadius: radius.md,
    },

    // ── Edit ────────────────────────────────────────────────
    editArea: { marginTop: 8 },
    editorContainer: {
      flex: 1,
      minHeight: 180,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 },
    editCancelBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.md,
      backgroundColor: colors.muted,
    },
    editCancelText: { fontSize: fontSize.xs, color: colors.mutedForeground },
    editSaveBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: radius.md,
    },
    editSaveText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: colors.primaryForeground },

    // ── Highlight card ──────────────────────────────────────
    highlightCard: {
      flexDirection: "row",
      alignItems: "stretch",
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 0.5,
      borderColor: colors.border,
      marginBottom: 8,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 3,
      elevation: 1,
    },
    highlightAccentBar: {
      width: 3,
      alignSelf: "stretch",
    },
    highlightBody: { flex: 1, paddingVertical: 11, paddingHorizontal: 11 },
    highlightText: {
      fontSize: fontSize.sm,
      color: colors.foreground,
      lineHeight: 21,
      fontStyle: "italic",
    },
    highlightChapter: { fontSize: 11, color: colors.mutedForeground, marginTop: 5 },
    highlightDeleteBtn: { padding: 11, justifyContent: "center" },

    // ── Export ──────────────────────────────────────────────
    exportOverlay: { flex: 1 },
    exportDropdown: {
      position: "absolute",
      top: 60,
      right: 16,
      minWidth: 140,
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 0.5,
      borderColor: colors.border,
      padding: 4,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
    exportItem: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
    exportItemText: { fontSize: fontSize.sm, color: colors.foreground },

    // ── Knowledge docs ──────────────────────────────────────
    knowledgeCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 0.5,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 8,
      gap: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 3,
      elevation: 1,
    },
    knowledgeCardIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.lg,
      backgroundColor: withOpacity(colors.primary, 0.1),
      alignItems: "center",
      justifyContent: "center",
    },
    knowledgeCardBody: { flex: 1, minWidth: 0, gap: 2 },
    knowledgeCardTitle: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.foreground,
    },
    knowledgeCardDate: { fontSize: 11, color: colors.mutedForeground },

    // ── FAB ─────────────────────────────────────────────────
    fab: {
      position: "absolute",
      bottom: 24,
      right: 20,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
  });
