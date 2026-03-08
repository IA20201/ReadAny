import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@readany/core/utils";
import { readingStatsService } from "@readany/core/stats";
import type { DailyStats, OverallStats } from "@readany/core/stats";
import { useReadingSessionStore } from "@readany/core/stores/reading-session-store";
import {
  ChevronRight,
  Info,
  Palette,
  Database,
  Puzzle,
  BookOpen,
  Clock,
  Flame,
  TrendingUp,
  Loader2,
  Volume2,
  Languages,
  Cpu,
  BarChart3,
  Cloud,
} from "lucide-react";

/* ── Settings menu ── */

function useMenuSections() {
  const { t } = useTranslation();
  return useMemo(() => [
    {
      title: t("settings.general"),
      items: [
        { icon: Palette, label: t("settings.appearance"), path: "/settings/appearance" },
        { icon: Cloud, label: t("settings.sync"), path: "/settings/sync" },
      ],
    },
    {
      title: t("settings.skills"),
      items: [
        { icon: Database, label: t("settings.ai_title"), path: "/settings/ai" },
        { icon: Volume2, label: t("tts.title"), path: "/settings/tts" },
        { icon: Languages, label: t("settings.translationTab"), path: "/settings/translation" },
        { icon: Puzzle, label: t("skills.title"), path: "/skills" },
        { icon: Cpu, label: t("settings.vm_title"), path: "/settings/vector-model" },
      ],
    },
    {
      title: t("settings.about"),
      items: [
        { icon: Info, label: t("settings.about"), path: "/settings/about" },
      ],
    },
  ], [t]);
}

/* ── Main Page ── */

export function ProfilePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const menuSections = useMenuSections();
  const [overall, setOverall] = useState<OverallStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const saveCurrentSession = useReadingSessionStore((s) => s.saveCurrentSession);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setStatsLoading(true);
        await saveCurrentSession();

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 365);

        const [daily, overallStats] = await Promise.all([
          readingStatsService.getDailyStats(startDate, endDate),
          readingStatsService.getOverallStats(),
        ]);
        setDailyStats(daily);
        setOverall(overallStats);
      } catch (err) {
        console.error("[ProfilePage] Failed to load stats:", err);
      } finally {
        setStatsLoading(false);
      }
    };
    loadStats();
  }, [saveCurrentSession]);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 px-4 pb-3 pt-3 border-b border-border bg-background">
        <h1 className="text-2xl font-bold">{t("profile.title")}</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* ── Reading Stats Cards ── */}
        <div className="px-4 pt-4">
          {statsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<BookOpen className="h-4 w-4" />}
                title={t("profile.booksRead")}
                value={`${overall?.totalBooks ?? 0}`}
                unit={t("profile.booksUnit")}
              />
              <StatCard
                icon={<Clock className="h-4 w-4" />}
                title={t("profile.totalTime")}
                value={formatTime(overall?.totalReadingTime ?? 0)}
              />
              <StatCard
                icon={<Flame className="h-4 w-4" />}
                title={t("profile.streak")}
                value={`${overall?.currentStreak ?? 0}`}
                unit={t("profile.daysUnit")}
              />
              <StatCard
                icon={<TrendingUp className="h-4 w-4" />}
                title={t("profile.avgDaily")}
                value={formatTime(overall?.avgDailyTime ?? 0)}
              />
            </div>
          )}
        </div>

        {/* ── Compact Heatmap ── */}
        <div className="mx-4 mt-4 rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {t("profile.readingActivity")}
            </h2>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-primary active:opacity-70"
              onClick={() => navigate("/stats")}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {t("profile.viewDetails")}
            </button>
          </div>
          <MobileHeatmap dailyStats={dailyStats.map((s) => ({ date: s.date, time: s.totalTime }))} />
          <HeatmapLegend />
        </div>

        {/* ── Settings Menu ── */}
        {menuSections.map((section) => (
          <div key={section.title} className="mt-4 px-4">
            <h2 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {section.title}
            </h2>
            <div className="rounded-xl bg-card border border-border overflow-hidden">
              {section.items.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-accent transition-colors"
                    style={
                      idx < section.items.length - 1
                        ? { borderBottom: "1px solid var(--border)" }
                        : undefined
                    }
                    onClick={() => navigate(item.path)}
                  >
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <span className="flex-1 text-base">{item.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Version info */}
        <p className="mt-8 mb-6 text-center text-xs text-muted-foreground">
          {t("profile.version", { version: "1.0.0" })}
        </p>
      </div>
    </div>
  );
}

/* ── Stat Card ── */

function StatCard({
  icon,
  title,
  value,
  unit,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-xl bg-card border border-border p-3.5 shadow-sm">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">{title}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

/* ── Mobile Heatmap (compact, touch-friendly) ── */

function getHeatColor(minutes: number): string {
  if (minutes <= 0) return "bg-neutral-100";
  if (minutes < 15) return "bg-emerald-200";
  if (minutes < 30) return "bg-emerald-400";
  if (minutes < 60) return "bg-emerald-500";
  return "bg-emerald-700";
}

function MobileHeatmap({ dailyStats }: { dailyStats: Array<{ date: string; time: number }> }) {
  const cellSize = 10;
  const gap = 2;
  const unit = cellSize + gap;

  const { weeks, monthLabels } = useMemo(() => {
    const statsMap = new Map<string, number>();
    for (const s of dailyStats) {
      statsMap.set(s.date, s.time);
    }

    const today = new Date();
    const todayDay = today.getDay();
    const totalWeeks = 26;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (totalWeeks * 7 + todayDay - 1));

    const weeksArr: Array<Array<{ date: string; time: number; dayOfWeek: number }>> = [];
    const mLabels: Array<{ label: string; col: number }> = [];
    let currentWeek: Array<{ date: string; time: number; dayOfWeek: number }> = [];
    let lastMonth = -1;
    let weekIdx = 0;

    const cursor = new Date(startDate);

    while (cursor <= today) {
      const dateStr = cursor.toISOString().split("T")[0];
      const dow = cursor.getDay();
      const month = cursor.getMonth();

      if (dow === 0 && currentWeek.length > 0) {
        weeksArr.push(currentWeek);
        currentWeek = [];
        weekIdx++;
      }

      if (month !== lastMonth) {
        const monthName = cursor.toLocaleDateString("zh-CN", { month: "short" });
        mLabels.push({ label: monthName, col: weekIdx });
        lastMonth = month;
      }

      currentWeek.push({
        date: dateStr,
        time: statsMap.get(dateStr) || 0,
        dayOfWeek: dow,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    if (currentWeek.length > 0) weeksArr.push(currentWeek);

    return { weeks: weeksArr, monthLabels: mLabels };
  }, [dailyStats]);

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex" style={{ paddingLeft: "0px" }}>
        {monthLabels.map((m, i) => {
          const nextCol = i + 1 < monthLabels.length ? monthLabels[i + 1].col : weeks.length;
          const span = nextCol - m.col;
          return (
            <div
              key={`${m.label}-${m.col}`}
              className="text-[10px] text-muted-foreground"
              style={{ width: `${span * unit}px`, minWidth: `${span * unit}px` }}
            >
              {span >= 2 ? m.label : ""}
            </div>
          );
        })}
      </div>

      <div className="flex" style={{ gap: `${gap}px` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col" style={{ gap: `${gap}px` }}>
            {week[0] && week[0].dayOfWeek > 0 && wi === 0 &&
              Array.from({ length: week[0].dayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} style={{ height: `${cellSize}px`, width: `${cellSize}px` }} />
              ))}
            {week.map((day) => (
              <div
                key={day.date}
                className={cn("rounded-[2px]", getHeatColor(day.time))}
                style={{ height: `${cellSize}px`, width: `${cellSize}px` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function HeatmapLegend() {
  const { t } = useTranslation();
  return (
    <div className="mt-2.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
      <span>{t("common.less")}</span>
      <div className="h-[10px] w-[10px] rounded-[2px] bg-neutral-100" />
      <div className="h-[10px] w-[10px] rounded-[2px] bg-emerald-200" />
      <div className="h-[10px] w-[10px] rounded-[2px] bg-emerald-400" />
      <div className="h-[10px] w-[10px] rounded-[2px] bg-emerald-500" />
      <div className="h-[10px] w-[10px] rounded-[2px] bg-emerald-700" />
      <span>{t("common.more")}</span>
    </div>
  );
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
}
