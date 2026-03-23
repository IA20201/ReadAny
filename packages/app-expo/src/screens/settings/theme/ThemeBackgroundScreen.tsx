/**
 * ThemeBackgroundScreen — pick background images + overlay opacity sliders.
 *
 * Two image sections: App background & Reader background.
 * Uses expo-image-picker for selection and expo-image-manipulator for compression.
 */
import { useRoute } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeStore } from "@readany/core/stores";
import { getDataURISize } from "@readany/core/theme/background-image";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { SettingsHeader } from "@/screens/settings/SettingsHeader";
import { useColors } from "@/styles/theme";
import { fontSize, fontWeight, radius, spacing } from "@/styles/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ThemeBackground">;
type ImageKey = "backgroundImage" | "readerBackgroundImage";

export function ThemeBackgroundScreen() {
  const route = useRoute<Props["route"]>();
  const { t } = useTranslation();
  const colors = useColors();

  const { themeId } = route.params;
  const theme = useThemeStore((s) => s.themes.find((th) => th.id === themeId));
  const updateTheme = useThemeStore((s) => s.updateTheme);
  const [loadingKey, setLoadingKey] = useState<ImageKey | null>(null);

  if (!theme) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <SettingsHeader title={t("theme.background", "背景")} />
        <View style={styles.center}>
          <Text style={{ color: colors.mutedForeground }}>{t("theme.notFound", "未找到主题")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isBuiltIn = theme.builtIn;
  const bgImages = theme.backgroundImages ?? {};
  const overlayOpacity = theme.overlayOpacity ?? {};

  const handlePickImage = useCallback(async (key: ImageKey) => {
    if (isBuiltIn) return;
    try {
      const ImagePicker = await import("expo-image-picker");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) return;
      setLoadingKey(key);

      const asset = result.assets[0];
      let dataUri: string;

      if (asset.base64) {
        const mime = asset.mimeType ?? "image/jpeg";
        dataUri = `data:${mime};base64,${asset.base64}`;
      } else {
        const FileSystem = await import("expo-file-system/legacy");
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const mime = asset.mimeType ?? "image/jpeg";
        dataUri = `data:${mime};base64,${base64}`;
      }

      // Size check & compress
      const size = getDataURISize(dataUri);
      if (size > 500 * 1024) {
        try {
          const ImageManipulator = await import("expo-image-manipulator");
          const manipulated = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 1920 } }],
            { compress: 0.6, format: ImageManipulator.SaveFormat.WEBP, base64: true },
          );
          if (manipulated.base64) {
            dataUri = `data:image/webp;base64,${manipulated.base64}`;
            const newSize = getDataURISize(dataUri);
            if (newSize > 500 * 1024) {
              Alert.alert(
                t("theme.imageTooLarge", "图片过大"),
                t("theme.imageTooLargeDesc", "请选择更小的图片（压缩后最大 500KB）。"),
              );
              setLoadingKey(null);
              return;
            }
          }
        } catch {
          Alert.alert(t("theme.imageTooLarge", "图片过大"));
          setLoadingKey(null);
          return;
        }
      }

      updateTheme(theme.id, {
        backgroundImages: { ...bgImages, [key]: dataUri },
      });
      setLoadingKey(null);
    } catch (e) {
      setLoadingKey(null);
      console.warn("[ThemeBackground] Error picking image:", e);
    }
  }, [isBuiltIn, theme, bgImages, updateTheme, t]);

  const handleRemoveImage = useCallback((key: ImageKey) => {
    if (isBuiltIn) return;
    updateTheme(theme.id, {
      backgroundImages: { ...bgImages, [key]: undefined },
    });
  }, [isBuiltIn, theme, bgImages, updateTheme]);

  const handleOpacityChange = useCallback(
    (key: "sidebar" | "card" | "muted", value: number) => {
      if (isBuiltIn) return;
      updateTheme(theme.id, {
        overlayOpacity: { ...overlayOpacity, [key]: Math.round(value * 100) / 100 },
      });
    },
    [isBuiltIn, theme, overlayOpacity, updateTheme],
  );

  const renderImageSection = (
    key: ImageKey,
    title: string,
    uri: string | undefined,
  ) => (
    <View style={styles.section} key={key}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      {uri ? (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri }}
            style={[styles.imagePreview, { borderColor: colors.border }]}
            resizeMode="cover"
          />
          {!isBuiltIn && (
            <View style={styles.imageActions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.muted }]}
                onPress={() => handlePickImage(key)}
              >
                <Text style={{ color: colors.foreground, fontWeight: fontWeight.medium }}>
                  {t("theme.changeImage", "更换")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: colors.destructive, borderWidth: 1 }]}
                onPress={() => handleRemoveImage(key)}
              >
                <Text style={{ color: colors.destructive, fontWeight: fontWeight.medium }}>
                  {t("theme.removeImage", "移除")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.pickBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={() => handlePickImage(key)}
          disabled={isBuiltIn || loadingKey === key}
        >
          <Text style={{ color: colors.mutedForeground }}>
            {loadingKey === key
              ? t("theme.processing", "处理中...")
              : t("theme.selectImage", "选择背景图片")}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <SettingsHeader title={t("theme.background", "背景")} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
        {/* App background image */}
        {renderImageSection(
          "backgroundImage",
          t("theme.backgroundImage", "应用背景图片"),
          bgImages.backgroundImage,
        )}

        {/* Reader background image */}
        {renderImageSection(
          "readerBackgroundImage",
          t("theme.readerBackgroundImage", "阅读器背景图片"),
          bgImages.readerBackgroundImage,
        )}

        {/* Overlay opacity sliders */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            {t("theme.overlayOpacity", "遮罩透明度")}
          </Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {t(
              "theme.overlayHint",
              "设置背景图片后，UI 层以半透明背景渲染。",
            )}
          </Text>

          {([
            { key: "sidebar" as const, labelKey: "theme.sidebarOpacity", fallback: "侧栏透明度", default: 0.85 },
            { key: "card" as const, labelKey: "theme.cardOpacity", fallback: "卡片透明度", default: 0.9 },
            { key: "muted" as const, labelKey: "theme.mutedOpacity", fallback: "区块透明度", default: 0.8 },
          ]).map((item) => (
            <View key={item.key} style={styles.sliderRow}>
              <Text style={[styles.sliderLabel, { color: colors.foreground }]}>
                {t(item.labelKey, item.fallback)}: {((overlayOpacity[item.key] ?? item.default) * 100).toFixed(0)}%
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                step={0.05}
                value={overlayOpacity[item.key] ?? item.default}
                onSlidingComplete={(v) => handleOpacityChange(item.key, v)}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
                disabled={isBuiltIn}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: spacing.lg, gap: 24, paddingBottom: 40 },
  section: { gap: 12 },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  hint: { fontSize: fontSize.sm, lineHeight: 20 },
  imageContainer: { gap: 12 },
  imagePreview: {
    width: "100%",
    height: 160,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  imageActions: { flexDirection: "row", gap: 12 },
  actionBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  pickBtn: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: radius.xl,
    paddingVertical: 32,
    alignItems: "center",
  },
  sliderRow: { gap: 4 },
  sliderLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  slider: { width: "100%", height: 36 },
});
