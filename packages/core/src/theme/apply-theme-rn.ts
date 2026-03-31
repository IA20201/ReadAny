/**
 * Mobile theme engine — converts ThemeConfig into the ThemeColors shape
 * expected by React Native components (ThemeContext).
 *
 * Highlight colors and functional colors (indigo, emerald, etc.) are kept
 * static as they're independent of user theming.
 */
import type { ThemeConfig, ThemeOverlayOpacity } from "../types/theme";
import { deriveColors } from "./derive-colors";

export type OverlayOpacity = ThemeOverlayOpacity;

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * The color shape consumed by mobile components via useTheme()/useColors().
 * Matches the existing ThemeColors interface in ThemeContext.tsx.
 */
export interface RNThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  primary: string;
  primaryForeground: string;
  destructive: string;
  destructiveForeground: string;
  accent: string;
  accentForeground: string;
  // Static functional colors
  indigo: string;
  emerald: string;
  amber: string;
  blue: string;
  violet: string;
  // Highlight colors (independent of theming)
  highlightYellow: string;
  highlightGreen: string;
  highlightBlue: string;
  highlightPink: string;
  highlightPurple: string;
  // Fallback cover gradients
  stone100: string;
  stone200: string;
  stone300: string;
  stone400: string;
  stone500: string;
  // Background image support
  backgroundImage?: string;
  overlayOpacity: OverlayOpacity;
}

/**
 * Resolve a ThemeConfig + mode into the RN color set.
 */
export function resolveRNThemeColors(
  config: ThemeConfig,
  mode: "light" | "dark",
): RNThemeColors {
  const colors = config.modes[mode];
  if (!colors) {
    // Fallback to whichever mode is available
    const fallbackMode = config.modes.light ? "light" : "dark";
    return resolveRNThemeColors(config, fallbackMode);
  }

  const isDark = mode === "dark";
  const derived = deriveColors(colors, isDark);
  const hasBgImage = !!config.backgroundImages?.backgroundImage;
  const overlayOpacity = config.overlayOpacity ?? { sidebar: 0.85, card: 0.9, muted: 0.8 };

  // Apply transparency when background image is set
  const bgColor = hasBgImage ? "transparent" : colors.background;
  const cardColor = hasBgImage 
    ? hexToRgba(colors.card, overlayOpacity.card ?? 0.9) 
    : colors.card;
  const mutedColor = hasBgImage 
    ? hexToRgba(colors.muted, overlayOpacity.muted ?? 0.8) 
    : colors.muted;

  return {
    background: bgColor,
    foreground: colors.foreground,
    card: cardColor,
    cardForeground: colors.cardForeground,
    muted: mutedColor,
    mutedForeground: colors.mutedForeground,
    border: colors.border,
    primary: colors.primary,
    primaryForeground: colors.primaryForeground,
    destructive: derived.destructive,
    destructiveForeground: derived.destructiveForeground,
    accent: colors.accent,
    accentForeground: colors.accentForeground,

    // Static functional colors — same for all themes
    indigo: "#6366f1",
    emerald: "#10b981",
    amber: "#f59e0b",
    blue: "#3b82f6",
    violet: isDark ? "#a78bfa" : "#7c3aed",

    // Highlight colors — separate from theming, mode-aware
    highlightYellow: isDark ? "#854d0e" : "#fef08a",
    highlightGreen: isDark ? "#166534" : "#bbf7d0",
    highlightBlue: isDark ? "#1e40af" : "#bfdbfe",
    highlightPink: isDark ? "#9d174d" : "#fbcfe8",
    highlightPurple: isDark ? "#6b21a8" : "#e9d5ff",

    // Stone palette — static
    stone100: "#f5f5f4",
    stone200: "#e7e5e4",
    stone300: "#d6d3d1",
    stone400: "#a8a29e",
    stone500: "#78716c",

    // Background image support
    backgroundImage: hasBgImage ? config.backgroundImages!.backgroundImage : undefined,
    overlayOpacity,
  };
}
