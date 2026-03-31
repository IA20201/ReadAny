/**
 * Theme constants & helpers.
 *
 * `useTheme()` now delegates to useAppTheme (backed by core's useThemeStore).
 * `ThemeColors` is aliased from RNThemeColors for backward compat.
 */
import { useAppTheme } from "@/hooks/useAppTheme";
import type { RNThemeColors } from "@/hooks/useAppTheme";

/** Backward-compatible alias */
export type ThemeColors = RNThemeColors;

/** Re-export the bridge hook under the old name */
export function useTheme() {
  return useAppTheme();
}

/**
 * Convert a hex color to an rgba string with the given opacity.
 * Accepts 3-digit (#abc) or 6-digit (#aabbcc) hex values.
 */
export function withOpacity(hex: string, opacity: number): string {
  let r: number, g: number, b: number;
  const h = hex.replace("#", "");
  if (h.length === 3) {
    r = Number.parseInt(h[0] + h[0], 16);
    g = Number.parseInt(h[1] + h[1], 16);
    b = Number.parseInt(h[2] + h[2], 16);
  } else {
    r = Number.parseInt(h.slice(0, 2), 16);
    g = Number.parseInt(h.slice(2, 4), 16);
    b = Number.parseInt(h.slice(4, 6), 16);
  }
  return `rgba(${r},${g},${b},${opacity})`;
}

/** @deprecated Use useColors() instead for theme-aware components */
export const colors: ThemeColors = {
  background: "#1c1c1e",
  foreground: "#e8e8ed",
  card: "#2c2c2e",
  cardForeground: "#e8e8ed",
  muted: "#333336",
  mutedForeground: "#7c7c82",
  border: "#3d3d40",
  primary: "#e0e0e6",
  primaryForeground: "#1c1c1e",
  destructive: "#e53935",
  destructiveForeground: "#ffffff",
  accent: "#363638",
  accentForeground: "#e0e0e6",
  indigo: "#6366f1",
  emerald: "#10b981",
  amber: "#f59e0b",
  blue: "#3b82f6",
  violet: "#a78bfa",
  highlightYellow: "#854d0e",
  highlightGreen: "#166534",
  highlightBlue: "#1e40af",
  highlightPink: "#9d174d",
  highlightPurple: "#6b21a8",
  stone100: "#f5f5f4",
  stone200: "#e7e5e4",
  stone300: "#d6d3d1",
  stone400: "#a8a29e",
  stone500: "#78716c",
  overlayOpacity: { sidebar: 0.85, card: 0.9, muted: 0.8 },
};

/**
 * Hook to get current theme colors. Use this in component function bodies
 * so the local `colors` variable shadows the static import, making
 * StyleSheet.create fallback to dark while inline styles use the real theme.
 */
export function useColors() {
  return useTheme().colors;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 16,
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  md: 18,
  lg: 20,
  xl: 22,
  "2xl": 26,
  "3xl": 30,
} as const;

export const fontWeight = {
  normal: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
};
