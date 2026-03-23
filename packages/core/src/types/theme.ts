/**
 * Theme system types — defines the structure for custom themes
 *
 * Architecture:
 * - ThemeConfig: a complete theme package (1-2 modes + typography + icons + images)
 * - ThemeModeColors: color palette for a single mode (light or dark)
 * - DerivedColors: auto-computed variables not exposed to users
 * - ActiveThemeSelection: what the user currently has selected
 */

// ─── Color Palette ──────────────────────────────────────────

/**
 * Single mode's color palette — all hex strings.
 *
 * 4 background levels:
 *   L0: page base  (background / foreground)
 *   L1: sidebar    (sidebar / sidebarForeground)
 *   L2: cards      (card / cardForeground)
 *   L3: muted      (muted / mutedForeground)
 */
export interface ThemeModeColors {
  // L0: Page base
  background: string;
  foreground: string;
  // L1: Sidebar
  sidebar: string;
  sidebarForeground: string;
  // L2: Cards, panels, popups
  card: string;
  cardForeground: string;
  // L3: Sections, tags, hover states
  muted: string;
  mutedForeground: string;
  // Functional colors
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  // Reader (independent layer)
  reader: {
    background: string;
    foreground: string;
    linkColor: string;
  };
}

/**
 * Auto-derived CSS variables — not exposed to theme authors.
 * Computed from ThemeModeColors by the theme engine.
 */
export interface DerivedColors {
  popover: string;
  popoverForeground: string;
  secondary: string;
  secondaryForeground: string;
  destructive: string;
  destructiveForeground: string;
  input: string;
  ring: string;
}

// ─── Typography ─────────────────────────────────────────────

export interface ThemeTypography {
  /** App-wide sans-serif font family */
  fontSans?: string;
  /** App-wide serif font family */
  fontSerif?: string;
  /** App-wide monospace font family */
  fontMono?: string;
  /** Reader font theme ID — references FONT_THEMES[].id from core/reader/font-themes.ts */
  readerFontThemeId?: string;
}

// ─── Background Images ──────────────────────────────────────

export interface ThemeBackgroundImages {
  /** App background texture (Base64 WebP data URI, ≤500KB) */
  backgroundImage?: string;
  /** Reader background texture (Base64 WebP data URI, ≤500KB) */
  readerBackgroundImage?: string;
}

/**
 * When a background image is present, overlay layers (sidebar/card/muted)
 * render with semi-transparent backgrounds. These control the opacity.
 */
export interface ThemeOverlayOpacity {
  /** Sidebar overlay opacity (0–1, default 0.85) */
  sidebar?: number;
  /** Card/panel overlay opacity (0–1, default 0.9) */
  card?: number;
  /** Muted section overlay opacity (0–1, default 0.8) */
  muted?: number;
}

// ─── Icon Overrides ─────────────────────────────────────────

/**
 * Replaceable icons — SVG strings for Tab bar and Sidebar slots.
 * Only 8 icons are customizable (the most visible ones).
 */
export interface ThemeIcons {
  // Shared (both desktop sidebar + mobile tab bar)
  bookOpen?: string;
  messageSquare?: string;
  notebookPen?: string;
  // Mobile tab bar only
  user?: string;
  // Desktop sidebar only
  puzzle?: string;
  barChart3?: string;
  helpCircle?: string;
  settings?: string;
}

/** All possible icon slot names */
export type IconSlot = keyof ThemeIcons;

// ─── Theme Config ───────────────────────────────────────────

/**
 * A complete theme configuration.
 *
 * - `modes` must have at least one key (light or dark or both)
 * - Built-in themes (Classic, Eye Care) have `builtIn: true` and cannot be deleted
 * - Custom themes are created by users or imported via theme codes
 */
export interface ThemeConfig {
  /** Unique identifier (nanoid for custom, "builtin-*" for built-in) */
  id: string;
  /** Display name */
  name: string;
  /** Theme author (optional, shown when sharing) */
  author?: string;
  /** Whether this is a built-in theme (cannot be deleted) */
  builtIn: boolean;
  /** Color modes — at least one required */
  modes: {
    light?: ThemeModeColors;
    dark?: ThemeModeColors;
  };
  /** Font customization */
  typography?: ThemeTypography;
  /** Background images */
  backgroundImages?: ThemeBackgroundImages;
  /** Overlay opacity when background images are present */
  overlayOpacity?: ThemeOverlayOpacity;
  /** Custom icons (SVG strings) */
  icons?: ThemeIcons;
  /** Timestamps */
  createdAt: number;
  updatedAt: number;
}

// ─── Runtime Selection ──────────────────────────────────────

/**
 * What the user has actively selected at runtime.
 * Stored in the theme store and persisted.
 */
export interface ActiveThemeSelection {
  /** Which ThemeConfig to use */
  themeId: string;
  /** Which mode within that theme — "auto" follows system preference */
  preferredMode: "light" | "dark" | "auto";
}

// ─── Theme Code (Sharing) ───────────────────────────────────

/** Prefix for encoded theme codes */
export const THEME_CODE_PREFIX = "RA-THEME:";

/**
 * Portable theme data — the subset of ThemeConfig included in theme codes.
 * Excludes id, builtIn, timestamps (assigned on import).
 */
export interface PortableTheme {
  name: string;
  author?: string;
  modes: ThemeConfig["modes"];
  typography?: ThemeTypography;
  backgroundImages?: ThemeBackgroundImages;
  overlayOpacity?: ThemeOverlayOpacity;
  icons?: ThemeIcons;
}
