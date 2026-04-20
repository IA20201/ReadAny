/**
 * BookInfoStatsTab — 统计 tab: Progress + Pace & Prediction + Stats grid + Timeline
 */
import { View, Text, StyleSheet } from "react-native";
import { useColors, spacing, radius, fontSize, fontWeight, withOpacity } from "@/styles/theme";
import type { Book, ReadingSession } from "@readany/core/types";
import { getReadingSessions } from "@readany/core/db";
import { BookOpen, Calendar, Clock, Flame, Target, TrendingUp, Type, Zap } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  book: Book;
}

type PaceStatus =
  | { kind: "completed"; totalMinutes: number }
  | { kind: "not-started" }
  | { kind: "no-recent"; histMins: number; histChars: number }
  | { kind: "active"; recentMins: number; recentChars: number; daysToFinish: number; finishDate: Date };

export function BookInfoStatsTab({ book }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const [sessions, setSessions] = useState<ReadingSession[] | null>(null);

  useEffect(() => { getReadingSessions(book.id).then(setSessions); }, [book.id]);

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
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      if (daySet.has(d.toISOString().slice(0, 10))) streak++; else if (i > 0) break;
    }
    return { totalMinutes, totalChars, speed, sessionCount: sessions.length, activeDays: daySet.size, streak };
  }, [sessions]);

  // Reading pace (last 7 days) and finish-date prediction
  const pace = useMemo((): PaceStatus | null => {
    if (!sessions || !stats) return null;
    if (book.progress >= 1) return { kind: "completed", totalMinutes: stats.totalMinutes };
    if (book.progress <= 0 || stats.totalChars === 0) return { kind: "not-started" };

    const cutoff = Date.now() - 7 * 86400000;
    const recent = sessions.filter((s) => s.startedAt >= cutoff);
    const recentDays = new Set<string>();
    let recentTime = 0;
    let recentChars = 0;
    for (const s of recent) {
      recentDays.add(new Date(s.startedAt).toISOString().slice(0, 10));
      recentTime += s.totalActiveTime || 0;
      recentChars += s.charactersRead || 0;
    }

    // Historical daily averages (all-time, by active days) — used as fallback display
    const histMins = stats.activeDays > 0 ? Math.round(stats.totalMinutes / stats.activeDays) : 0;
    const histChars = stats.activeDays > 0 ? Math.round(stats.totalChars / stats.activeDays) : 0;

    if (recentDays.size === 0) return { kind: "no-recent", histMins, histChars };

    const recentMins = Math.round(recentTime / 60000 / recentDays.size);
    const recentCharsPerDay = Math.round(recentChars / recentDays.size);

    // Estimate total chars in the whole book by reverse-extrapolating from progress
    const estTotalChars = stats.totalChars / book.progress;
    const remainingChars = estTotalChars * (1 - book.progress);
    if (recentCharsPerDay <= 0) return { kind: "no-recent", histMins, histChars };
    const daysToFinish = Math.max(1, Math.ceil(remainingChars / recentCharsPerDay));
    const finishDate = new Date(Date.now() + daysToFinish * 86400000);
    return { kind: "active", recentMins, recentChars: recentCharsPerDay, daysToFinish, finishDate };
  }, [sessions, stats, book.progress]);

  // Timeline data: last 14 days
  const timelineData = useMemo(() => {
    if (!sessions) return [];
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

  const formatTime = (mins: number) => {
    if (mins === 0) return "—";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const formatRelative = (ts: number) => {
    const days = Math.floor((Date.now() - ts) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const formatFinishDate = (d: Date) =>
    d.toLocaleDateString(i18n.language || undefined, { month: "short", day: "numeric" });

  const progressPct = Math.round(book.progress * 100);

  // ─── Skeleton ───
  if (!stats) {
    return (
      <View style={styles.container}>
        <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{t("bookInfo.tabReading")}</Text>
        {/* Progress skeleton */}
        <View style={[styles.progressCard, { backgroundColor: withOpacity(colors.muted, 0.15), borderColor: "transparent" }]}>
          <View style={{ height: 30, width: 80, borderRadius: 6, backgroundColor: withOpacity(colors.muted, 0.25) }} />
          <View style={{ height: 8, borderRadius: 4, backgroundColor: withOpacity(colors.muted, 0.2), marginTop: 12 }} />
        </View>
        {/* Pace skeleton */}
        <View style={[styles.paceCard, { backgroundColor: withOpacity(colors.muted, 0.12), borderColor: "transparent" }]}>
          <View style={{ height: 40, borderRadius: 4, backgroundColor: withOpacity(colors.muted, 0.2) }} />
        </View>
        {/* Grid skeleton */}
        <View style={styles.grid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: withOpacity(colors.muted, 0.12), borderColor: "transparent" }]}>
              <View style={{ width: 28, height: 28, borderRadius: radius.md, backgroundColor: withOpacity(colors.muted, 0.25) }} />
              <View style={{ width: 40, height: 14, borderRadius: 4, backgroundColor: withOpacity(colors.muted, 0.2), marginTop: 4 }} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  const statItems = [
    { icon: Clock, value: formatTime(stats.totalMinutes), label: t("bookInfo.totalTime"), color: "#3b82f6" },
    { icon: Type, value: stats.totalChars > 0 ? t("bookInfo.tenThousandChars", { value: (stats.totalChars / 10000).toFixed(1) }) : "—", label: t("bookInfo.totalCharacters"), color: "#8b5cf6" },
    { icon: TrendingUp, value: stats.speed > 0 ? `${stats.speed}` : "—", label: t("bookInfo.charsPerMin"), color: "#10b981" },
    { icon: Zap, value: String(stats.sessionCount), label: t("bookInfo.readingSessions", { count: stats.sessionCount }), color: "#f59e0b" },
    { icon: Calendar, value: String(stats.activeDays), label: t("bookInfo.activeDays", { count: stats.activeDays }), color: "#ef4444" },
    { icon: BookOpen, value: book.lastOpenedAt ? formatRelative(book.lastOpenedAt) : "—", label: t("bookInfo.lastRead"), color: colors.mutedForeground },
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{t("bookInfo.tabReading")}</Text>

      {/* ─── Progress Card ─── */}
      <View style={[styles.progressCard, { backgroundColor: withOpacity(colors.card, 0.9), borderColor: withOpacity(colors.border, 0.35), shadowColor: colors.foreground }]}>
        <View style={styles.progressTop}>
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
              <Flame size={13} color="#f59e0b" />
              <Text style={styles.streakText}>{t("bookInfo.streak", { count: stats.streak })}</Text>
            </View>
          )}
        </View>
        <View style={[styles.progressTrack, { backgroundColor: withOpacity(colors.muted, 0.5) }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progressPct}%` as `${number}%` }]} />
        </View>
      </View>

      {/* ─── Pace & Prediction Card ─── */}
      {pace && (
        <View style={[styles.paceCard, { backgroundColor: withOpacity(colors.card, 0.9), borderColor: withOpacity(colors.border, 0.35), shadowColor: colors.foreground }]}>
          <View style={styles.paceHeader}>
            <View style={[styles.paceIconBubble, { backgroundColor: withOpacity("#6366f1", 0.1) }]}>
              <TrendingUp size={13} color="#6366f1" />
            </View>
            <Text style={[styles.paceTitle, { color: colors.foreground }]}>{t("bookInfo.pace")}</Text>
            <Text style={[styles.paceWindow, { color: withOpacity(colors.mutedForeground, 0.7) }]}> · {t("bookInfo.paceRecent7")}</Text>
          </View>

          {pace.kind === "completed" && (
            <View style={styles.paceMessageRow}>
              <Text style={[styles.paceMessage, { color: colors.foreground }]}>{t("bookInfo.predictCompleted")}</Text>
              <Text style={[styles.paceMessageSub, { color: colors.mutedForeground }]}>
                {t("bookInfo.totalTime")}: {formatTime(pace.totalMinutes)}
              </Text>
            </View>
          )}

          {pace.kind === "not-started" && (
            <Text style={[styles.paceMessage, { color: colors.mutedForeground }]}>{t("bookInfo.predictNeedStart")}</Text>
          )}

          {pace.kind === "no-recent" && (
            <>
              <View style={styles.paceNumbers}>
                <View style={styles.paceCol}>
                  <Text style={[styles.paceBig, { color: withOpacity(colors.foreground, 0.5) }]}>{pace.histMins || "—"}</Text>
                  <Text style={[styles.paceUnit, { color: colors.mutedForeground }]}>{t("bookInfo.paceMinutesPerDay")}</Text>
                </View>
                <View style={styles.paceDivider} />
                <View style={styles.paceCol}>
                  <Text style={[styles.paceBig, { color: withOpacity(colors.foreground, 0.5) }]}>
                    {pace.histChars > 0 ? pace.histChars.toLocaleString() : "—"}
                  </Text>
                  <Text style={[styles.paceUnit, { color: colors.mutedForeground }]}>{t("bookInfo.paceCharsPerDay")}</Text>
                </View>
              </View>
              <View style={[styles.paceHr, { backgroundColor: withOpacity(colors.border, 0.4) }]} />
              <Text style={[styles.paceMessage, { color: withOpacity(colors.mutedForeground, 0.9) }]}>
                {t("bookInfo.predictNoRecent")}
              </Text>
            </>
          )}

          {pace.kind === "active" && (
            <>
              <View style={styles.paceNumbers}>
                <View style={styles.paceCol}>
                  <Text style={[styles.paceBig, { color: colors.foreground }]}>{pace.recentMins}</Text>
                  <Text style={[styles.paceUnit, { color: colors.mutedForeground }]}>{t("bookInfo.paceMinutesPerDay")}</Text>
                </View>
                <View style={styles.paceDivider} />
                <View style={styles.paceCol}>
                  <Text style={[styles.paceBig, { color: colors.foreground }]}>{pace.recentChars.toLocaleString()}</Text>
                  <Text style={[styles.paceUnit, { color: colors.mutedForeground }]}>{t("bookInfo.paceCharsPerDay")}</Text>
                </View>
              </View>
              <View style={[styles.paceHr, { backgroundColor: withOpacity(colors.border, 0.4) }]} />
              <View style={styles.paceTargetRow}>
                <Target size={12} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.paceTargetText, { color: colors.foreground }]}>
                    {t("bookInfo.predictFinishIn", { days: pace.daysToFinish })}
                  </Text>
                  <Text style={[styles.paceTargetSub, { color: colors.mutedForeground }]}>
                    {t("bookInfo.predictFinishDate", { date: formatFinishDate(pace.finishDate) })}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      )}

      {/* ─── 3×2 Stats Grid ─── */}
      <View style={styles.grid}>
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <View key={item.label} style={[styles.statCard, { backgroundColor: withOpacity(colors.card, 0.9), borderColor: withOpacity(colors.border, 0.35), shadowColor: colors.foreground }]}>
              <View style={[styles.iconBubble, { backgroundColor: withOpacity(item.color, 0.1) }]}>
                <Icon size={14} color={item.color} />
              </View>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{item.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{item.label}</Text>
            </View>
          );
        })}
      </View>

      {/* ─── 14-Day Timeline ─── */}
      {timelineData.length > 0 && (
        <View>
          <Text style={[styles.timelineHeader, { color: colors.mutedForeground }]}>
            {t("bookInfo.readingTimeline")}
          </Text>
          <View style={[styles.timelineCard, { backgroundColor: withOpacity(colors.card, 0.7), borderColor: withOpacity(colors.border, 0.3), shadowColor: colors.foreground }]}>
            <View style={styles.timelineBars}>
              {(() => {
                const max = Math.max(...timelineData.map((d) => d.minutes), 1);
                return timelineData.map((d) => (
                  <View key={d.date} style={styles.timelineBarCol}>
                    <View
                      style={[
                        styles.timelineBarFill,
                        { backgroundColor: withOpacity(colors.primary, 0.7), height: Math.max((d.minutes / max) * 56, 2) },
                      ]}
                    />
                    <Text style={[styles.timelineBarLabel, { color: withOpacity(colors.mutedForeground, 0.5) }]}>{d.label}</Text>
                  </View>
                ));
              })()}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, gap: spacing.md },
  sectionHeader: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 },

  // Progress card
  progressCard: {
    borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, gap: spacing.md,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  progressTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  progressBig: { fontSize: 28, fontWeight: "800" },
  progressSub: { fontSize: 11, marginTop: 2 },
  streakBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
  },
  streakText: { fontSize: 11, fontWeight: "600", color: "#d97706" },
  progressTrack: { height: 8, borderRadius: radius.full, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: radius.full },

  // Pace card
  paceCard: {
    borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, gap: spacing.md,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 5, elevation: 2,
  },
  paceHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  paceIconBubble: { width: 22, height: 22, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  paceTitle: { fontSize: fontSize.sm, fontWeight: "700" },
  paceWindow: { fontSize: 11 },
  paceNumbers: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  paceCol: { flex: 1, alignItems: "center", gap: 2 },
  paceDivider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: "rgba(128,128,128,0.25)" },
  paceBig: { fontSize: 24, fontWeight: "800" },
  paceUnit: { fontSize: 10 },
  paceHr: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  paceTargetRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  paceTargetText: { fontSize: fontSize.sm, fontWeight: "600" },
  paceTargetSub: { fontSize: 11, marginTop: 2 },
  paceMessage: { fontSize: fontSize.sm, fontWeight: "500" },
  paceMessageRow: { gap: 4 },
  paceMessageSub: { fontSize: 11 },

  // Stats grid
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: {
    width: "31%", alignItems: "center", gap: 4,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xs,
    borderWidth: 1, borderRadius: radius.xl,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  iconBubble: { width: 28, height: 28, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: fontSize.base, fontWeight: "700" },
  statLabel: { fontSize: 9, textAlign: "center" },

  // Timeline
  timelineHeader: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing.sm },
  timelineCard: {
    borderWidth: 1, borderRadius: radius.xl, padding: spacing.md,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  timelineBars: { flexDirection: "row", alignItems: "flex-end", height: 76, gap: 3 },
  timelineBarCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  timelineBarFill: { width: "100%", borderRadius: 2 },
  timelineBarLabel: { fontSize: 7, marginTop: 2 },
});
