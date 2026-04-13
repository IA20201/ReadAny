import {
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  FlameIcon,
  TrendingUpIcon,
} from "@/components/ui/Icon";
import { useReadingSessionStore } from "@/stores";
import { useColors, withOpacity } from "@/styles/theme";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { getPlatformService } from "@readany/core/services";
import {
  mergeCurrentSessionIntoDailyStats,
  mergeCurrentSessionIntoOverallStats,
  readingStatsService,
} from "@readany/core/stats";
import { eventBus } from "@readany/core/utils/event-bus";
import type { DailyStats, OverallStats, PeriodBookStats, TrendPoint } from "@readany/core/stats";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BarChart } from "./stats/BarChart";
import { FullHeatmap } from "./stats/FullHeatmap";
import { PeriodBookList } from "./stats/PeriodBookList";
import { StatCard } from "./stats/StatCard";
import { TrendChart } from "./stats/TrendChart";
import { makeStyles } from "./stats/stats-styles";
import { formatTime, getWeekEnd, getWeekStart } from "./stats/stats-utils";
import { useResolvedCovers } from "./notes/useResolvedCovers";

type ChartView = "heatmap" | "bar";
type ChartMode = "week" | "month";

export default function StatsScreen() {
  const colors = useColors();
  const s = makeStyles(colors);
  const { t, i18n } = useTranslation();
  const nav = useNavigation();
  const saveCurrentSession = useReadingSessionStore((s) => s.saveCurrentSession);
  const currentSession = useReadingSessionStore((s) => s.currentSession);

  const [loading, setLoading] = useState(true);
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [heatmapData, setHeatmapData] = useState<DailyStats[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);

  const [chartView, setChartView] = useState<ChartView>("heatmap");
  const [chartMode, setChartMode] = useState<ChartMode>("week");
  const [chartDate, setChartDate] = useState<Date>(() => getWeekStart(new Date()));
  const [chartData, setChartData] = useState<DailyStats[]>([]);
  const [periodBooks, setPeriodBooks] = useState<PeriodBookStats[]>([]);
  const resolvedCovers = useResolvedCovers(periodBooks);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await saveCurrentSession();
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 365);

      const [daily, overall, trend] = await Promise.all([
        readingStatsService.getDailyStats(startDate, endDate),
        readingStatsService.getOverallStats(),
        readingStatsService.getRecentTrend(30),
      ]);
      setHeatmapData(daily);
      setOverallStats(overall);
      setTrendData(trend);
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoading(false);
    }
  }, [saveCurrentSession]);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  useEffect(() => {
    return eventBus.on("sync:completed", () => { void loadData(); });
  }, [loadData]);

  // Load chart data when mode/date changes
  useEffect(() => {
    if (loading) return;
    const loadChart = async () => {
      try {
        let periodStart: Date;
        let periodEnd: Date;
        let data: DailyStats[];

        if (chartMode === "week") {
          periodStart = chartDate;
          periodEnd = getWeekEnd(chartDate);
          data = await readingStatsService.getWeeklyStats(chartDate);
        } else {
          const year = chartDate.getFullYear();
          const month = chartDate.getMonth();
          periodStart = new Date(year, month, 1);
          periodEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
          data = await readingStatsService.getMonthlyStats(year, month);
        }

        const books = await readingStatsService.getBookStatsForPeriod(periodStart, periodEnd);
        setChartData(data);
        setPeriodBooks(books);
      } catch {}
    };
    loadChart();
  }, [chartMode, chartDate, loading]);

  const navigatePeriod = useCallback(
    (direction: -1 | 1) => {
      setChartDate((prev) => {
        const d = new Date(prev);
        if (chartMode === "week") d.setDate(d.getDate() + direction * 7);
        else d.setMonth(d.getMonth() + direction);
        return d;
      });
    },
    [chartMode],
  );

  const switchChartMode = useCallback((mode: ChartMode) => {
    setChartMode(mode);
    if (mode === "week") setChartDate(getWeekStart(new Date()));
    else {
      const now = new Date();
      setChartDate(new Date(now.getFullYear(), now.getMonth(), 1));
    }
  }, []);

  const periodLabel = useMemo(() => {
    if (chartMode === "week") {
      const end = getWeekEnd(chartDate);
      const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
      return `${fmt(chartDate)} – ${fmt(end)}`;
    }
    return new Intl.DateTimeFormat(i18n.language, { year: "numeric", month: "long" }).format(chartDate);
  }, [chartDate, chartMode, i18n.language]);

  const barChartData = useMemo(() => {
    const weekdayFormatter = new Intl.DateTimeFormat(i18n.language, { weekday: "short" });
    const dayNames = Array.from({ length: 7 }, (_, i) =>
      weekdayFormatter.format(new Date(2024, 0, 1 + i)),
    );
    if (chartMode === "week") {
      return chartData.map((d, i) => ({ label: dayNames[i] || d.date.slice(5), value: d.totalTime }));
    }
    return chartData.map((d) => ({ label: String(new Date(d.date).getDate()), value: d.totalTime }));
  }, [chartData, chartMode, i18n.language]);

  const liveHeatmapData = useMemo(
    () => mergeCurrentSessionIntoDailyStats(heatmapData, currentSession),
    [heatmapData, currentSession],
  );
  const liveOverallStats = useMemo(
    () => mergeCurrentSessionIntoOverallStats(overallStats, heatmapData, currentSession),
    [overallStats, heatmapData, currentSession],
  );

  const booksRead = liveOverallStats?.totalBooks ?? 0;
  const totalTime = liveOverallStats ? formatTime(liveOverallStats.totalReadingTime) : "0m";
  const streak = liveOverallStats?.currentStreak ?? 0;
  const avgDaily = liveOverallStats ? formatTime(liveOverallStats.avgDailyTime) : "0m";

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.mutedForeground} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => nav.goBack()}>
          <ChevronLeftIcon size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t("stats.title", "阅读统计")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        {/* Stats cards */}
        <View style={s.statsGrid}>
          <StatCard icon={<BookOpenIcon size={16} color={colors.mutedForeground} />} title={t("profile.booksRead", "已读")} value={String(booksRead)} unit={t("profile.booksUnit", "本")} />
          <StatCard icon={<ClockIcon size={16} color={colors.mutedForeground} />} title={t("profile.totalTime", "总时长")} value={totalTime} />
          <StatCard icon={<FlameIcon size={16} color={colors.mutedForeground} />} title={t("profile.streak", "连续")} value={String(streak)} unit={t("profile.daysUnit", "天")} />
          <StatCard icon={<TrendingUpIcon size={16} color={colors.mutedForeground} />} title={t("profile.avgDaily", "日均")} value={avgDaily} />
        </View>

        {/* Heatmap / Bar Chart card */}
        <View style={s.section}>
          <View style={s.sectionCard}>
            <View style={s.chartHeaderRow}>
              <Text style={s.chartHeaderLabel}>{t("profile.readingActivity", "阅读活动")}</Text>
              <View style={s.toggleRow}>
                <TouchableOpacity style={[s.toggleBtn, chartView === "heatmap" && s.toggleBtnActive]} onPress={() => setChartView("heatmap")}>
                  <Text style={[s.toggleBtnText, chartView === "heatmap" && s.toggleBtnTextActive]}>{t("stats.viewHeatmap", "热力图")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.toggleBtn, chartView === "bar" && s.toggleBtnActive]} onPress={() => setChartView("bar")}>
                  <Text style={[s.toggleBtnText, chartView === "bar" && s.toggleBtnTextActive]}>{t("stats.viewBarChart", "柱状图")}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {chartView === "bar" && (
              <View style={s.barControlsRow}>
                <View style={s.toggleRow}>
                  <TouchableOpacity style={[s.toggleBtn, chartMode === "week" && s.toggleBtnActive]} onPress={() => switchChartMode("week")}>
                    <Text style={[s.toggleBtnText, chartMode === "week" && s.toggleBtnTextActive]}>{t("stats.periodWeek", "周")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.toggleBtn, chartMode === "month" && s.toggleBtnActive]} onPress={() => switchChartMode("month")}>
                    <Text style={[s.toggleBtnText, chartMode === "month" && s.toggleBtnTextActive]}>{t("stats.periodMonth", "月")}</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.periodNav}>
                  <TouchableOpacity onPress={() => navigatePeriod(-1)} style={s.periodNavBtn}>
                    <ChevronLeftIcon size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <Text style={s.periodLabel}>{periodLabel}</Text>
                  <TouchableOpacity onPress={() => navigatePeriod(1)} style={s.periodNavBtn}>
                    <ChevronRightIcon size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {chartView === "heatmap" ? (
              <>
                <FullHeatmap dailyStats={liveHeatmapData} />
                <View style={s.heatmapLegend}>
                  <Text style={s.legendText}>{t("common.less", "少")}</Text>
                  {[colors.muted, withOpacity(colors.emerald, 0.3), withOpacity(colors.emerald, 0.5), withOpacity(colors.emerald, 0.7), withOpacity(colors.emerald, 0.9)].map((c, i) => (
                    <View key={i} style={[s.legendCell, { backgroundColor: c }]} />
                  ))}
                  <Text style={s.legendText}>{t("common.more", "多")}</Text>
                </View>
              </>
            ) : (
              <BarChart data={barChartData} />
            )}
          </View>
        </View>

        {/* Trend Chart */}
        <View style={s.section}>
          <View style={s.sectionCard}>
            <Text style={s.sectionCardTitle}>{t("stats.trendTitle", "30天阅读趋势")}</Text>
            <TrendChart data={trendData} />
          </View>
        </View>

        {/* Period Book List */}
        <View style={s.section}>
          <View style={s.sectionCard}>
            <Text style={s.sectionCardTitle}>{t("stats.periodBooks", "期间阅读书籍")}</Text>
            <PeriodBookList books={periodBooks} resolvedCovers={resolvedCovers} />
          </View>
        </View>

        {/* Longest streak */}
        {liveOverallStats && liveOverallStats.longestStreak > 0 && (
          <View style={s.section}>
            <View style={s.streakCard}>
              <View style={s.streakIconWrap}>
                <FlameIcon size={16} color={colors.amber} />
              </View>
              <View style={s.streakInfo}>
                <Text style={s.streakLabel}>{t("stats.longestStreak", { days: liveOverallStats.longestStreak })}</Text>
                <Text style={s.streakDesc}>{t("stats.longestStreakDesc", "历史最长连续阅读记录")}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
