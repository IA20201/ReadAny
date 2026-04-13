import { useColors } from "@/styles/theme";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { makeStyles } from "./stats-styles";
import { formatTime } from "./stats-utils";

export function BarChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const colors = useColors();
  const s = makeStyles(colors);
  const { t } = useTranslation();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const maxVal = Math.max(1, ...data.map((d) => d.value));
  const BAR_HEIGHT = 140;
  const Y_AXIS_WIDTH = 32;

  const yTicks = [0, maxVal * 0.5, maxVal].map((v) => ({
    value: v,
    label: v < 60 ? `${Math.round(v)}m` : `${(v / 60).toFixed(1)}h`,
  }));

  if (data.length === 0) {
    return (
      <View style={s.barChartEmpty}>
        <Text style={s.barChartEmptyText}>{t("stats.noData", "暂无数据")}</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => setSelectedIdx(null)}
      style={[s.barChartWrap, { flexDirection: "row" }]}
    >
      <View style={{ width: Y_AXIS_WIDTH, height: BAR_HEIGHT + 20, justifyContent: "space-between", paddingRight: 4 }}>
        {yTicks.map((tick, i) => (
          <Text key={i} style={{ fontSize: 8, color: colors.mutedForeground, textAlign: "right" }}>
            {tick.label}
          </Text>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.barChartContent}>
        {data.map((item, idx) => (
          <TouchableOpacity
            key={`${item.label}-${idx}`}
            style={s.barCol}
            onPress={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
            activeOpacity={0.7}
          >
            <View style={[s.barTrack, { height: BAR_HEIGHT }]}>
              <View
                style={[
                  s.barFill,
                  {
                    height: Math.max(2, (item.value / maxVal) * BAR_HEIGHT),
                    backgroundColor: item.value > 0 ? colors.emerald : colors.muted,
                  },
                ]}
              />
            </View>
            <Text style={s.barLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {selectedIdx !== null && data[selectedIdx] && data[selectedIdx].value > 0 && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: Y_AXIS_WIDTH + 8 + selectedIdx * 28 + 14,
            top: BAR_HEIGHT - (data[selectedIdx].value / maxVal) * BAR_HEIGHT - 24,
            backgroundColor: colors.card,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 4,
            borderWidth: 0.5,
            borderColor: colors.border,
            minWidth: 50,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 2,
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 12, color: colors.cardForeground, fontWeight: "500", textAlign: "center" }}>
            {formatTime(data[selectedIdx].value)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
