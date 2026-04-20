/**
 * BookInfoScreen — Mobile book info page
 *
 * Compact Hero (cover+info+CTA) + 3 Tabs (概览/统计/笔记)
 * Global edit mode toggle in header.
 */
import { useColors, spacing, radius, fontSize, fontWeight, withOpacity } from "@/styles/theme";
import type { Book, ReadingStatus } from "@readany/core/types";
import { useLibraryStore } from "@/stores/library-store";
import { getPlatformService } from "@readany/core/services";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import {
  View, Text, Pressable, StyleSheet, Animated, Modal, TextInput,
  ActionSheetIOS, Platform, Alert, KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Check, MoreHorizontal, Pencil } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { BookInfoHero } from "./book-info/BookInfoHero";
import { BookInfoActionBar } from "./book-info/BookInfoActionBar";
import { BookInfoOverviewTab } from "./book-info/BookInfoOverviewTab";
import { BookInfoStatsTab } from "./book-info/BookInfoStatsTab";
import { BookInfoNotes } from "./book-info/BookInfoNotes";

type Props = NativeStackScreenProps<RootStackParamList, "BookInfo">;

export default function BookInfoScreen({ navigation, route }: Props) {
  const { bookId } = route.params;
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const books = useLibraryStore((s) => s.books);
  const updateBook = useLibraryStore((s) => s.updateBook);
  const book = books.find((b) => b.id === bookId);

  const [activeTab, setActiveTab] = useState<"overview" | "stats" | "notes">("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [resolvedCoverUrl, setResolvedCoverUrl] = useState<string | undefined>(undefined);
  const [showMetaSheet, setShowMetaSheet] = useState(false);
  const [showReviewSheet, setShowReviewSheet] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Resolve cover
  useEffect(() => {
    const raw = book?.meta.coverUrl;
    if (!raw) { setResolvedCoverUrl(undefined); return; }
    if (raw.startsWith("http") || raw.startsWith("blob") || raw.startsWith("file")) {
      setResolvedCoverUrl(raw); return;
    }
    (async () => {
      try {
        const p = getPlatformService();
        setResolvedCoverUrl(await p.joinPath(await p.getAppDataDir(), raw));
      } catch { setResolvedCoverUrl(undefined); }
    })();
  }, [book?.meta.coverUrl]);

  if (!book) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, textAlign: "center", marginTop: 100 }}>Book not found</Text>
      </View>
    );
  }

  // ─── Handlers ───
  const handleOpenBook = () => navigation.navigate("Reader", { bookId: book.id });
  const handleStatusChange = (s: ReadingStatus) => updateBook(book.id, { readingStatus: s });
  const handleRatingChange = (r: number | undefined) => updateBook(book.id, { rating: r } as Partial<Book>);

  const handleCoverReplace = () => {
    const pickGallery = async () => {
      try {
        const IP = await import("expo-image-picker");
        const { status } = await IP.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") { Alert.alert(t("bookInfo.coverChangeFailed"), "Permission denied"); return; }
        const r = await IP.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [2, 3], quality: 0.9 });
        if (r.canceled || !r.assets?.[0]) return;
        await saveCover(r.assets[0].uri);
      } catch (e) { console.error(e); }
    };
    const pickFile = async () => {
      try {
        const p = getPlatformService();
        const picked = await p.pickFile({ filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }] });
        if (!picked || Array.isArray(picked)) return;
        await saveCover(picked);
      } catch (e) { console.error(e); }
    };
    const saveCover = async (uri: string) => {
      const p = getPlatformService();
      const appData = await p.getAppDataDir();
      const ext = uri.toLowerCase().includes(".png") ? "png" : "jpg";
      const rel = `covers/${book.id}.${ext}`;
      const dest = await p.joinPath(appData, rel);
      try { await p.mkdir(await p.joinPath(appData, "covers")); } catch {}
      await p.writeFile(dest, await p.readFile(uri));
      updateBook(book.id, { meta: { ...book.meta, coverUrl: rel } } as Partial<Book>);
      setResolvedCoverUrl(dest);
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [t("common.cancel"), t("bookInfo.selectFromGallery"), t("bookInfo.selectFromFile")], cancelButtonIndex: 0 },
        (i) => { if (i === 1) pickGallery(); if (i === 2) pickFile(); },
      );
    } else {
      Alert.alert(t("bookInfo.changeCover"), undefined, [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("bookInfo.selectFromGallery"), onPress: pickGallery },
        { text: t("bookInfo.selectFromFile"), onPress: pickFile },
      ]);
    }
  };

  // Header animations
  const headerBg = scrollY.interpolate({ inputRange: [0, 120], outputRange: ["transparent", colors.background], extrapolate: "clamp" });
  const headerBorder = scrollY.interpolate({ inputRange: [110, 140], outputRange: [0, 0.5], extrapolate: "clamp" });
  const headerTitleOp = scrollY.interpolate({ inputRange: [140, 200], outputRange: [0, 1], extrapolate: "clamp" });

  const TABS = [
    { key: "overview" as const, label: t("bookInfo.tabOverview") },
    { key: "stats" as const, label: t("bookInfo.tabReading") },
    { key: "notes" as const, label: t("bookInfo.tabNotes") },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ─── Header ─── */}
      <Animated.View style={[styles.header, { paddingTop: insets.top, backgroundColor: headerBg, borderBottomWidth: headerBorder, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={[styles.hBtn, { backgroundColor: withOpacity(colors.background, 0.7) }]} hitSlop={12}>
          <ArrowLeft size={20} color={colors.foreground} />
        </Pressable>
        <Animated.Text numberOfLines={1} style={[styles.hTitle, { color: colors.foreground, opacity: headerTitleOp }]}>
          {book.meta.title}
        </Animated.Text>
        <Pressable
          onPress={() => setIsEditing(!isEditing)}
          style={[styles.hBtn, { backgroundColor: isEditing ? withOpacity(colors.primary, 0.15) : withOpacity(colors.background, 0.7) }]}
          hitSlop={12}
        >
          {isEditing ? <Check size={18} color={colors.primary} /> : <Pencil size={16} color={colors.foreground} />}
        </Pressable>
        <Pressable style={[styles.hBtn, { backgroundColor: withOpacity(colors.background, 0.7) }]} hitSlop={12}>
          <MoreHorizontal size={20} color={colors.foreground} />
        </Pressable>
      </Animated.View>

      {/* ─── Scroll Content ─── */}
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={8}
        contentContainerStyle={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: identity + CTA */}
        <BookInfoHero
          book={book} resolvedCoverUrl={resolvedCoverUrl} isEditing={isEditing}
          onCoverPress={handleCoverReplace} onTitlePress={() => setShowMetaSheet(true)}
          onStatusChange={handleStatusChange} onRatingChange={handleRatingChange}
        />
        <View style={{ height: spacing.md }} />
        <BookInfoActionBar book={book} onOpenBook={handleOpenBook} />

        {/* Tab Bar */}
        <View style={[styles.tabBar, { borderBottomColor: withOpacity(colors.border, 0.5), marginTop: spacing.xl }]}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={styles.tab}>
                <Text style={[styles.tabLabel, { color: active ? colors.foreground : colors.mutedForeground, fontWeight: active ? "600" : "400" }]}>
                  {tab.label}
                </Text>
                {active && <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} />}
              </Pressable>
            );
          })}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === "overview" && (
            <BookInfoOverviewTab
              book={book}
              isEditing={isEditing}
              onReviewPress={() => setShowReviewSheet(true)}
            />
          )}
          {activeTab === "stats" && <BookInfoStatsTab book={book} />}
          {activeTab === "notes" && <BookInfoNotes book={book} />}
        </View>
      </Animated.ScrollView>

      {/* ─── Sheets ─── */}
      <EditMetaSheet
        visible={showMetaSheet} book={book}
        onClose={() => setShowMetaSheet(false)}
        onSave={(title, author) => { updateBook(book.id, { meta: { ...book.meta, title, author } } as Partial<Book>); setShowMetaSheet(false); }}
      />
      <EditReviewSheet
        visible={showReviewSheet} currentReview={book.shortReview}
        onClose={() => setShowReviewSheet(false)}
        onSave={(review) => { updateBook(book.id, { shortReview: review || undefined } as Partial<Book>); setShowReviewSheet(false); }}
      />
    </View>
  );
}

/* ═══ Edit Meta Sheet ═══ */
function EditMetaSheet({ visible, book, onClose, onSave }: { visible: boolean; book: Book; onClose: () => void; onSave: (t: string, a: string) => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(book.meta.title);
  const [author, setAuthor] = useState(book.meta.author);
  useEffect(() => { if (visible) { setTitle(book.meta.title); setAuthor(book.meta.author); } }, [visible]);
  const s = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) + 12 },
    handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 999, backgroundColor: withOpacity(colors.border, 0.9), marginBottom: 20 },
    label: { fontSize: 11, fontWeight: "500", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
    input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: withOpacity(colors.border, 0.8), paddingHorizontal: 14, fontSize: fontSize.base, color: colors.foreground, backgroundColor: colors.card, marginBottom: 16 },
    row: { flexDirection: "row", gap: 12, marginTop: 8 },
    save: { flex: 1, height: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    cancel: { flex: 1, height: 48, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: withOpacity(colors.border, 0.8), alignItems: "center", justifyContent: "center" },
  }), [colors, insets.bottom]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={s.overlay} onPress={onClose}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />
            <Text style={s.label}>{t("bookInfo.editTitle")}</Text>
            <TextInput style={s.input} value={title} onChangeText={setTitle} autoFocus returnKeyType="next" />
            <Text style={s.label}>{t("bookInfo.editAuthor")}</Text>
            <TextInput style={s.input} value={author} onChangeText={setAuthor} returnKeyType="done" onSubmitEditing={() => title.trim() && onSave(title.trim(), author.trim())} />
            <View style={s.row}>
              <Pressable style={s.save} onPress={() => title.trim() && onSave(title.trim(), author.trim())}>
                <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.primaryForeground }}>{t("common.save")}</Text>
              </Pressable>
              <Pressable style={s.cancel} onPress={onClose}>
                <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.foreground }}>{t("common.cancel")}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ═══ Edit Review Sheet ═══ */
function EditReviewSheet({ visible, currentReview, onClose, onSave }: { visible: boolean; currentReview?: string; onClose: () => void; onSave: (r: string) => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(currentReview ?? "");
  useEffect(() => { if (visible) setText(currentReview ?? ""); }, [visible]);
  const s = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) + 12 },
    handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 999, backgroundColor: withOpacity(colors.border, 0.9), marginBottom: 20 },
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.foreground, marginBottom: 16 },
    input: { minHeight: 100, borderRadius: 12, borderWidth: 1, borderColor: withOpacity(colors.border, 0.8), paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontSize: fontSize.base, color: colors.foreground, backgroundColor: colors.card, textAlignVertical: "top" },
    count: { fontSize: 10, color: colors.mutedForeground, textAlign: "right", marginTop: 6 },
    row: { flexDirection: "row", gap: 12, marginTop: 16 },
    save: { flex: 1, height: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    cancel: { flex: 1, height: 48, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: withOpacity(colors.border, 0.8), alignItems: "center", justifyContent: "center" },
  }), [colors, insets.bottom]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={s.overlay} onPress={onClose}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />
            <Text style={s.title}>{t("bookInfo.shortReview")}</Text>
            <TextInput style={s.input} value={text} onChangeText={(v) => setText(v.slice(0, 200))} multiline maxLength={200} autoFocus placeholder={t("bookInfo.shortReviewPlaceholder")} placeholderTextColor={withOpacity(colors.mutedForeground, 0.4)} />
            <Text style={s.count}>{text.length}/200</Text>
            <View style={s.row}>
              <Pressable style={s.save} onPress={() => onSave(text.trim())}>
                <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.primaryForeground }}>{t("common.save")}</Text>
              </Pressable>
              <Pressable style={s.cancel} onPress={onClose}>
                <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.foreground }}>{t("common.cancel")}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─── Styles ─── */
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs,
  },
  hBtn: { width: 36, height: 36, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  hTitle: { flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.semibold, textAlign: "center" },
  tabBar: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, marginHorizontal: spacing.lg },
  tab: { flex: 1, alignItems: "center", paddingVertical: spacing.md, position: "relative" },
  tabLabel: { fontSize: fontSize.sm },
  tabIndicator: { position: "absolute", bottom: -0.5, left: "20%", right: "20%", height: 2, borderRadius: 1 },
  tabContent: { padding: spacing.lg },
});
