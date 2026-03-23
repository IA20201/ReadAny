/**
 * Derive auto-computed CSS variables from the user-facing ThemeModeColors.
 * These variables are NOT exposed to theme authors.
 */
import type { DerivedColors, ThemeModeColors } from "../types/theme";

/**
 * Compute derived colors from the exposed palette.
 *
 * Mapping:
 *   popover          = card          (floating panels share card bg)
 *   secondary        = muted         (secondary elements = muted areas)
 *   destructive      = fixed red     (per mode)
 *   input            = border        (input borders = general borders)
 *   ring             = primary       (focus ring = primary accent)
 */
export function deriveColors(
  colors: ThemeModeColors,
  isDark: boolean,
): DerivedColors {
  return {
    popover: colors.card,
    popoverForeground: colors.cardForeground,
    secondary: colors.muted,
    secondaryForeground: colors.mutedForeground,
    destructive: isDark ? "#e53935" : "#dc2626",
    destructiveForeground: isDark ? "#ffffff" : "#fafafa",
    input: colors.border,
    ring: colors.primary,
  };
}
