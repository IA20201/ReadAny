/**
 * AppearanceSettings — theme selection and management.
 *
 * For now this provides a simple theme+mode switcher using the theme store.
 * The full theme editor UI will be added in Phase 6.
 */
import { useThemeStore } from "@readany/core/stores";
import { applyThemeToDOM } from "@readany/core/theme";
import type { ThemeConfig } from "@readany/core/types";
import { Check, Moon, Monitor, Sun } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

type PreferredMode = "light" | "dark" | "auto";

const MODE_OPTIONS: { mode: PreferredMode; icon: typeof Sun; labelKey: string }[] = [
  { mode: "light", icon: Sun, labelKey: "theme.lightMode" },
  { mode: "dark", icon: Moon, labelKey: "theme.darkMode" },
  { mode: "auto", icon: Monitor, labelKey: "theme.autoMode" },
];

export function AppearanceSettings() {
  const { t } = useTranslation();
  const themes = useThemeStore((s) => s.themes);
  const activeSelection = useThemeStore((s) => s.activeSelection);
  const setActiveTheme = useThemeStore((s) => s.setActiveTheme);
  const setPreferredMode = useThemeStore((s) => s.setPreferredMode);
  const getActiveTheme = useThemeStore((s) => s.getActiveTheme);
  const getActiveMode = useThemeStore((s) => s.getActiveMode);

  const applyCurrentTheme = useCallback(() => {
    const theme = getActiveTheme();
    const mode = getActiveMode();
    applyThemeToDOM(theme, mode);
  }, [getActiveTheme, getActiveMode]);

  const handleSelectTheme = useCallback(
    (theme: ThemeConfig) => {
      setActiveTheme(theme.id);
      // Apply after state update
      requestAnimationFrame(() => applyCurrentTheme());
    },
    [setActiveTheme, applyCurrentTheme],
  );

  const handleSelectMode = useCallback(
    (mode: PreferredMode) => {
      setPreferredMode(mode);
      requestAnimationFrame(() => applyCurrentTheme());
    },
    [setPreferredMode, applyCurrentTheme],
  );

  return (
    <div className="space-y-6 p-4 pt-3">
      {/* Theme Selection */}
      <section className="rounded-lg bg-muted/60 p-4">
        <h2 className="mb-4 text-sm font-medium text-foreground">{t("theme.title")}</h2>
        <div className="grid grid-cols-2 gap-3">
          {themes.map((theme) => {
            const isActive = activeSelection.themeId === theme.id;
            // Pick a preview mode: use light if available, else dark
            const previewMode = theme.modes.light ? "light" : "dark";
            const previewColors = theme.modes[previewMode]!;
            return (
              <button
                key={theme.id}
                onClick={() => handleSelectTheme(theme)}
                className={`relative flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all ${
                  isActive
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:border-primary/40 hover:bg-muted/40"
                }`}
              >
                {/* Color preview swatches */}
                <div className="flex gap-1.5">
                  <div
                    className="h-5 w-5 rounded-full border border-black/10"
                    style={{ background: previewColors.background }}
                    title="Background"
                  />
                  <div
                    className="h-5 w-5 rounded-full border border-black/10"
                    style={{ background: previewColors.primary }}
                    title="Primary"
                  />
                  <div
                    className="h-5 w-5 rounded-full border border-black/10"
                    style={{ background: previewColors.card }}
                    title="Card"
                  />
                  <div
                    className="h-5 w-5 rounded-full border border-black/10"
                    style={{ background: previewColors.accent }}
                    title="Accent"
                  />
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">
                    {theme.builtIn ? t(`theme.${theme.id === "builtin-classic" ? "classic" : "eyeCare"}` as any) : theme.name}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {theme.modes.light && theme.modes.dark
                      ? t("theme.bothModes")
                      : theme.modes.light
                        ? t("theme.lightMode")
                        : t("theme.darkMode")}
                  </p>
                </div>
                {isActive && (
                  <div className="absolute right-2 top-2">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Mode Selection */}
      <section className="rounded-lg bg-muted/60 p-4">
        <h2 className="mb-4 text-sm font-medium text-foreground">{t("theme.modes")}</h2>
        <div className="flex gap-2">
          {MODE_OPTIONS.map(({ mode, icon: Icon, labelKey }) => {
            const isActive = activeSelection.preferredMode === mode;
            // Check if the current theme supports this mode
            const currentTheme = getActiveTheme();
            const isDisabled =
              mode !== "auto" && !currentTheme.modes[mode];
            return (
              <button
                key={mode}
                onClick={() => !isDisabled && handleSelectMode(mode)}
                disabled={isDisabled}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDisabled
                      ? "cursor-not-allowed bg-muted/50 text-muted-foreground/40"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
