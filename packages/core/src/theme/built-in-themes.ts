/**
 * Built-in themes — Classic (light+dark) and Eye Care (warm light+dark).
 *
 * These are always present and cannot be deleted.
 * Values are derived from the original globals.css / ThemeContext.tsx definitions.
 */
import type { ActiveThemeSelection, ThemeConfig } from "../types/theme";

// ─── Classic Theme ──────────────────────────────────────────

const classicTheme: ThemeConfig = {
  id: "builtin-classic",
  name: "Classic",
  builtIn: true,
  modes: {
    light: {
      background: "#faf9f5",
      foreground: "#1c1c1e",
      sidebar: "#ffffff",
      sidebarForeground: "#1c1c1e",
      card: "#ffffff",
      cardForeground: "#1c1c1e",
      muted: "#f2f1ed",
      mutedForeground: "#7c7c82",
      primary: "#2d2d30",
      primaryForeground: "#fafafa",
      accent: "#f5f5f5",
      accentForeground: "#2d2d30",
      border: "#e5e5e5",
      reader: {
        background: "#ffffff",
        foreground: "#1a1a1a",
        linkColor: "#2563eb",
      },
    },
    dark: {
      background: "#1c1c1e",
      foreground: "#e8e8ed",
      sidebar: "#242426",
      sidebarForeground: "#e8e8ed",
      card: "#2c2c2e",
      cardForeground: "#e8e8ed",
      muted: "#333336",
      mutedForeground: "#7c7c82",
      primary: "#e0e0e6",
      primaryForeground: "#1c1c1e",
      accent: "#363638",
      accentForeground: "#e0e0e6",
      border: "#3d3d40",
      reader: {
        background: "#1c1c1e",
        foreground: "#e8e8ed",
        linkColor: "#60a5fa",
      },
    },
  },
  createdAt: 0,
  updatedAt: 0,
};

// ─── Eye Care Theme ─────────────────────────────────────────

const eyeCareTheme: ThemeConfig = {
  id: "builtin-eyecare",
  name: "Eye Care",
  builtIn: true,
  modes: {
    light: {
      // Original "sepia" theme values
      background: "#f0e6d2",
      foreground: "#3d2b1f",
      sidebar: "#f5ebd7",
      sidebarForeground: "#3d2b1f",
      card: "#f5ebd7",
      cardForeground: "#3d2b1f",
      muted: "#e6d9c3",
      mutedForeground: "#7a6652",
      primary: "#6b4c2a",
      primaryForeground: "#f5ebd7",
      accent: "#e6d9c3",
      accentForeground: "#4a3728",
      border: "#d4c4a8",
      reader: {
        background: "#f0e6d2",
        foreground: "#3d2b1f",
        linkColor: "#6b4c2a",
      },
    },
    dark: {
      // New: warm-toned dark mode — deep brown base with warm text
      background: "#1f1a14",
      foreground: "#e0d5c5",
      sidebar: "#261f17",
      sidebarForeground: "#e0d5c5",
      card: "#2a231a",
      cardForeground: "#e0d5c5",
      muted: "#33291f",
      mutedForeground: "#9a8b78",
      primary: "#c9a96e",
      primaryForeground: "#1f1a14",
      accent: "#3d3228",
      accentForeground: "#d4c4a8",
      border: "#443929",
      reader: {
        background: "#1f1a14",
        foreground: "#e0d5c5",
        linkColor: "#c9a96e",
      },
    },
  },
  createdAt: 0,
  updatedAt: 0,
};

// ─── Exports ────────────────────────────────────────────────

export const BUILT_IN_THEMES: ThemeConfig[] = [classicTheme, eyeCareTheme];

/** Default selection: Classic theme with auto mode */
export const DEFAULT_SELECTION: ActiveThemeSelection = {
  themeId: "builtin-classic",
  preferredMode: "auto",
};

/**
 * Migration: map old theme mode string to new selection.
 * Called once on first hydration to convert from the legacy system.
 */
export function migrateFromLegacyTheme(
  oldTheme: string | null,
): ActiveThemeSelection {
  switch (oldTheme) {
    case "light":
      return { themeId: "builtin-classic", preferredMode: "light" };
    case "dark":
      return { themeId: "builtin-classic", preferredMode: "dark" };
    case "sepia":
      return { themeId: "builtin-eyecare", preferredMode: "light" };
    default:
      return { ...DEFAULT_SELECTION };
  }
}
