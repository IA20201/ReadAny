/**
 * ColorSlotRow — a single color slot row showing swatch + label + hex value.
 */
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/styles/theme";
import { fontSize, fontWeight, spacing } from "@/styles/theme";

interface Props {
  label: string;
  color: string;
  onPress: () => void;
  isLast?: boolean;
  disabled?: boolean;
}

export function ColorSlotRow({ label, color, onPress, isLast, disabled }: Props) {
  const uiColors = useColors();

  return (
    <TouchableOpacity
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: uiColors.border },
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
        <Text style={[styles.hex, { color: uiColors.mutedForeground }]}>{color}</Text>
      </View>
      {!disabled && (
        <Text style={{ color: uiColors.mutedForeground, fontSize: 18 }}>›</Text>
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
  hex: {
    fontSize: fontSize.xs,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
