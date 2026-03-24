/**
 * ColorSlotRow — a single color slot row showing swatch + label + hex value.
 *
 * When `expanded` is true, shows a highlight style. The actual color picker
 * is rendered OUTSIDE the ScrollView by the parent screen to avoid gesture conflicts.
 */
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/styles/theme";
import { fontSize, fontWeight, spacing } from "@/styles/theme";

interface Props {
  label: string;
  description?: string;
  color: string;
  onPress: () => void;
  isLast?: boolean;
  disabled?: boolean;
  expanded?: boolean;
}

export function ColorSlotRow({ label, description, color, onPress, isLast, disabled, expanded }: Props) {
  const uiColors = useColors();

  return (
    <TouchableOpacity
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: uiColors.border },
        expanded && { backgroundColor: uiColors.primary + "0D" },
      ]}
      onPress={onPress}
      activeOpacity={disabled ? 1 : 0.7}
      disabled={disabled}
    >
      <View style={[styles.swatch, { backgroundColor: color, borderColor: uiColors.border }]} />
      <View style={styles.info}>
        <Text style={[styles.label, { color: uiColors.foreground }]} numberOfLines={1}>
          {label}
        </Text>
        {description ? (
          <Text style={[styles.desc, { color: uiColors.mutedForeground }]} numberOfLines={1}>
            {description}
          </Text>
        ) : null}
        <Text style={[styles.hex, { color: uiColors.mutedForeground }]}>{color}</Text>
      </View>
      {!disabled && (
        <Text style={{ color: expanded ? uiColors.primary : uiColors.mutedForeground, fontSize: 18 }}>
          {expanded ? "\u02C5" : "\u203A"}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    gap: 12,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
  },
  info: {
    flex: 1,
    gap: 1,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  desc: {
    fontSize: fontSize.xs,
    opacity: 0.7,
  },
  hex: {
    fontSize: fontSize.xs,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
