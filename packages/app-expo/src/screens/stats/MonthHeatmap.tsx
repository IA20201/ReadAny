/**
 * MonthHeatmap.tsx — Calendar-grid heatmap for a single month.
 * Shows intensity-colored cells for each day with reading data.
 */
import { useColors, withOpacity } from "@/styles/theme";
import type { StatsChartBlock } from "@readany/core/stats";
import { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { makeStyles } from "./stats-styles";
import { formatCompactMinutes } from "./stats-utils";
import type { StatsCopy } from "./StatsSections";

export function MonthHeatmap({
  chart,
  isZh,
  copy,
}: {
  chart: StatsChartBlock;
  isZh: boolean;
  copy: StatsCopy;
}) {
  const colors = useColors();
  const s = makeStyles(colors);
  const locale = isZh ? "zh-CN" : "en-US";

  // Build a date→value map
  const valueMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of chart.data) m.set(d.key, d.value);
    return m;
  }, [chart.data]);

  const maxVal = useMemo(
    () => Math.max(...chart.data.map((d) => d.value), 1),
    [chart.data],
  );

  // Derive month/year from first data point
  const firstDate = chart.data[0]?.key;
  const year = firstDate ? Number(firstDate.slice(0, 4)) : new Date().getFullYear();
  const month = firstDate ? Number(firstDate.slice(5, 7)) - 1 : new Date().getMonth();

  // Build weeks grid (Mon = 0)
  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    // Monday-based: Mon=0 .. Sun=6
    const startDow = (firstDay.getDay() + 6) % 7;

    const rows: { day: number; dateKey: string; value: number }[][] = [];
    let currentRow: { day: number; dateKey: string; value: number }[] = [];

    // Pad leading empty cells
    for (let i = 0; i < startDow; i++) {
      currentRow.push({ day: 0, dateKey: "", value: -1 });
    }

    for (let d = 1; d <= totalDays; d++) {
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      const key = `${year}-${mm}-${dd}`;
      currentRow.push({ day: d, dateKey: key, value: valueMap.get(key) ?? 0 });

      if (currentRow.length === 7) {
        rows.push(currentRow);
        currentRow = [];
      }
    }

    // Pad trailing empty cells
    if (currentRow.length > 0) {
      while (currentRow.length < 7) {
        currentRow.push({ day: 0, dateKey: "", value: -1 });
      }
      rows.push(currentRow);
    }

    return rows;
  }, [year, month, valueMap]);

  // Weekday labels
  const weekLabels = useMemo(() => {
    const monday = new Date(2024, 0, 1); // Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(d);
    });
  }, [locale]);

  const getColor = (value: number): string => {
    if (value <= 0) return withOpacity(colors.muted, 0.3);
    const ratio = value / maxVal;
    if (ratio < 0.2) return withOpacity(colors.primary, 0.12);
    if (ratio < 0.4) return withOpacity(colors.primary, 0.2);
    if (ratio < 0.6) return withOpacity(colors.primary, 0.3);
    if (ratio < 0.8) return withOpacity(colors.primary, 0.42);
    return withOpacity(colors.primary, 0.56);
  };

  const todayKey = (() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${mm}-${dd}`;
  })();

  const [selected, setSelected] = useState<{ day: number; value: number; dateKey: string } | null>(null);

  return (
    <View style={{ gap: 6 }}>
      {/* Weekday header */}
      <View style={{ flexDirection: "row" }}>
        {weekLabels.map((label, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 10, color: withOpacity(colors.mutedForeground, 0.4) }}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: "row", gap: 3 }}>
          {week.map((cell, ci) => {
            if (cell.day === 0) {
              return <View key={`empty-${ci}`} style={{ flex: 1, aspectRatio: 1 }} />;
            }
            const isToday = cell.dateKey === todayKey;
            return (
              <TouchableOpacity
                key={cell.dateKey}
                activeOpacity={0.7}
                onPress={() => {
                  setSelected(
                    selected?.dateKey === cell.dateKey
                      ? null
                      : { day: cell.day, value: cell.value, dateKey: cell.dateKey },
                  );
                  if (selected?.day !== cell.day) setTimeout(() => setSelected(null), 2000);
                }}
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  borderRadius: 4,
                  backgroundColor: getColor(cell.value),
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: isToday ? 1.5 : 0,
                  borderColor: isToday ? withOpacity(colors.primary, 0.35) : "transparent",
                }}
              >
                <Text style={{
                  fontSize: 9,
                  fontWeight: "600",
                  color: cell.value > 0
                    ? withOpacity(colors.foreground, 0.7)
                    : withOpacity(colors.mutedForeground, 0.35),
                }}>
                  {cell.day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Legend + selected tooltip */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        <View style={s.heatmapLegend}>
          <Text style={s.legendText}>{copy.heatmapLegendLow}</Text>
          {[
            withOpacity(colors.muted, 0.3),
            withOpacity(colors.primary, 0.12),
            withOpacity(colors.primary, 0.2),
            withOpacity(colors.primary, 0.42),
            withOpacity(colors.primary, 0.56),
          ].map((c, i) => (
            <View key={i} style={[s.legendCell, { backgroundColor: c }]} />
          ))}
          <Text style={s.legendText}>{copy.heatmapLegendHigh}</Text>
        </View>

        {selected && (
          <Text style={{ fontSize: 11, color: withOpacity(colors.foreground, 0.6) }}>
            {new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric" }).format(
              new Date(`${selected.dateKey}T00:00:00`),
            )}{" "}
            · {formatCompactMinutes(selected.value, isZh)}
          </Text>
        )}
      </View>
    </View>
  );
}
