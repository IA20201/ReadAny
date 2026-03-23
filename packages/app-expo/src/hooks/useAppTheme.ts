/**
 * useAppTheme — bridge hook that replaces the old ThemeContext.
 *
 * Internally uses the core useThemeStore + resolveRNThemeColors so the
 * entire app's theme source is unified through the core store.
 *
 * The returned API shape is compatible with the old useTheme() to minimise
 * migration churn:
 *   { mode, colors, setMode, isDark, activeThemeId, activeThemeConfig }
 */
import { useCallback, useMemo } from "react";
import { useThemeStore } from "@readany/core/stores";
import { resolveRNThemeColors } from "@readany/core/theme/apply-theme-rn";
import type { RNThemeColors } from "@readany/core/theme/apply-theme-rn";
import type { ThemeConfig } from "@readany/core/types";

export type { RNThemeColors };

/** Legacy mode type kept for backward-compatible API */
export type ThemeMode = "light" | "dark" | "auto";

export interface AppThemeValue {
  /** Resolved effective mode (never "auto") */
  mode: "light" | "dark";
  /** Full color set ready for RN components */
  colors: RNThemeColors;
  /** Convenience flag */
  isDark: boolean;
  /**
   * Set the preferred mode for the active theme.
   * Accepts "light" | "dark" | "auto".
   */
  setMode: (m: "light" | "dark" | "auto") => void;
  /** Currently active theme id */
  activeThemeId: string;
  /** Currently active ThemeConfig (full) */
  activeThemeConfig: ThemeConfig;
}

export function useAppTheme(): AppThemeValue {
  const activeThemeConfig = useThemeStore((s) => s.getActiveTheme());
  const mode = useThemeStore((s) => s.getActiveMode());
  const setPreferredMode = useThemeStore((s) => s.setPreferredMode);
  const activeThemeId = useThemeStore((s) => s.activeSelection.themeId);

  const colors = useMemo(
    () => resolveRNThemeColors(activeThemeConfig, mode),
    [activeThemeConfig, mode],
  );

  const setMode = useCallback(
    (m: "light" | "dark" | "auto") => {
      setPreferredMode(m);
    },
    [setPreferredMode],
  );

  return {
    mode,
    colors,
    isDark: mode === "dark",
    setMode,
    activeThemeId,
    activeThemeConfig,
  };
}
