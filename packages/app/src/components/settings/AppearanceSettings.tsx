/**
 * AppearanceSettings — theme selection, mode switching, and management.
 *
 * Features:
 * - Select built-in or custom themes
 * - Switch preferred mode (light / dark / auto)
 * - Create new custom themes (opens ThemeEditor)
 * - Edit / duplicate / delete custom themes
 * - Import themes via theme code
 */
import { useThemeStore } from "@readany/core/stores";
import { applyThemeToDOM, decodeThemeCode } from "@readany/core/theme";
import type { ThemeConfig } from "@readany/core/types";
import { Check, Copy, Moon, Monitor, Pencil, Plus, Sun, Trash2, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ThemeEditor } from "./ThemeEditor";

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
  const deleteTheme = useThemeStore((s) => s.deleteTheme);
  const duplicateTheme = useThemeStore((s) => s.duplicateTheme);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingThemeId, setEditingThemeId] = useState<string | undefined>();
  const [importCode, setImportCode] = useState("");
  const [importError, setImportError] = useState("");
  const [showImport, setShowImport] = useState(false);

  const builtInThemes = themes.filter((t) => t.builtIn);
  const customThemes = themes.filter((t) => !t.builtIn);

  const applyCurrentTheme = useCallback(() => {
    const theme = getActiveTheme();
    const mode = getActiveMode();
    applyThemeToDOM(theme, mode);
  }, [getActiveTheme, getActiveMode]);

  const handleSelectTheme = useCallback(
    (theme: ThemeConfig) => {
      setActiveTheme(theme.id);
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

  const handleCreateTheme = useCallback(() => {
    setEditingThemeId(undefined);
    setEditorOpen(true);
  }, []);

  const handleEditTheme = useCallback((themeId: string) => {
    setEditingThemeId(themeId);
    setEditorOpen(true);
  }, []);

  const handleDeleteTheme = useCallback(
    (themeId: string, themeName: string) => {
      if (confirm(t("theme.deleteConfirm", { name: themeName }))) {
        deleteTheme(themeId);
        requestAnimationFrame(() => applyCurrentTheme());
      }
    },
    [deleteTheme, applyCurrentTheme, t],
  );

  const handleDuplicateTheme = useCallback(
    (themeId: string) => {
      const newId = duplicateTheme(themeId);
      setEditingThemeId(newId);
      setEditorOpen(true);
    },
    [duplicateTheme],
  );

  const handleImport = useCallback(async () => {
    setImportError("");
    const decoded = await decodeThemeCode(importCode.trim());
    if (!decoded) {
      setImportError(t("theme.invalidCode"));
      return;
    }
    // Add to store
    const store = useThemeStore.getState();
    const id = store.addTheme({
      name: decoded.name,
      author: decoded.author,
      modes: decoded.modes,
      typography: decoded.typography,
      backgroundImages: decoded.backgroundImages,
      overlayOpacity: decoded.overlayOpacity,
      icons: decoded.icons,
    });
    store.setActiveTheme(id);
    requestAnimationFrame(() => {
      const theme = store.getActiveTheme();
      const mode = store.getActiveMode();
      applyThemeToDOM(theme, mode);
    });
    setImportCode("");
    setShowImport(false);
    alert(t("theme.importSuccess", { name: decoded.name }));
  }, [importCode, t]);

  return (
    <div className="space-y-6 p-4 pt-3">
      {/* Built-in Themes */}
      <section className="rounded-lg bg-muted/60 p-4">
        <h2 className="mb-4 text-sm font-medium text-foreground">{t("theme.builtInThemes")}</h2>
        <div className="grid grid-cols-2 gap-3">
          {builtInThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isActive={activeSelection.themeId === theme.id}
              onSelect={() => handleSelectTheme(theme)}
              t={t}
            />
          ))}
        </div>
      </section>

      {/* Custom Themes */}
      <section className="rounded-lg bg-muted/60 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">{t("theme.customThemes")}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImport(!showImport)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Upload className="h-3 w-3" />
              {t("theme.importTheme")}
            </button>
            <button
              onClick={handleCreateTheme}
              className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-3 w-3" />
              {t("theme.createTheme")}
            </button>
          </div>
        </div>

        {/* Import area */}
        {showImport && (
          <div className="mb-4 space-y-2 rounded-md border bg-background p-3">
            <textarea
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              placeholder={t("theme.pasteCode")}
              className="w-full rounded-md border bg-muted/30 p-2 text-xs font-mono"
              rows={3}
            />
            {importError && <p className="text-xs text-destructive">{importError}</p>}
            <button
              onClick={handleImport}
              disabled={!importCode.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              {t("theme.importTheme")}
            </button>
          </div>
        )}

        {customThemes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("theme.noCustomThemes")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {customThemes.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                isActive={activeSelection.themeId === theme.id}
                onSelect={() => handleSelectTheme(theme)}
                onEdit={() => handleEditTheme(theme.id)}
                onDuplicate={() => handleDuplicateTheme(theme.id)}
                onDelete={() => handleDeleteTheme(theme.id, theme.name)}
                t={t}
              />
            ))}
          </div>
        )}
      </section>

      {/* Mode Selection */}
      <section className="rounded-lg bg-muted/60 p-4">
        <h2 className="mb-4 text-sm font-medium text-foreground">{t("theme.modes")}</h2>
        <div className="flex gap-2">
          {MODE_OPTIONS.map(({ mode, icon: Icon, labelKey }) => {
            const isActive = activeSelection.preferredMode === mode;
            const currentTheme = getActiveTheme();
            const isDisabled = mode !== "auto" && !currentTheme.modes[mode];
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

      {/* Theme Editor Dialog */}
      <ThemeEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        themeId={editingThemeId}
      />
    </div>
  );
}

// ── Theme Card ──

function ThemeCard({
  theme,
  isActive,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  t,
}: {
  theme: ThemeConfig;
  isActive: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  t: (key: string, opts?: any) => string;
}) {
  const previewMode = theme.modes.light ? "light" : "dark";
  const previewColors = theme.modes[previewMode]!;

  return (
    <div
      className={`relative flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all cursor-pointer ${
        isActive
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
      }`}
      onClick={onSelect}
    >
      {/* Color swatches */}
      <div className="flex gap-1.5">
        {[previewColors.background, previewColors.primary, previewColors.card, previewColors.accent].map(
          (color, i) => (
            <div
              key={i}
              className="h-5 w-5 rounded-full border border-black/10"
              style={{ background: color }}
            />
          ),
        )}
      </div>
      <div>
        <span className="text-sm font-medium text-foreground">
          {theme.builtIn
            ? t(`theme.${theme.id === "builtin-classic" ? "classic" : "eyeCare"}`)
            : theme.name}
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
      {/* Action buttons for custom themes */}
      {!theme.builtIn && (onEdit || onDuplicate || onDelete) && (
        <div className="absolute bottom-2 right-2 flex gap-1">
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title={t("theme.editTheme")}
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {onDuplicate && (
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title={t("theme.duplicateTheme")}
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title={t("theme.deleteTheme")}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
