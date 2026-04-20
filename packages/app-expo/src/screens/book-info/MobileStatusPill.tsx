/**
 * MobileStatusPill — Reading status pill with bottom sheet selection
 */
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import {
  Ban,
  BookCheck,
  BookOpen,
  BookX,
  Inbox,
} from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useColors, spacing, radius, fontSize, fontWeight, withOpacity } from "@/styles/theme";
import type { ReadingStatus } from "@readany/core/types";

const STATUS_CONFIG: Record<
  ReadingStatus,
  { icon: typeof Inbox; colorLight: string; colorDark: string; bgLight: string; bgDark: string }
> = {
  unread: { icon: Inbox, colorLight: "#6b7280", colorDark: "#9ca3af", bgLight: "#f3f4f6", bgDark: "#374151" },
  reading: { icon: BookOpen, colorLight: "#2563eb", colorDark: "#60a5fa", bgLight: "#eff6ff", bgDark: "#1e3a5f" },
  finished: { icon: BookCheck, colorLight: "#16a34a", colorDark: "#4ade80", bgLight: "#f0fdf4", bgDark: "#14532d" },
  shelved: { icon: Ban, colorLight: "#d97706", colorDark: "#fbbf24", bgLight: "#fffbeb", bgDark: "#78350f" },
  dropped: { icon: BookX, colorLight: "#ef4444", colorDark: "#f87171", bgLight: "#fef2f2", bgDark: "#7f1d1d" },
};

const STATUS_ORDER: ReadingStatus[] = ["unread", "reading", "finished", "shelved", "dropped"];

interface MobileStatusPillProps {
  status: ReadingStatus;
  onChange: (status: ReadingStatus) => void;
}

export function MobileStatusPill({ status, onChange }: MobileStatusPillProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const [visible, setVisible] = useState(false);
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  // Simple heuristic for dark mode
  const isDark = colors.background.toLowerCase().includes("12") || colors.background === "#121212";
  const pillColor = isDark ? config.colorDark : config.colorLight;
  const pillBg = isDark ? config.bgDark : config.bgLight;

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        style={[styles.pill, { backgroundColor: pillBg }]}
      >
        <Icon size={14} color={pillColor} />
        <Text style={[styles.pillText, { color: pillColor }]}>
          {t(`bookInfo.status${status.charAt(0).toUpperCase() + status.slice(1)}`)}
        </Text>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setVisible(false)}
        >
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              {t("bookInfo.readingStatus")}
            </Text>
            {STATUS_ORDER.map((s) => {
              const sc = STATUS_CONFIG[s];
              const SIcon = sc.icon;
              const active = s === status;
              return (
                <Pressable
                  key={s}
                  onPress={() => {
                    onChange(s);
                    setVisible(false);
                  }}
                  style={[
                    styles.option,
                    active && { backgroundColor: withOpacity(colors.primary, 0.08) },
                  ]}
                >
                  <SIcon size={20} color={active ? colors.primary : colors.mutedForeground} />
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: active ? colors.foreground : colors.mutedForeground,
                        fontWeight: active ? "600" : "400",
                      },
                    ]}
                  >
                    {t(`bookInfo.status${s.charAt(0).toUpperCase() + s.slice(1)}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  pillText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  sheet: {
    width: 280,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  sheetTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  optionText: {
    fontSize: fontSize.sm,
  },
});
