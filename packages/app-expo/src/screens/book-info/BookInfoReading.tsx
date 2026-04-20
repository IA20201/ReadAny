/**
 * BookInfoReading — Mobile reading tab with rich stats and loading state
 */
import { View, Text, StyleSheet } from "react-native";
import { useColors, spacing, radius, fontSize, fontWeight, withOpacity } from "@/styles/theme";
import type { Book, ReadingSession } from "@readany/core/types";
import { getReadingSessions } from "@readany/core/db";
import {
  BarChart3,
  BookOpen,
  Calendar,
  Clock,
  Flame,
  TrendingUp,
  Type,
  Zap,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  book: Book;
}

export function BookInfoReading({ book }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const [sessions, setSessions] = useState<ReadingSession[] | null>(null);

  useEffect(() => {
    getReadingSessions(book.id).then(setSessions);
  }, [book.id]);

  const stats = useMemo(() => {
    if (!sessions) return null;
    const totalTime = sessions.reduce((sum, s) => sum + (s.totalActiveTime || 0), 0);
    const totalChars = sessions.reduce((sum, s) => sum + (s.charactersRead || 0), 0);
    const totalMinutes = Math.round(totalTime / 60000);
    const speed = totalMinutes > 0 ? Math.round(totalChars / totalMinutes) : 0;
    const daySet = new Set<string>();
    for (const s of sessions) {
      if (s.startedAt) daySet.add(new Date(s.startedAt).toISOString().slice(0, 10));
    }
    // Streak
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (daySet.has(d.toISOString().slice(0, 10))) streak++;
      else if (i > 0) break;
    }
    return { totalMinutes, totalChars, speed, sessionCount: sessions.length, activeDays: daySet.size, streak };
  }, [sessions]);

  const progressPct = Math.round(book.progress * 100);
  const formatTime = (mins: number) => {
    if (mins === 0) return "—";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  // Skeleton
  if (!stats) {
    return (
      <View style={styles.container}>
        <View style={[styles.skeleton, { backgroundColor: withOpacity(colors.muted, 0.3), height: 80 }]} />
        <View style={styles.skeletonGrid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={[styles.skeletonCard, { backgroundColor: withOpacity(colors.muted, 0.2) }]} />
          ))}
        </View>
      </View>
    );
  }

  const STAT_ITEMS = [
    { icon: Clock, value: formatTime(stats.totalMinutes), label: t("bookInfo.totalTime"), color: "#3b82f6" },
    { icon: Type, value: stats.totalChars > 0 ? t("bookInfo.tenThousandChars", { value: (stats.totalChars / 10000).toFixed(1) }) : "—", label: t("bookInfo.totalCharacters"), color: "#8b5cf6" },
    { icon: TrendingUp, value: stats.speed > 0 ? `${stats.speed}` : "—", label: t("bookInfo.charsPerMin"), color: "#10b981" },
    { icon: Zap, value: String(stats.sessionCount), label: t("bookInfo.readingSessions", { count: stats.sessionCount }), color: "#f59e0b" },
    { icon: Calendar, value: String(stats.activeDays), label: t("bookInfo.activeDays", { count: stats.activeDays }), color: "#ef4444" },
    { icon: BookOpen, value: book.lastOpenedAt ? formatRelative(book.lastOpenedAt) : "—", label: t("bookInfo.lastRead"), color: colors.mutedForeground },
  ];

  return (
    <View style={styles.container}>
      {/* Progress card */}
      <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: withOpacity(colors.border, 0.3) }]}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={[styles.progressBig, { color: colors.foreground }]}>{progressPct}%</Text>
            <Text style={[styles.progressSub, { color: colors.mutedForeground }]}>
              {book.meta.totalPages
                ? t("bookInfo.pageProgress", { current: Math.round(book.meta.totalPages * book.progress), total: book.meta.totalPages })
                : t("bookInfo.progress")}
            </Text>
          </View>
          {stats.streak > 0 && (
            <View style={[styles.streakBadge, { backgroundColor: withOpacity("#f59e0b", 0.1) }]}>
              <Flame size={14} color="#f59e0b" />
              <Text style={styles.streakText}>{t("bookInfo.streak", { count: stats.streak })}</Text>
            </View>
          )}
        </View>
        <View style={[styles.bar, { backgroundColor: withOpacity(colors.muted, 0.5) }]}>
          <View style={[styles.barFill, { backgroundColor: colors.primary, width: `${progressPct}%` as `${number}%` }]} />
        </View>
      </View>

      {/* Stats grid */}
      <View style={styles.grid}>
        {STAT_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <View
              key={item.label}
              style={[styles.statCard, { backgroundColor: withOpacity(colors.card, 0.8), borderColor: withOpacity(colors.border, 0.2) }]}
            >
              <Icon size={16} color={item.color} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>{item.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Timeline */}
      {sessions && sessions.length > 0 && (
        <View>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            {t("bookInfo.readingTimeline")}
          </Text>
          <MiniTimeline sessions={sessions} colors={colors} />
        </View>
      )}
    </View>
  );
}

function MiniTimeline({ sessions, colors }: { sessions: ReadingSession[]; colors: ReturnType<typeof useColors> }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      if (!s.startedAt) continue;
      const day = new Date(s.startedAt).toISOString().slice(0, 10);
      map.set(day, (map.get(day) || 0) + (s.totalActiveTime || 0));
    }
    return [...map.entries()].sort().slice(-14).map(([date, ms]) => ({
      date,
      minutes: Math.round(ms / 60000),
      label: new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    }));
  }, [sessions]);

  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.minutes), 1);

  return (
    <View style={[styles.timelineWrap, { backgroundColor: withOpacity(colors.card, 0.5), borderColor: withOpacity(colors.border, 0.2) }]}>
      <View style={styles.timeline}>
        {data.map((d) => (
          <View key={d.date} style={styles.tlBar}>
            <View
              style={[styles.tlBarFill, { backgroundColor: withOpacity(colors.primary, 0.7), height: Math.max((d.minutes / max) * 60, 2) }]}
            />
            <Text style={[styles.tlLabel, { color: withOpacity(colors.mutedForeground, 0.5) }]}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function formatRelative(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  container: { gap: spacing.xl },
  skeleton: { borderRadius: radius.xxl },
  skeletonGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  skeletonCard: { width: "31%", height: 80, borderRadius: radius.lg },
  progressCard: {
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  progressBig: { fontSize: 28, fontWeight: "800" },
  progressSub: { fontSize: 11, marginTop: 2 },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  streakText: { fontSize: 11, fontWeight: "600", color: "#d97706" },
  bar: { height: 8, borderRadius: radius.full, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: radius.full },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: {
    width: "31%",
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.xl,
  },
  statValue: { fontSize: fontSize.base, fontWeight: "700" },
  statLabel: { fontSize: 9, textAlign: "center" },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  timelineWrap: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  timeline: { flexDirection: "row", alignItems: "flex-end", height: 80, gap: 3 },
  tlBar: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  tlBarFill: { width: "100%", borderRadius: 2 },
  tlLabel: { fontSize: 7, marginTop: 2 },
});
