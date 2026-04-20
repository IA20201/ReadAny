/**
 * BookReadingTab — Reading progress, statistics, timeline
 * Visual: elevated stat cards, animated progress, rich timeline
 */
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
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface BookReadingTabProps {
  book: Book;
}

export function BookReadingTab({ book }: BookReadingTabProps) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<ReadingSession[] | null>(null); // null = loading

  useEffect(() => {
    getReadingSessions(book.id).then(setSessions);
  }, [book.id]);

  const stats = useMemo(() => {
    if (!sessions) return null;
    const totalTime = sessions.reduce((sum, s) => sum + (s.totalActiveTime || 0), 0);
    const totalChars = sessions.reduce((sum, s) => sum + (s.charactersRead || 0), 0);
    const totalPages = sessions.reduce((sum, s) => sum + (s.pagesRead || 0), 0);
    const totalMinutes = Math.round(totalTime / 60000);
    const speed = totalMinutes > 0 ? Math.round(totalChars / totalMinutes) : 0;

    const daySet = new Set<string>();
    for (const s of sessions) {
      if (s.startedAt) daySet.add(new Date(s.startedAt).toISOString().slice(0, 10));
    }

    // Streak: consecutive days from today backwards
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (daySet.has(key)) streak++;
      else if (i > 0) break;
    }

    return { totalMinutes, totalChars, totalPages, speed, sessionCount: sessions.length, activeDays: daySet.size, streak };
  }, [sessions]);

  const progressPct = Math.round(book.progress * 100);

  const formatTime = (mins: number) => {
    if (mins === 0) return "—";
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // Loading skeleton
  if (!sessions || !stats) {
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        <div className="h-10 animate-pulse rounded-xl bg-muted/50" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/30" />
          ))}
        </div>
        <div className="h-32 animate-pulse rounded-xl bg-muted/30" />
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {/* Progress section */}
      <div className="rounded-2xl border border-border/50 bg-gradient-to-r from-card to-card/80 p-5 shadow-sm">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-3xl font-bold tabular-nums text-foreground">
              {progressPct}%
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {book.meta.totalPages
                ? `${Math.round(book.meta.totalPages * book.progress)} / ${book.meta.totalPages} ${t("bookInfo.pages")}`
                : t("bookInfo.progress")}
            </div>
          </div>
          {stats.streak > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1">
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                {t("bookInfo.streak", { count: stats.streak })}
              </span>
            </div>
          )}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-1000 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Stats grid — 3×2 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          value={formatTime(stats.totalMinutes)}
          label={t("bookInfo.totalTime")}
          color="blue"
        />
        <StatCard
          icon={<Type className="h-4 w-4" />}
          value={stats.totalChars > 0 ? t("bookInfo.tenThousandChars", { value: (stats.totalChars / 10000).toFixed(1) }) : "—"}
          label={t("bookInfo.totalCharacters")}
          color="violet"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          value={stats.speed > 0 ? `${stats.speed}` : "—"}
          sublabel={stats.speed > 0 ? t("bookInfo.charsPerMin") : ""}
          label={t("bookInfo.readingSpeed")}
          color="emerald"
        />
        <StatCard
          icon={<Zap className="h-4 w-4" />}
          value={String(stats.sessionCount)}
          label={t("bookInfo.readingSessions", { count: stats.sessionCount })}
          color="amber"
        />
        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          value={String(stats.activeDays)}
          label={t("bookInfo.activeDays", { count: stats.activeDays })}
          color="rose"
        />
        <StatCard
          icon={<BookOpen className="h-4 w-4" />}
          value={book.lastOpenedAt ? formatRelativeDate(book.lastOpenedAt) : "—"}
          label={t("bookInfo.lastRead")}
          color="slate"
        />
      </div>

      {/* Reading timeline */}
      {sessions.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            {t("bookInfo.readingTimeline")}
          </h3>
          <ReadingTimeline sessions={sessions} />
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

const COLOR_MAP: Record<string, { bg: string; text: string; icon: string }> = {
  blue: { bg: "bg-blue-500/8", text: "text-blue-600 dark:text-blue-400", icon: "text-blue-500" },
  violet: { bg: "bg-violet-500/8", text: "text-violet-600 dark:text-violet-400", icon: "text-violet-500" },
  emerald: { bg: "bg-emerald-500/8", text: "text-emerald-600 dark:text-emerald-400", icon: "text-emerald-500" },
  amber: { bg: "bg-amber-500/8", text: "text-amber-600 dark:text-amber-400", icon: "text-amber-500" },
  rose: { bg: "bg-rose-500/8", text: "text-rose-600 dark:text-rose-400", icon: "text-rose-500" },
  slate: { bg: "bg-muted/50", text: "text-foreground", icon: "text-muted-foreground" },
};

function StatCard({
  icon,
  value,
  sublabel,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: string;
  sublabel?: string;
  label: string;
  color: string;
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.slate;
  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-xl border border-border/30 ${c.bg} px-3 py-4 transition-all duration-150 hover:shadow-sm`}
    >
      <span className={c.icon}>{icon}</span>
      <div className="flex items-baseline gap-0.5">
        <span className={`text-lg font-bold tabular-nums ${c.text}`}>{value}</span>
        {sublabel && (
          <span className="text-[9px] text-muted-foreground">{sublabel}</span>
        )}
      </div>
      <span className="text-[10px] leading-tight text-muted-foreground text-center">
        {label}
      </span>
    </div>
  );
}

function ReadingTimeline({ sessions }: { sessions: ReadingSession[] }) {
  const dailyData = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      if (!s.startedAt) continue;
      const day = new Date(s.startedAt).toISOString().slice(0, 10);
      map.set(day, (map.get(day) || 0) + (s.totalActiveTime || 0));
    }
    return [...map.entries()]
      .sort()
      .slice(-14)
      .map(([date, ms]) => ({
        date,
        minutes: Math.round(ms / 60000),
        label: new Date(date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      }));
  }, [sessions]);

  if (dailyData.length === 0) return null;
  const maxMin = Math.max(...dailyData.map((d) => d.minutes), 1);

  return (
    <div className="rounded-xl border border-border/40 bg-card/50 p-4">
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {dailyData.map((d) => {
          const h = Math.max((d.minutes / maxMin) * 96, 3);
          return (
            <div
              key={d.date}
              className="group relative flex flex-1 flex-col items-center"
            >
              {/* Tooltip */}
              <div className="absolute -top-7 z-10 hidden rounded-md bg-foreground/85 px-2 py-1 text-xs text-background shadow-sm group-hover:block">
                {d.minutes}m
              </div>
              {/* Bar */}
              <div
                className="w-full rounded-t-sm bg-primary/60 transition-all duration-200 hover:bg-primary"
                style={{ height: h }}
              />
              {/* Label */}
              <span className="mt-1.5 text-[8px] text-muted-foreground/60 whitespace-nowrap">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
