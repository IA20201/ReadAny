/**
 * CalendarSection.tsx — Month calendar grid with day cells.
 * Desktop behavior intentionally matches mobile stats calendar.
 */
import type { MonthReport, StatsCalendarCell } from "@readany/core/stats";
import { cn } from "@readany/core/utils";
import { useMemo, useState } from "react";
import { CoverThumb } from "./StatsShared";
import { formatCompactMinutes, intensityClass } from "./stats-utils";

export function MonthCalendarSection({
  calendar,
  isZh,
}: {
  calendar: NonNullable<MonthReport["readingCalendar"]>;
  isZh: boolean;
}) {
  const locale = isZh ? "zh-CN" : "en-US";
  const weekLabels = useMemo(() => {
    const monday = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
    });
  }, [locale]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-2.5">
        {weekLabels.map((label) => (
          <div
            key={label}
            className="px-1 text-center text-[11px] font-medium text-muted-foreground/35"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="space-y-2.5">
        {calendar.weeks.map((week, index) => (
          <div key={`${calendar.monthKey}-${index}`} className="grid grid-cols-7 gap-2.5">
            {week.map((cell) => (
              <CalendarDayCell key={cell.date} cell={cell} isZh={isZh} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarDayCell({
  cell,
  isZh,
}: {
  cell: StatsCalendarCell;
  isZh: boolean;
}) {
  const [coverIndex, setCoverIndex] = useState(0);
  const hasCovers = cell.covers.length > 0;
  const multipleCovers = cell.covers.length > 1;
  const currentCover = hasCovers ? cell.covers[coverIndex % cell.covers.length] : null;

  const titleText =
    cell.totalTime > 0
      ? `${cell.date} · ${formatCompactMinutes(cell.totalTime, isZh)}`
      : `${cell.date} · ${isZh ? "无阅读" : "No reading"}`;

  if (currentCover) {
    const shellClassName = cn(
      "relative aspect-[28/41] overflow-hidden rounded-[14px] border border-border/30 shadow-[0_10px_28px_rgba(120,92,46,0.08)] transition-all duration-200",
      "hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(120,92,46,0.12)]",
      cell.isToday && "ring-1.5 ring-primary/25 ring-offset-1 ring-offset-background",
      !cell.inCurrentMonth && "opacity-55",
      multipleCovers && "cursor-pointer",
    );

    const content = (
      <>
        <CoverThumb
          title={currentCover.title}
          coverUrl={currentCover.coverUrl}
          className="absolute inset-0 h-full w-full rounded-[14px]"
          fallbackClassName="text-[9px] font-bold"
        />

        <div className="absolute inset-y-0 left-0 z-[2] flex w-[8%] flex-row">
          <div className="h-full w-[6%] bg-black/10" />
          <div className="h-full w-[8%] bg-neutral-950/20" />
          <div className="h-full w-[5%] bg-neutral-100/40" />
          <div className="h-full w-[18%] bg-neutral-200/35" />
          <div className="h-full w-[12%] bg-neutral-400/25" />
          <div className="h-full w-[20%] bg-neutral-500/18" />
          <div className="h-full w-[31%] bg-neutral-300/12" />
        </div>

        <div className="absolute inset-x-0 top-0 z-[3] h-[40%] bg-gradient-to-b from-black/32 via-black/10 to-transparent" />

        <div className="absolute inset-0 z-[4] flex flex-col justify-between p-2">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[13px] font-semibold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
              {cell.dayOfMonth}
            </span>
            {cell.totalTime > 0 && (
              <span className="text-[10px] font-semibold tabular-nums text-white/92 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
                {formatCompactMinutes(cell.totalTime, isZh)}
              </span>
            )}
          </div>

          {multipleCovers && (
            <div className="flex justify-end">
              <span className="text-[10px] font-semibold tabular-nums text-white/92 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                {(coverIndex % cell.covers.length) + 1}/{cell.covers.length}
              </span>
            </div>
          )}
        </div>
      </>
    );

    if (multipleCovers) {
      return (
        <button
          type="button"
          title={titleText}
          onClick={() => setCoverIndex((prev) => (prev + 1) % cell.covers.length)}
          className={shellClassName}
        >
          {content}
        </button>
      );
    }

    return (
      <div title={titleText} className={shellClassName}>
        {content}
      </div>
    );
  }

  return (
    <div
      title={titleText}
      className={cn(
        "flex aspect-[28/41] flex-col rounded-[14px] border p-2 transition-all duration-200",
        intensityClass(cell.intensity, cell.inCurrentMonth),
        cell.isToday && "ring-1.5 ring-primary/25 ring-offset-1 ring-offset-background",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={cn(
            "text-[13px] font-semibold tabular-nums",
            cell.inCurrentMonth ? "text-foreground/78" : "text-muted-foreground/25",
            cell.isToday && "text-primary/72",
          )}
        >
          {cell.dayOfMonth}
        </span>
        {cell.totalTime > 0 && (
          <span className="text-[10px] font-medium tabular-nums text-foreground/46">
            {formatCompactMinutes(cell.totalTime, isZh)}
          </span>
        )}
      </div>
    </div>
  );
}
