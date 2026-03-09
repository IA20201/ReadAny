/**
 * ReaderScreen — WebView-based reader matching Tauri mobile MobileReaderView.
 * Features: toolbar with back/notebook/chat/TTS/TOC/search/settings,
 * footer with prev/next + slider + progress, TOC panel, settings panel (font size,
 * line height, paragraph spacing, page margin, font theme, view mode),
 * search bar with debounce + result nav.
 */
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Animated,
  TextInput,
  ScrollView,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { WebView } from "react-native-webview";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { useLibraryStore } from "@/stores/library-store";
import { useAnnotationStore, useReadingSessionStore } from "@readany/core/stores";
import { getPlatformService } from "@readany/core/services";
import type { TOCItem } from "@readany/core/types";
import { type ThemeColors, radius, fontSize, fontWeight, useColors } from "@/styles/theme";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  SearchIcon,
  NotebookPenIcon,
  BookOpenIcon,
  XIcon,
  SortAscIcon,
  Volume2Icon,
  MessageSquareIcon,
  HighlighterIcon,
} from "@/components/ui/Icon";

type Props = NativeStackScreenProps<RootStackParamList, "Reader">;

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const CONTROLS_TIMEOUT = 4000;

const FONT_THEMES = [
  { id: "default", labelKey: "reader.fontThemeDefault", fallback: "默认" },
  { id: "classic", labelKey: "reader.fontThemeClassic", fallback: "经典" },
  { id: "modern", labelKey: "reader.fontThemeModern", fallback: "现代" },
  { id: "elegant", labelKey: "reader.fontThemeElegant", fallback: "优雅" },
  { id: "literary", labelKey: "reader.fontThemeLiterary", fallback: "文学" },
];

// ──────────────────────────── Settings Icon (Gear) ────────────────────────────
import Svg, { Path } from "react-native-svg";

function SettingsIcon({ size = 24, color = "#e8e8ed" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <Path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
    </Svg>
  );
}

function ListIcon({ size = 24, color = "#e8e8ed" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 12h18M3 6h18M3 18h18" />
    </Svg>
  );
}

// ──────────────────────────── TOC Tree Item ────────────────────────────

function TOCTreeItem({
  item,
  level,
  currentChapter,
  onSelect,
}: {
  item: TOCItem;
  level: number;
  currentChapter: string;
  onSelect: (href: string) => void;
}) {
  const colors = useColors();
  const tocS = makeTocStyles(colors);
  const hasChildren = item.subitems && item.subitems.length > 0;
  const isCurrent = item.title === currentChapter;

  const hasCurrentChild = (items: TOCItem[]): boolean => {
    for (const child of items) {
      if (child.title === currentChapter) return true;
      if (child.subitems && hasCurrentChild(child.subitems)) return true;
    }
    return false;
  };

  const shouldExpand = hasChildren && hasCurrentChild(item.subitems!);
  const [expanded, setExpanded] = useState(shouldExpand);

  return (
    <View>
      <TouchableOpacity
        style={[
          tocS.item,
          { paddingLeft: 12 + level * 16 },
          isCurrent && tocS.itemActive,
        ]}
        onPress={() => item.href && onSelect(item.href)}
        activeOpacity={0.7}
      >
        {hasChildren ? (
          <TouchableOpacity
            style={tocS.expandBtn}
            onPress={() => setExpanded(!expanded)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {expanded ? (
              <ChevronDownIcon size={14} color={colors.mutedForeground} />
            ) : (
              <ChevronRightIcon size={14} color={colors.mutedForeground} />
            )}
          </TouchableOpacity>
        ) : (
          <View style={tocS.expandPlaceholder} />
        )}
        <Text
          style={[tocS.itemText, isCurrent && tocS.itemTextActive]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
      </TouchableOpacity>
      {expanded && hasChildren && (
        <View>
          {item.subitems!.map((child) => (
            <TOCTreeItem
              key={child.id || child.href}
              item={child}
              level={level + 1}
              currentChapter={currentChapter}
              onSelect={onSelect}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const makeTocStyles = (colors: ThemeColors) => StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingRight: 12,
    borderRadius: radius.lg,
  },
  itemActive: { backgroundColor: "rgba(99,102,241,0.1)" },
  expandBtn: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  expandPlaceholder: { width: 20 },
  itemText: { fontSize: fontSize.sm, color: colors.foreground, flex: 1 },
  itemTextActive: { color: colors.indigo, fontWeight: fontWeight.medium },
});

// ──────────────────────────── ReaderScreen ────────────────────────────

export function ReaderScreen({ route, navigation }: Props) {
  const colors = useColors();
  const s = makeStyles(colors);
  const { bookId } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotebook, setShowNotebook] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [searchIndex, setSearchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentChapter, setCurrentChapter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [toc, setToc] = useState<TOCItem[]>([]);
  const [bookTitle, setBookTitle] = useState("");

  // Settings matching Tauri MobileReadSettings
  const [settingFontSize, setSettingFontSize] = useState(16);
  const [settingLineHeight, setSettingLineHeight] = useState(1.6);
  const [settingParagraphSpacing, setSettingParagraphSpacing] = useState(8);
  const [settingPageMargin, setSettingPageMargin] = useState(16);
  const [settingFontTheme, setSettingFontTheme] = useState("default");
  const [settingViewMode, setSettingViewMode] = useState<"paginated" | "scroll">("paginated");

  const controlsTimer = useRef<NodeJS.Timeout | null>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const webViewRef = useRef<WebView>(null);
  const toolbarAnim = useRef(new Animated.Value(-80)).current;
  const footerAnim = useRef(new Animated.Value(80)).current;

  const { books, updateBook } = useLibraryStore();
  const { startSession, stopSession } = useReadingSessionStore();

  const book = useMemo(() => books.find((b) => b.id === bookId), [books, bookId]);

  // Load book
  useEffect(() => {
    if (!book) {
      setError(t("reader.bookNotFound", "书籍未找到"));
      setLoading(false);
      return;
    }
    setBookTitle(book.meta.title);
    try {
      updateBook(bookId, { lastOpenedAt: Date.now() });
      startSession(bookId);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to load book");
      setLoading(false);
    }
    return () => {
      stopSession();
    };
  }, [book, bookId, updateBook, startSession, stopSession, t]);

  // Controls toggle
  const toggleControls = useCallback(() => {
    const willShow = !showControls;
    setShowControls(willShow);
    Animated.parallel([
      Animated.spring(toolbarAnim, {
        toValue: willShow ? 0 : -80,
        useNativeDriver: true,
        friction: 20,
        tension: 100,
      }),
      Animated.spring(footerAnim, {
        toValue: willShow ? 0 : 80,
        useNativeDriver: true,
        friction: 20,
        tension: 100,
      }),
    ]).start();

    if (willShow) {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      controlsTimer.current = setTimeout(() => {
        setShowControls(false);
        Animated.parallel([
          Animated.spring(toolbarAnim, { toValue: -80, useNativeDriver: true, friction: 20, tension: 100 }),
          Animated.spring(footerAnim, { toValue: 80, useNativeDriver: true, friction: 20, tension: 100 }),
        ]).start();
      }, CONTROLS_TIMEOUT);
    }
  }, [showControls, toolbarAnim, footerAnim]);

  // WebView message handler
  const handleMessage = useCallback(
    (event: any) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        switch (msg.type) {
          case "progress":
            setProgress(msg.value || 0);
            setCurrentPage(msg.currentPage || 1);
            setTotalPages(msg.totalPages || 1);
            if (msg.chapter) setCurrentChapter(msg.chapter);
            break;
          case "toc":
            setToc(msg.items || []);
            break;
          case "loaded":
            setLoading(false);
            break;
          case "tap":
            toggleControls();
            break;
          case "searchResult":
            setSearchResultCount(msg.count || 0);
            setIsSearching(false);
            break;
          case "error":
            setError(msg.message);
            break;
        }
      } catch {
        // ignore
      }
    },
    [toggleControls],
  );

  const goToTocItem = useCallback((href: string) => {
    webViewRef.current?.injectJavaScript(`window.goToHref && window.goToHref("${href}"); true;`);
    setShowTOC(false);
  }, []);

  const handleSearchInput = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        const trimmed = query.trim();
        if (trimmed) {
          setIsSearching(true);
          webViewRef.current?.injectJavaScript(
            `window.search && window.search("${trimmed.replace(/"/g, '\\"')}"); true;`,
          );
        } else {
          setSearchResultCount(0);
          setSearchIndex(0);
        }
      }, 300);
    },
    [],
  );

  const navigateSearch = useCallback(
    (direction: "prev" | "next") => {
      if (searchResultCount === 0) return;
      const newIdx =
        direction === "next"
          ? (searchIndex + 1) % searchResultCount
          : (searchIndex - 1 + searchResultCount) % searchResultCount;
      setSearchIndex(newIdx);
      webViewRef.current?.injectJavaScript(
        `window.navigateSearch && window.navigateSearch(${newIdx}); true;`,
      );
    },
    [searchIndex, searchResultCount],
  );

  const goToPrev = useCallback(() => {
    webViewRef.current?.injectJavaScript("window.goPrev && window.goPrev(); true;");
  }, []);

  const goToNext = useCallback(() => {
    webViewRef.current?.injectJavaScript("window.goNext && window.goNext(); true;");
  }, []);

  const handleSliderChange = useCallback((value: number) => {
    setProgress(value);
    webViewRef.current?.injectJavaScript(
      `window.goToProgress && window.goToProgress(${value}); true;`,
    );
  }, []);

  // Settings updates
  const updateSetting = useCallback(
    (key: string, value: number | string) => {
      switch (key) {
        case "fontSize":
          setSettingFontSize(value as number);
          webViewRef.current?.injectJavaScript(`window.setFontSize && window.setFontSize(${value}); true;`);
          break;
        case "lineHeight":
          setSettingLineHeight(value as number);
          webViewRef.current?.injectJavaScript(`window.setLineHeight && window.setLineHeight(${value}); true;`);
          break;
        case "paragraphSpacing":
          setSettingParagraphSpacing(value as number);
          webViewRef.current?.injectJavaScript(`window.setParagraphSpacing && window.setParagraphSpacing(${value}); true;`);
          break;
        case "pageMargin":
          setSettingPageMargin(value as number);
          webViewRef.current?.injectJavaScript(`window.setPageMargin && window.setPageMargin(${value}); true;`);
          break;
        case "fontTheme":
          setSettingFontTheme(value as string);
          webViewRef.current?.injectJavaScript(`window.setFontTheme && window.setFontTheme("${value}"); true;`);
          break;
        case "viewMode":
          setSettingViewMode(value as "paginated" | "scroll");
          webViewRef.current?.injectJavaScript(`window.setViewMode && window.setViewMode("${value}"); true;`);
          break;
      }
    },
    [],
  );

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]}>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.indigo} />
          <Text style={s.loadingText}>{t("reader.loading", "正在加载...")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]}>
        <View style={s.loadingWrap}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()}>
            <Text style={s.backButtonText}>{t("common.back", "返回")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const readerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-size: ${settingFontSize}px;
          line-height: ${settingLineHeight};
          color: ${colors.foreground};
          background: ${colors.background};
          padding: ${settingPageMargin}px;
          font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          -webkit-user-select: text;
          user-select: text;
        }
        p { margin-bottom: ${settingParagraphSpacing}px; }
        .placeholder {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: 80vh; text-align: center; color: ${colors.mutedForeground};
        }
        .placeholder h2 { font-size: 18px; margin-bottom: 8px; color: ${colors.foreground}; }
        .placeholder p { font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="placeholder">
        <h2>${book?.meta.title || "Book"}</h2>
        <p>The foliate-js reader engine will render the book content here.</p>
        <p style="margin-top: 12px; font-size: 12px; opacity: 0.6;">
          Book format: ${book?.format || "unknown"}<br/>
          File: ${book?.filePath || "N/A"}
        </p>
      </div>
      <script>
        document.addEventListener('click', function(e) {
          var x = e.clientX / window.innerWidth;
          if (x > 0.25 && x < 0.75) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tap' }));
          }
        });
        window.goToHref = function(href) {};
        window.search = function(query) {};
        window.navigateSearch = function(idx) {};
        window.goPrev = function() {};
        window.goNext = function() {};
        window.goToProgress = function(p) {};
        window.setFontSize = function(s) { document.body.style.fontSize = s + 'px'; };
        window.setLineHeight = function(lh) { document.body.style.lineHeight = lh; };
        window.setParagraphSpacing = function(s) {
          var style = document.querySelector('#ps-style') || document.createElement('style');
          style.id = 'ps-style';
          style.textContent = 'p { margin-bottom: ' + s + 'px; }';
          document.head.appendChild(style);
        };
        window.setPageMargin = function(m) { document.body.style.padding = m + 'px'; };
        window.setFontTheme = function(theme) {};
        window.setViewMode = function(mode) {};
      </script>
    </body>
    </html>
  `;

  const percent = Math.round(progress * 100);

  return (
    <View style={s.container}>
      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ html: readerHtml }}
        style={s.webview}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        scrollEnabled
        showsVerticalScrollIndicator={false}
      />

      {/* ─── Toolbar (gradient bg, slide in/out) ─── */}
      <Animated.View
        style={[s.toolbar, { paddingTop: insets.top, transform: [{ translateY: toolbarAnim }] }]}
      >
        <View style={s.toolbarRow}>
          {/* Back */}
          <TouchableOpacity style={s.toolbarBtn} onPress={() => navigation.goBack()}>
            <ChevronLeftIcon size={20} color="#fff" />
          </TouchableOpacity>

          {/* Title */}
          <View style={s.toolbarCenter}>
            <Text style={s.toolbarTitle} numberOfLines={1}>{bookTitle}</Text>
            {currentChapter ? (
              <Text style={s.toolbarChapter} numberOfLines={1}>{currentChapter}</Text>
            ) : null}
          </View>

          {/* Notebook */}
          <TouchableOpacity style={s.toolbarBtn} onPress={() => setShowNotebook(true)}>
            <NotebookPenIcon size={18} color="#fff" />
          </TouchableOpacity>

          {/* AI Chat placeholder */}
          <TouchableOpacity style={s.toolbarBtn} onPress={() => {}}>
            <MessageSquareIcon size={18} color="#fff" />
          </TouchableOpacity>

          {/* TTS placeholder */}
          <TouchableOpacity style={s.toolbarBtn} onPress={() => {}}>
            <Volume2Icon size={18} color="#fff" />
          </TouchableOpacity>

          {/* TOC */}
          <TouchableOpacity style={s.toolbarBtn} onPress={() => setShowTOC(true)}>
            <ListIcon size={18} color="#fff" />
          </TouchableOpacity>

          {/* Search */}
          <TouchableOpacity style={s.toolbarBtn} onPress={() => setShowSearch(true)}>
            <SearchIcon size={18} color="#fff" />
          </TouchableOpacity>

          {/* Settings */}
          <TouchableOpacity style={s.toolbarBtn} onPress={() => setShowSettings(true)}>
            <SettingsIcon size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ─── Footer (gradient bg, slider + nav) ─── */}
      <Animated.View
        style={[s.footer, { paddingBottom: insets.bottom || 8, transform: [{ translateY: footerAnim }] }]}
      >
        {/* Page info */}
        <View style={s.footerPageRow}>
          <Text style={s.footerPageText}>
            {currentPage > 0 && totalPages > 0 ? `${currentPage} / ${totalPages}` : ""}
          </Text>
          <Text style={s.footerPageText}>{percent}%</Text>
        </View>
        {/* Slider + nav */}
        <View style={s.footerSliderRow}>
          <TouchableOpacity style={s.footerNavBtn} onPress={goToPrev}>
            <ChevronLeftIcon size={20} color="#fff" />
          </TouchableOpacity>
          <View style={s.sliderWrap}>
            <View style={s.sliderTrack}>
              <View style={[s.sliderFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          </View>
          <TouchableOpacity style={s.footerNavBtn} onPress={goToNext}>
            <ChevronRightIcon size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ─── Search Bar (top overlay) ─── */}
      {showSearch && (
        <View style={[s.searchBarWrap, { paddingTop: insets.top }]}>
          <View style={s.searchBarRow}>
            <View style={s.searchInputWrap}>
              <SearchIcon size={16} color={colors.mutedForeground} />
              <TextInput
                style={s.searchInput}
                placeholder={t("reader.searchInBook", "在书中搜索")}
                placeholderTextColor={colors.mutedForeground}
                value={searchQuery}
                onChangeText={handleSearchInput}
                autoFocus
                returnKeyType="search"
              />
            </View>
            <View style={s.searchMetaRow}>
              {isSearching ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : searchQuery && searchResultCount > 0 ? (
                <Text style={s.searchCount}>
                  {searchIndex + 1} / {searchResultCount}
                </Text>
              ) : searchQuery && !isSearching ? (
                <Text style={s.searchCount}>0</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={s.searchNavBtn}
              onPress={() => navigateSearch("prev")}
              disabled={searchResultCount === 0}
            >
              <ChevronLeftIcon size={16} color={searchResultCount > 0 ? colors.foreground : colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.searchNavBtn}
              onPress={() => navigateSearch("next")}
              disabled={searchResultCount === 0}
            >
              <ChevronRightIcon size={16} color={searchResultCount > 0 ? colors.foreground : colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.searchNavBtn}
              onPress={() => {
                setShowSearch(false);
                setSearchQuery("");
                setSearchResultCount(0);
                setSearchIndex(0);
              }}
            >
              <XIcon size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ─── TOC Panel ─── */}
      <Modal visible={showTOC} transparent animationType="slide" onRequestClose={() => setShowTOC(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setShowTOC(false)} />
        <View style={[s.bottomSheet, { maxHeight: SCREEN_HEIGHT * 0.7, paddingBottom: insets.bottom || 16 }]}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{t("reader.toc", "目录")}</Text>
            <TouchableOpacity onPress={() => setShowTOC(false)}>
              <XIcon size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={s.sheetScroll}>
            {toc.length > 0 ? (
              toc.map((item) => (
                <TOCTreeItem
                  key={item.id || item.href}
                  item={item}
                  level={0}
                  currentChapter={currentChapter}
                  onSelect={goToTocItem}
                />
              ))
            ) : (
              <Text style={s.sheetEmpty}>{t("reader.noToc", "暂无目录信息")}</Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ─── Settings Panel (matching Tauri MobileReadSettings) ─── */}
      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setShowSettings(false)} />
        <View style={[s.bottomSheet, { paddingBottom: insets.bottom || 16 }]}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{t("reader.settings", "阅读设置")}</Text>
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <XIcon size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Font Size */}
            <View style={s.settingRow}>
              <Text style={s.settingLabel}>{t("reader.fontSize", "字号")}</Text>
              <View style={s.settingControl}>
                <TouchableOpacity
                  style={s.stepBtn}
                  onPress={() => updateSetting("fontSize", Math.max(12, settingFontSize - 1))}
                >
                  <Text style={s.stepBtnText}>A-</Text>
                </TouchableOpacity>
                <Text style={s.settingValue}>{settingFontSize}</Text>
                <TouchableOpacity
                  style={s.stepBtn}
                  onPress={() => updateSetting("fontSize", Math.min(32, settingFontSize + 1))}
                >
                  <Text style={s.stepBtnText}>A+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Line Height */}
            <View style={s.settingRow}>
              <Text style={s.settingLabel}>{t("reader.lineHeight", "行高")}</Text>
              <View style={s.settingControl}>
                <TouchableOpacity
                  style={s.stepBtn}
                  onPress={() =>
                    updateSetting("lineHeight", Math.round(Math.max(1.2, settingLineHeight - 0.1) * 10) / 10)
                  }
                >
                  <Text style={s.stepBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={s.settingValue}>{settingLineHeight.toFixed(1)}</Text>
                <TouchableOpacity
                  style={s.stepBtn}
                  onPress={() =>
                    updateSetting("lineHeight", Math.round(Math.min(2.5, settingLineHeight + 0.1) * 10) / 10)
                  }
                >
                  <Text style={s.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Paragraph Spacing */}
            <View style={s.settingRow}>
              <Text style={s.settingLabel}>{t("reader.paragraphSpacing", "段间距")}</Text>
              <View style={s.settingControl}>
                <TouchableOpacity
                  style={s.stepBtn}
                  onPress={() =>
                    updateSetting("paragraphSpacing", Math.max(0, settingParagraphSpacing - 2))
                  }
                >
                  <Text style={s.stepBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={s.settingValue}>{settingParagraphSpacing}</Text>
                <TouchableOpacity
                  style={s.stepBtn}
                  onPress={() =>
                    updateSetting("paragraphSpacing", Math.min(24, settingParagraphSpacing + 2))
                  }
                >
                  <Text style={s.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Page Margin */}
            <View style={s.settingRow}>
              <Text style={s.settingLabel}>{t("reader.pageMargin", "页边距")}</Text>
              <View style={s.settingControl}>
                <TouchableOpacity
                  style={s.stepBtn}
                  onPress={() =>
                    updateSetting("pageMargin", Math.max(0, settingPageMargin - 4))
                  }
                >
                  <Text style={s.stepBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={s.settingValue}>{settingPageMargin}</Text>
                <TouchableOpacity
                  style={s.stepBtn}
                  onPress={() =>
                    updateSetting("pageMargin", Math.min(48, settingPageMargin + 4))
                  }
                >
                  <Text style={s.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Font Theme */}
            <View style={s.settingRow}>
              <Text style={s.settingLabel}>{t("reader.fontTheme", "字体主题")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.themeScroll}>
                <View style={s.themeRow}>
                  {FONT_THEMES.map((theme) => (
                    <TouchableOpacity
                      key={theme.id}
                      style={[
                        s.themeBtn,
                        settingFontTheme === theme.id && s.themeBtnActive,
                      ]}
                      onPress={() => updateSetting("fontTheme", theme.id)}
                    >
                      <Text
                        style={[
                          s.themeBtnText,
                          settingFontTheme === theme.id && s.themeBtnTextActive,
                        ]}
                      >
                        {t(theme.labelKey, theme.fallback)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* View Mode */}
            <View style={s.settingRow}>
              <Text style={s.settingLabel}>{t("reader.viewMode", "阅读模式")}</Text>
              <View style={s.viewModeRow}>
                <TouchableOpacity
                  style={[
                    s.viewModeBtn,
                    settingViewMode === "paginated" && s.viewModeBtnActive,
                  ]}
                  onPress={() => updateSetting("viewMode", "paginated")}
                >
                  <Text
                    style={[
                      s.viewModeBtnText,
                      settingViewMode === "paginated" && s.viewModeBtnTextActive,
                    ]}
                  >
                    {t("reader.paginated", "翻页")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.viewModeBtn,
                    settingViewMode === "scroll" && s.viewModeBtnActive,
                  ]}
                  onPress={() => updateSetting("viewMode", "scroll")}
                >
                  <Text
                    style={[
                      s.viewModeBtnText,
                      settingViewMode === "scroll" && s.viewModeBtnTextActive,
                    ]}
                  >
                    {t("reader.scrollMode", "滚动")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ─── Notebook Panel Placeholder ─── */}
      <Modal visible={showNotebook} transparent animationType="slide" onRequestClose={() => setShowNotebook(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setShowNotebook(false)} />
        <View style={[s.bottomSheet, { maxHeight: SCREEN_HEIGHT * 0.7, paddingBottom: insets.bottom || 16 }]}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{t("reader.notebook", "笔记本")}</Text>
            <TouchableOpacity onPress={() => setShowNotebook(false)}>
              <XIcon size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={s.notebookPlaceholder}>
            <NotebookPenIcon size={40} color={colors.mutedForeground} />
            <Text style={s.notebookPlaceholderText}>
              {t("reader.notebookHint", "在阅读时选中文字来创建笔记和高亮")}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  webview: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: fontSize.sm, color: colors.mutedForeground },
  errorText: { fontSize: fontSize.base, color: colors.destructive, textAlign: "center", paddingHorizontal: 24 },
  backButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: radius.lg, backgroundColor: colors.primary },
  backButtonText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.primaryForeground },

  // Toolbar — gradient-like dark bg
  toolbar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingBottom: 8,
    zIndex: 30,
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  toolbarBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarCenter: { flex: 1, paddingHorizontal: 4 },
  toolbarTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: "#fff" },
  toolbarChapter: { fontSize: fontSize.xs, color: "rgba(255,255,255,0.7)" },

  // Footer — gradient-like dark bg
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingTop: 8,
    paddingHorizontal: 16,
    zIndex: 30,
  },
  footerPageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  footerPageText: { fontSize: fontSize.xs, color: "rgba(255,255,255,0.7)" },
  footerSliderRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerNavBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  sliderWrap: { flex: 1, justifyContent: "center", paddingVertical: 8 },
  sliderTrack: { height: 4, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 2, overflow: "hidden" },
  sliderFill: { height: "100%", backgroundColor: "#fff", borderRadius: 2 },

  // Search bar overlay
  searchBarWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    zIndex: 40,
  },
  searchBarRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  searchInput: { flex: 1, fontSize: fontSize.sm, color: colors.foreground, padding: 0 },
  searchMetaRow: { flexDirection: "row", alignItems: "center" },
  searchCount: { fontSize: fontSize.xs, color: colors.mutedForeground },
  searchNavBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  bottomSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground },
  sheetScroll: { maxHeight: SCREEN_HEIGHT * 0.5 },
  sheetEmpty: {
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    textAlign: "center",
    paddingVertical: 32,
  },

  // Settings
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  settingLabel: { fontSize: fontSize.sm, color: colors.mutedForeground },
  settingControl: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.foreground },
  settingValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.foreground,
    minWidth: 32,
    textAlign: "center",
  },
  themeScroll: { maxWidth: 220 },
  themeRow: { flexDirection: "row", gap: 6 },
  themeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  themeBtnActive: { backgroundColor: colors.primary },
  themeBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: colors.mutedForeground },
  themeBtnTextActive: { color: colors.primaryForeground },
  viewModeRow: { flexDirection: "row", gap: 8 },
  viewModeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  viewModeBtnActive: { backgroundColor: colors.primary },
  viewModeBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: colors.mutedForeground },
  viewModeBtnTextActive: { color: colors.primaryForeground },

  // Notebook placeholder
  notebookPlaceholder: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 12 },
  notebookPlaceholderText: { fontSize: fontSize.sm, color: colors.mutedForeground, textAlign: "center", paddingHorizontal: 32 },
});
