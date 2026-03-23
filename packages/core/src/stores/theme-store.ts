/**
 * Theme Store — manages custom themes, active selection, and persistence.
 *
 * Uses zustand + withPersist for cross-platform file-based persistence.
 * Built-in themes (Classic, Eye Care) are always present and cannot be deleted.
 */
import { create } from "zustand";
import type {
  ActiveThemeSelection,
  ThemeConfig,
  ThemeModeColors,
} from "../types/theme";
import { withPersist } from "./persist";
import { BUILT_IN_THEMES, DEFAULT_SELECTION } from "../theme/built-in-themes";

// ─── State Interface ────────────────────────────────────────

export interface ThemeStoreState {
  /** All themes (built-in + custom) */
  themes: ThemeConfig[];
  /** Current user selection */
  activeSelection: ActiveThemeSelection;
  /** Persistence hydration flag */
  _hasHydrated: boolean;

  // ── Queries ──

  /** Get the currently active ThemeConfig */
  getActiveTheme: () => ThemeConfig;
  /** Resolve the effective mode ("light" or "dark") — handles "auto" */
  getActiveMode: () => "light" | "dark";
  /** Get the resolved color palette for the active theme + mode */
  getActiveModeColors: () => ThemeModeColors;

  // ── Selection ──

  /** Switch to a different theme */
  setActiveTheme: (themeId: string, preferredMode?: "light" | "dark" | "auto") => void;
  /** Change preferred mode without switching theme */
  setPreferredMode: (mode: "light" | "dark" | "auto") => void;

  // ── CRUD ──

  /** Add a new custom theme. Returns the new theme's id. */
  addTheme: (theme: Omit<ThemeConfig, "id" | "builtIn" | "createdAt" | "updatedAt">) => string;
  /** Update an existing custom theme */
  updateTheme: (id: string, updates: Partial<Omit<ThemeConfig, "id" | "builtIn">>) => void;
  /** Delete a custom theme (no-op for built-in) */
  deleteTheme: (id: string) => void;
  /** Duplicate an existing theme as a new custom theme. Returns the new id. */
  duplicateTheme: (id: string) => string;
}

// ─── Helpers ────────────────────────────────────────────────

let nanoidFn: (() => string) | null = null;

async function loadNanoid(): Promise<() => string> {
  if (!nanoidFn) {
    const { nanoid } = await import("nanoid");
    nanoidFn = nanoid;
  }
  return nanoidFn;
}

/** Synchronous ID generation — fallback to timestamp if nanoid not yet loaded */
function generateId(): string {
  if (nanoidFn) return nanoidFn();
  return `theme-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Preload nanoid
loadNanoid().catch(() => {});

/** Detect system color scheme preference */
function getSystemMode(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

// ─── Store ──────────────────────────────────────────────────

export const useThemeStore = create<ThemeStoreState>()(
  withPersist("themes", (set, get) => ({
    themes: [...BUILT_IN_THEMES],
    activeSelection: { ...DEFAULT_SELECTION },
    _hasHydrated: false,

    // ── Queries ──

    getActiveTheme: () => {
      const { themes, activeSelection } = get();
      return (
        themes.find((t) => t.id === activeSelection.themeId) ??
        BUILT_IN_THEMES[0]
      );
    },

    getActiveMode: () => {
      const { activeSelection } = get();
      if (activeSelection.preferredMode === "auto") {
        // Check if theme supports the system mode, fallback to available mode
        const theme = get().getActiveTheme();
        const systemMode = getSystemMode();
        if (theme.modes[systemMode]) return systemMode;
        // Theme doesn't have the system mode — use whichever is available
        return theme.modes.light ? "light" : "dark";
      }
      // Verify the preferred mode exists in the theme
      const theme = get().getActiveTheme();
      if (theme.modes[activeSelection.preferredMode]) {
        return activeSelection.preferredMode;
      }
      // Fallback
      return theme.modes.light ? "light" : "dark";
    },

    getActiveModeColors: () => {
      const theme = get().getActiveTheme();
      const mode = get().getActiveMode();
      return theme.modes[mode]!;
    },

    // ── Selection ──

    setActiveTheme: (themeId, preferredMode) => {
      set((state) => ({
        activeSelection: {
          themeId,
          preferredMode: preferredMode ?? state.activeSelection.preferredMode,
        },
      }));
    },

    setPreferredMode: (mode) => {
      set((state) => ({
        activeSelection: {
          ...state.activeSelection,
          preferredMode: mode,
        },
      }));
    },

    // ── CRUD ──

    addTheme: (themeData) => {
      const id = generateId();
      const now = Date.now();
      const newTheme: ThemeConfig = {
        ...themeData,
        id,
        builtIn: false,
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({
        themes: [...state.themes, newTheme],
      }));
      return id;
    },

    updateTheme: (id, updates) => {
      set((state) => ({
        themes: state.themes.map((t) => {
          if (t.id !== id || t.builtIn) return t;
          return { ...t, ...updates, id: t.id, builtIn: false, updatedAt: Date.now() };
        }),
      }));
    },

    deleteTheme: (id) => {
      const { themes, activeSelection } = get();
      const theme = themes.find((t) => t.id === id);
      if (!theme || theme.builtIn) return;

      const filtered = themes.filter((t) => t.id !== id);

      // If deleting the active theme, switch to first built-in
      const newSelection =
        activeSelection.themeId === id
          ? { ...activeSelection, themeId: BUILT_IN_THEMES[0].id }
          : activeSelection;

      set({ themes: filtered, activeSelection: newSelection });
    },

    duplicateTheme: (id) => {
      const { themes } = get();
      const source = themes.find((t) => t.id === id);
      if (!source) return BUILT_IN_THEMES[0].id;

      const newId = generateId();
      const now = Date.now();
      const duplicate: ThemeConfig = {
        ...JSON.parse(JSON.stringify(source)),
        id: newId,
        name: `${source.name} (Copy)`,
        builtIn: false,
        createdAt: now,
        updatedAt: now,
      };

      set((state) => ({
        themes: [...state.themes, duplicate],
      }));
      return newId;
    },
  })),
);
