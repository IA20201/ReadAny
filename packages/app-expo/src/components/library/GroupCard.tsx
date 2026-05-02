import { FolderIcon } from "@/components/ui/Icon";
import { type ThemeColors, fontSize, fontWeight, radius, useColors } from "@/styles/theme";
import { getPlatformService } from "@readany/core/services";
import type { Book, BookGroup } from "@readany/core/types";
import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface GroupCardProps {
  group: BookGroup;
  books: Book[];
  cardWidth: number;
  onOpen: (groupId: string) => void;
  onLongPress?: (group: BookGroup) => void;
}

function GroupCoverLayer({
  book,
  index,
  total,
  colors,
}: {
  book: Book;
  index: number;
  total: number;
  colors: ThemeColors;
}) {
  const [uri, setUri] = useState<string | undefined>();
  const [error, setError] = useState(false);

  useEffect(() => {
    const raw = book.meta.coverUrl;
    setError(false);
    if (!raw) {
      setUri(undefined);
      return;
    }
    if (raw.startsWith("http") || raw.startsWith("blob") || raw.startsWith("file")) {
      setUri(raw);
      return;
    }
    (async () => {
      try {
        const platform = getPlatformService();
        const appData = await platform.getAppDataDir();
        setUri(await platform.joinPath(appData, raw));
      } catch {
        setUri(undefined);
      }
    })();
  }, [book.meta.coverUrl]);

  // Covers overlap to fill the entire card
  const allConfigs = {
    1: [{ right: 1, bottom: 1, zIndex: 30, opacity: 1, width: "94%" as const }],
    2: [
      { right: 0, bottom: 0, zIndex: 10, opacity: 0.78, width: "88%" as const },
      { right: 12, bottom: 8, zIndex: 20, opacity: 1, width: "88%" as const },
    ],
    3: [
      { right: 0, bottom: 0, zIndex: 10, opacity: 0.62, width: "82%" as const },
      { right: 10, bottom: 6, zIndex: 20, opacity: 0.8, width: "82%" as const },
      { right: 20, bottom: 12, zIndex: 30, opacity: 1, width: "82%" as const },
    ],
    4: [
      { right: 0, bottom: 0, zIndex: 10, opacity: 0.5, width: "76%" as const },
      { right: 8, bottom: 5, zIndex: 20, opacity: 0.65, width: "76%" as const },
      { right: 16, bottom: 10, zIndex: 30, opacity: 0.82, width: "76%" as const },
      { right: 24, bottom: 15, zIndex: 40, opacity: 1, width: "76%" as const },
    ],
  };
  const configs = allConfigs[total as keyof typeof allConfigs] ?? allConfigs[4];
  const offset = configs[index] ?? configs[0];
  const style = {
    right: offset.right,
    bottom: offset.bottom,
    zIndex: offset.zIndex,
    opacity: offset.opacity,
    width: offset.width,
    aspectRatio: 28 / 41,
  };

  return (
    <View
      style={[
        styles.coverLayer,
        {
          ...style,
          backgroundColor: colors.muted,
        },
      ]}
    >
      {uri && !error ? (
        <Image
          source={{ uri }}
          style={styles.coverImage}
          resizeMode="cover"
          onError={() => setError(true)}
        />
      ) : (
        <View style={styles.fallbackCover}>
          <Text style={[styles.fallbackTitle, { color: colors.mutedForeground }]} numberOfLines={3}>
            {book.meta.title}
          </Text>
        </View>
      )}
    </View>
  );
}

export const GroupCard = memo(function GroupCard({
  group,
  books,
  cardWidth,
  onOpen,
  onLongPress,
}: GroupCardProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const previewBooks = useMemo(
    () =>
      [...books]
        .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
        .slice(0, 4)
        .reverse(),
    [books],
  );
  const coverHeight = Math.round((cardWidth * 41) / 28);

  return (
    <TouchableOpacity
      style={{ width: cardWidth }}
      activeOpacity={0.76}
      onPress={() => onOpen(group.id)}
      onLongPress={() => onLongPress?.(group)}
      delayLongPress={450}
    >
      <View style={[styles.stackWrap, { height: coverHeight, backgroundColor: colors.muted }]}>
        {previewBooks.length > 0 ? (
          previewBooks.map((book, index) => (
            <GroupCoverLayer
              key={book.id}
              book={book}
              index={index}
              total={previewBooks.length}
              colors={colors}
            />
          ))
        ) : (
          <View style={styles.emptyIcon}>
            <FolderIcon size={40} color={colors.mutedForeground} />
          </View>
        )}
      </View>
      <View style={styles.infoWrap}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]} numberOfLines={1}>
          {t("library.groupBookCount", { count: books.length, defaultValue: `${books.length} 本` })}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  stackWrap: {
    width: "100%",
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  coverLayer: {
    position: "absolute",
    borderRadius: radius.sm,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 1, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  fallbackCover: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  fallbackTitle: {
    textAlign: "center",
    fontSize: 11,
    lineHeight: 15,
  },
  emptyIcon: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.45,
  },
  infoWrap: {
    paddingTop: 8,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  count: {
    marginTop: 2,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});
