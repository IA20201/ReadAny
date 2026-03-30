/**
 * ThemeEditor — full theme editing dialog.
 *
 * Allows editing all aspects of a ThemeConfig:
 * - Name and author
 * - Color levels (L0-L3, functional, reader) per mode
 * - Typography (font families)
 * - Background image upload with overlay opacity
 * - Icon SVG/PNG overrides (8 slots)
 * - Theme sharing (export/import code, QR)
 */
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useThemeStore, useFontStore } from "@readany/core/stores";
import { applyThemeToDOM, encodeThemeCode, processBackgroundImage, validateSvgDetailed } from "@readany/core/theme";
import type { IconSlot, ThemeConfig, ThemeModeColors } from "@readany/core/types";
import { Check, ChevronDown, Copy, ImagePlus, Trash2, Upload, X, FileUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ThemeColorPicker } from "./ThemeColorPicker";

const ICON_SIZE_LIMIT = 50 * 1024; // 50KB

interface ThemeEditorProps {
  open: boolean;
  onClose: () => void;
  /** Theme ID to edit, or undefined for new theme */
  themeId?: string;
}

// Default light colors for new theme
const DEFAULT_LIGHT_COLORS: ThemeModeColors = {
  background: "#ffffff",
  foreground: "#1a1a1a",
  sidebar: "#f8f8f8",
  sidebarForeground: "#1a1a1a",
  card: "#ffffff",
  cardForeground: "#1a1a1a",
  muted: "#f2f2f2",
  mutedForeground: "#737373",
  primary: "#2563eb",
  primaryForeground: "#ffffff",
  accent: "#f0f0f0",
  accentForeground: "#1a1a1a",
  border: "#e5e5e5",
  reader: { background: "#ffffff", foreground: "#1a1a1a", linkColor: "#2563eb" },
};

const DEFAULT_DARK_COLORS: ThemeModeColors = {
  background: "#1a1a1a",
  foreground: "#e5e5e5",
  sidebar: "#222222",
  sidebarForeground: "#e5e5e5",
  card: "#2a2a2a",
  cardForeground: "#e5e5e5",
  muted: "#333333",
  mutedForeground: "#999999",
  primary: "#60a5fa",
  primaryForeground: "#1a1a1a",
  accent: "#333333",
  accentForeground: "#e5e5e5",
  border: "#404040",
  reader: { background: "#1a1a1a", foreground: "#e5e5e5", linkColor: "#60a5fa" },
};

const ICON_SLOTS: { slot: IconSlot; labelKey: string }[] = [
  { slot: "bookOpen", labelKey: "theme.iconSlot_bookOpen" },
  { slot: "messageSquare", labelKey: "theme.iconSlot_messageSquare" },
  { slot: "notebookPen", labelKey: "theme.iconSlot_notebookPen" },
  { slot: "user", labelKey: "theme.iconSlot_user" },
  { slot: "puzzle", labelKey: "theme.iconSlot_puzzle" },
  { slot: "barChart3", labelKey: "theme.iconSlot_barChart3" },
  { slot: "helpCircle", labelKey: "theme.iconSlot_helpCircle" },
  { slot: "settings", labelKey: "theme.iconSlot_settings" },
];

type EditingMode = "light" | "dark";

function FontSelect({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const { t } = useTranslation();
  const customFonts = useFontStore((s) => s.fonts);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleSelectFont = (fontFamily: string) => {
    setInputValue(fontFamily);
    onChange(fontFamily);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    onChange(e.target.value);
  };

  return (
    <div className="relative">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative mt-1">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="w-full rounded-md border bg-background px-3 py-1.5 pr-8 text-sm font-mono"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          <div className="max-h-48 overflow-y-auto p-1">
            {customFonts.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {t("fonts.noFonts", "暂无自定义字体")}
              </div>
            ) : (
              customFonts.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => handleSelectFont(`'${font.fontFamily}'`)}
                  className={`w-full rounded px-3 py-1.5 text-left text-sm hover:bg-muted ${
                    value === `'${font.fontFamily}'` ? "bg-muted/50" : ""
                  }`}
                  style={{ fontFamily: `'${font.fontFamily}'` }}
                >
                  {font.name}
                  {font.source === "remote" && (
                    <span className="ml-2 text-xs text-muted-foreground">({t("fonts.online", "在线")})</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ThemeEditor({ open, onClose, themeId }: ThemeEditorProps) {
  const { t } = useTranslation();
  const addTheme = useThemeStore((s) => s.addTheme);
  const updateTheme = useThemeStore((s) => s.updateTheme);
  const themes = useThemeStore((s) => s.themes);

  const existingTheme = themeId ? themes.find((t) => t.id === themeId) : undefined;
  const isNew = !existingTheme;

  // ── Local state ──
  const [name, setName] = useState("");
  const [author, setAuthor] = useState("");
  const [hasLight, setHasLight] = useState(true);
  const [hasDark, setHasDark] = useState(true);
  const [lightColors, setLightColors] = useState<ThemeModeColors>({ ...DEFAULT_LIGHT_COLORS });
  const [darkColors, setDarkColors] = useState<ThemeModeColors>({ ...DEFAULT_DARK_COLORS });
  const [editingMode, setEditingMode] = useState<EditingMode>("light");
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [bgImage, setBgImage] = useState<string | undefined>();
  const [overlayOpacity, setOverlayOpacity] = useState({ sidebar: 0.85, card: 0.9, muted: 0.8 });
  const [shareCode, setShareCode] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<"colors" | "typography" | "background" | "icons" | "share">("colors");
  const [fontSans, setFontSans] = useState("");
  const [fontSerif, setFontSerif] = useState("");
  const [fontMono, setFontMono] = useState("");

  // ── Init from existing theme ──
  useEffect(() => {
    if (existingTheme) {
      setName(existingTheme.name);
      setAuthor(existingTheme.author ?? "");
      setHasLight(!!existingTheme.modes.light);
      setHasDark(!!existingTheme.modes.dark);
      if (existingTheme.modes.light) setLightColors({ ...existingTheme.modes.light });
      if (existingTheme.modes.dark) setDarkColors({ ...existingTheme.modes.dark });
      setEditingMode(existingTheme.modes.light ? "light" : "dark");
      setIcons(existingTheme.icons ? { ...existingTheme.icons } : {});
      setBgImage(existingTheme.backgroundImages?.backgroundImage);
      if (existingTheme.overlayOpacity) setOverlayOpacity({ ...existingTheme.overlayOpacity } as any);
      setFontSans(existingTheme.typography?.fontSans ?? "");
      setFontSerif(existingTheme.typography?.fontSerif ?? "");
      setFontMono(existingTheme.typography?.fontMono ?? "");
    } else {
      setName("");
      setAuthor("");
      setHasLight(true);
      setHasDark(true);
      setLightColors({ ...DEFAULT_LIGHT_COLORS });
      setDarkColors({ ...DEFAULT_DARK_COLORS });
      setEditingMode("light");
      setIcons({});
      setBgImage(undefined);
      setOverlayOpacity({ sidebar: 0.85, card: 0.9, muted: 0.8 });
      setFontSans("");
      setFontSerif("");
      setFontMono("");
    }
    setShareCode("");
    setCodeCopied(false);
  }, [existingTheme, open]);

  const currentColors = editingMode === "light" ? lightColors : darkColors;
  const setCurrentColors = editingMode === "light" ? setLightColors : setDarkColors;

  const updateColor = useCallback(
    (key: keyof ThemeModeColors, value: string) => {
      setCurrentColors((prev) => ({ ...prev, [key]: value }));
    },
    [setCurrentColors],
  );

  const updateReaderColor = useCallback(
    (key: "background" | "foreground" | "linkColor", value: string) => {
      setCurrentColors((prev) => ({
        ...prev,
        reader: { ...prev.reader, [key]: value },
      }));
    },
    [setCurrentColors],
  );

  // ── Build ThemeConfig ──
  const buildConfig = useCallback((): Omit<ThemeConfig, "id" | "builtIn" | "createdAt" | "updatedAt"> => {
    return {
      name: name || t("theme.themeNamePlaceholder"),
      author: author || undefined,
      modes: {
        ...(hasLight ? { light: lightColors } : {}),
        ...(hasDark ? { dark: darkColors } : {}),
      },
      typography: (fontSans || fontSerif || fontMono)
        ? { fontSans: fontSans || undefined, fontSerif: fontSerif || undefined, fontMono: fontMono || undefined }
        : undefined,
      backgroundImages: bgImage ? { backgroundImage: bgImage } : undefined,
      overlayOpacity: bgImage ? overlayOpacity : undefined,
      icons: Object.keys(icons).length > 0 ? (icons as any) : undefined,
    };
  }, [name, author, hasLight, hasDark, lightColors, darkColors, fontSans, fontSerif, fontMono, bgImage, overlayOpacity, icons, t]);

  // ── Save handler ──
  const handleSave = useCallback(() => {
    const config = buildConfig();
    if (isNew) {
      const newId = addTheme(config);
      // Switch to the new theme
      const store = useThemeStore.getState();
      store.setActiveTheme(newId);
      const theme = store.getActiveTheme();
      const mode = store.getActiveMode();
      applyThemeToDOM(theme, mode);
    } else if (themeId) {
      updateTheme(themeId, config);
      // Re-apply if this is the active theme
      const store = useThemeStore.getState();
      if (store.activeSelection.themeId === themeId) {
        const theme = store.getActiveTheme();
        const mode = store.getActiveMode();
        applyThemeToDOM(theme, mode);
      }
    }
    onClose();
  }, [buildConfig, isNew, themeId, addTheme, updateTheme, onClose]);

  // ── Background image upload ──
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUri = await processBackgroundImage(file);
      setBgImage(dataUri);
    } catch (err: any) {
      if (err.message === "IMAGE_TOO_LARGE") {
        alert(t("theme.imageTooLarge"));
      }
    }
    // Reset input
    e.target.value = "";
  }, [t]);

  // ── Icon SVG paste ──
  const handleIconPaste = useCallback((slot: IconSlot, svg: string) => {
    if (!svg.trim()) {
      setIcons((prev) => {
        const next = { ...prev };
        delete next[slot];
        return next;
      });
      return;
    }
    const result = validateSvgDetailed(svg);
    if (result.valid) {
      setIcons((prev) => ({ ...prev, [slot]: svg }));
    } else {
      alert(`${t("theme.invalidSvg", "无效的 SVG")}: ${result.error}`);
    }
  }, [t]);

  // ── Icon file upload ──
  const handleIconUpload = useCallback(async (slot: IconSlot, file: File) => {
    if (file.size > ICON_SIZE_LIMIT) {
      alert(t("theme.iconTooLarge", "图标文件过大（最大 50KB）"));
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    
    if (ext === "svg") {
      const text = await file.text();
      const result = validateSvgDetailed(text);
      if (result.valid) {
        setIcons((prev) => ({ ...prev, [slot]: text }));
      } else {
        alert(`${t("theme.invalidSvg", "无效的 SVG")}: ${result.error}`);
      }
    } else if (ext === "png") {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUri = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${img.width}" height="${img.height}" viewBox="0 0 ${img.width} ${img.height}"><image href="${dataUri}" width="${img.width}" height="${img.height}"/></svg>`;
          setIcons((prev) => ({ ...prev, [slot]: svg }));
        };
        img.src = dataUri;
      };
      reader.readAsDataURL(file);
    } else {
      alert(t("theme.unsupportedIconFormat", "不支持的图标格式，请使用 SVG 或 PNG"));
    }
  }, [t]);

  // ── Share code generation ──
  const handleGenerateCode = useCallback(async () => {
    const config: ThemeConfig = {
      ...buildConfig(),
      id: themeId || "temp",
      builtIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const code = await encodeThemeCode(config);
    setShareCode(code);
  }, [buildConfig, themeId]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(shareCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }, [shareCode]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex min-h-[85vh] max-h-[85vh] w-[720px] max-w-[720px] flex-col overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <DialogTitle className="text-base font-semibold">
            {isNew ? t("theme.createTheme") : t("theme.editTheme")}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || (!hasLight && !hasDark)}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              {t("common.save", "Save")}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Section nav */}
          <div className="w-40 flex-shrink-0 overflow-y-auto border-r p-2">
            {(["colors", "typography", "background", "icons", "share"] as const).map((section) => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`flex w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                  activeSection === section
                    ? "bg-muted/80 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {t(`theme.${section === "colors" ? "colorLevels" : section === "typography" ? "typography" : section === "background" ? "backgroundImage" : section === "icons" ? "icons" : "shareTheme"}`)}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 overflow-y-auto p-4 space-y-5">
            {/* Name + Author (always visible) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t("theme.themeName")}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("theme.themeNamePlaceholder")}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t("theme.author")}</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder={t("theme.authorPlaceholder")}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                />
              </div>
            </div>

            {/* Mode toggles */}
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasLight}
                  onChange={(e) => {
                    setHasLight(e.target.checked);
                    if (!e.target.checked && editingMode === "light") setEditingMode("dark");
                  }}
                  className="rounded"
                />
                {t("theme.lightMode")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasDark}
                  onChange={(e) => {
                    setHasDark(e.target.checked);
                    if (!e.target.checked && editingMode === "dark") setEditingMode("light");
                  }}
                  className="rounded"
                />
                {t("theme.darkMode")}
              </label>
            </div>

            {/* ── Colors Section ── */}
            {activeSection === "colors" && (
              <>
                {/* Mode tabs */}
                {hasLight && hasDark && (
                  <div className="flex gap-1 rounded-lg bg-muted/60 p-1">
                    {(["light", "dark"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setEditingMode(m)}
                        className={`flex-1 rounded-md py-1.5 text-sm transition-colors ${
                          editingMode === m
                            ? "bg-background font-medium text-foreground shadow-sm"
                            : "text-muted-foreground"
                        }`}
                      >
                        {t(`theme.${m}Mode`)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Color groups */}
                <ColorGroup title={t("theme.pageBase")} description={t("theme.pageBaseDesc")}>
                  <ThemeColorPicker label={t("theme.pageBase")} value={currentColors.background} onChange={(v) => updateColor("background", v)} />
                  <ThemeColorPicker label={t("common.text", "Text")} value={currentColors.foreground} onChange={(v) => updateColor("foreground", v)} />
                </ColorGroup>

                <ColorGroup title={t("theme.sidebarColors")} description={t("theme.sidebarColorsDesc")}>
                  <ThemeColorPicker label={t("theme.sidebarColors")} value={currentColors.sidebar} onChange={(v) => updateColor("sidebar", v)} />
                  <ThemeColorPicker label={t("common.text", "Text")} value={currentColors.sidebarForeground} onChange={(v) => updateColor("sidebarForeground", v)} />
                </ColorGroup>

                <ColorGroup title={t("theme.cardColors")} description={t("theme.cardColorsDesc")}>
                  <ThemeColorPicker label={t("theme.cardColors")} value={currentColors.card} onChange={(v) => updateColor("card", v)} />
                  <ThemeColorPicker label={t("common.text", "Text")} value={currentColors.cardForeground} onChange={(v) => updateColor("cardForeground", v)} />
                </ColorGroup>

                <ColorGroup title={t("theme.mutedColors")} description={t("theme.mutedColorsDesc")}>
                  <ThemeColorPicker label={t("theme.mutedColors")} value={currentColors.muted} onChange={(v) => updateColor("muted", v)} />
                  <ThemeColorPicker label={t("common.text", "Text")} value={currentColors.mutedForeground} onChange={(v) => updateColor("mutedForeground", v)} />
                </ColorGroup>

                <ColorGroup title={t("theme.functionalColors")}>
                  <ThemeColorPicker label={t("theme.primaryColor")} value={currentColors.primary} onChange={(v) => updateColor("primary", v)} />
                  <ThemeColorPicker label={`${t("theme.primaryColor")} ${t("common.text", "Text")}`} value={currentColors.primaryForeground} onChange={(v) => updateColor("primaryForeground", v)} />
                  <ThemeColorPicker label={t("theme.accentColor")} value={currentColors.accent} onChange={(v) => updateColor("accent", v)} />
                  <ThemeColorPicker label={`${t("theme.accentColor")} ${t("common.text", "Text")}`} value={currentColors.accentForeground} onChange={(v) => updateColor("accentForeground", v)} />
                  <ThemeColorPicker label={t("theme.borderColor")} value={currentColors.border} onChange={(v) => updateColor("border", v)} />
                </ColorGroup>

                <ColorGroup title={t("theme.readerColors")}>
                  <ThemeColorPicker label={t("theme.readerBackground")} value={currentColors.reader.background} onChange={(v) => updateReaderColor("background", v)} />
                  <ThemeColorPicker label={t("theme.readerForeground")} value={currentColors.reader.foreground} onChange={(v) => updateReaderColor("foreground", v)} />
                  <ThemeColorPicker label={t("theme.readerLinkColor")} value={currentColors.reader.linkColor} onChange={(v) => updateReaderColor("linkColor", v)} />
                </ColorGroup>
              </>
            )}

            {/* ── Typography Section ── */}
            {activeSection === "typography" && (
              <div className="space-y-4">
                <FontSelect
                  label={t("theme.fontSans")}
                  value={fontSans}
                  onChange={setFontSans}
                  placeholder="Inter, system-ui, sans-serif"
                />
                <FontSelect
                  label={t("theme.fontSerif")}
                  value={fontSerif}
                  onChange={setFontSerif}
                  placeholder="Georgia, serif"
                />
                <FontSelect
                  label={t("theme.fontMono")}
                  value={fontMono}
                  onChange={setFontMono}
                  placeholder="JetBrains Mono, monospace"
                />
              </div>
            )}

            {/* ── Background Image Section ── */}
            {activeSection === "background" && (
              <div className="space-y-4">
                {bgImage ? (
                  <div className="relative">
                    <img
                      src={bgImage}
                      alt="Background"
                      className="h-40 w-full rounded-lg border object-cover"
                    />
                    <button
                      onClick={() => setBgImage(undefined)}
                      className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-md"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                    <ImagePlus className="h-8 w-8" />
                    <span className="text-sm">{t("theme.uploadImage")}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                )}

                {bgImage && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">{t("theme.overlayOpacity")}</h3>
                    <OpacitySlider
                      label={t("theme.sidebarOpacity")}
                      value={overlayOpacity.sidebar}
                      onChange={(v) => setOverlayOpacity((prev) => ({ ...prev, sidebar: v }))}
                    />
                    <OpacitySlider
                      label={t("theme.cardOpacity")}
                      value={overlayOpacity.card}
                      onChange={(v) => setOverlayOpacity((prev) => ({ ...prev, card: v }))}
                    />
                    <OpacitySlider
                      label={t("theme.mutedOpacity")}
                      value={overlayOpacity.muted}
                      onChange={(v) => setOverlayOpacity((prev) => ({ ...prev, muted: v }))}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── Icons Section ── */}
            {activeSection === "icons" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{t("theme.iconUploadHint", "支持上传 SVG/PNG 文件（最大 50KB）或粘贴 SVG 代码")}</p>
                {ICON_SLOTS.map(({ slot, labelKey }) => (
                  <div key={slot} className="flex items-center gap-3">
                    <span className="w-24 text-sm text-foreground">{t(labelKey)}</span>
                    <input
                      type="text"
                      value={icons[slot] || ""}
                      onChange={(e) => handleIconPaste(slot, e.target.value)}
                      placeholder="<svg ...>...</svg>"
                      className="flex-1 rounded-md border bg-background px-2 py-1 text-xs font-mono"
                    />
                    <label className="cursor-pointer rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                      <FileUp className="h-3.5 w-3.5" />
                      <input
                        type="file"
                        accept=".svg,.png"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleIconUpload(slot, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {icons[slot] && (
                      <div className="flex items-center gap-1">
                        <span
                          className="inline-flex h-5 w-5 items-center justify-center text-foreground"
                          dangerouslySetInnerHTML={{ __html: icons[slot] }}
                        />
                        <button
                          onClick={() => handleIconPaste(slot, "")}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Share Section ── */}
            {activeSection === "share" && (
              <div className="space-y-4">
                <button
                  onClick={handleGenerateCode}
                  className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
                >
                  <Upload className="h-4 w-4" />
                  {t("theme.shareTheme")}
                </button>
                {shareCode && (
                  <div className="space-y-2">
                    <textarea
                      readOnly
                      value={shareCode}
                      className="w-full rounded-md border bg-muted/50 p-3 text-xs font-mono"
                      rows={4}
                    />
                    <button
                      onClick={handleCopyCode}
                      className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-sm text-foreground hover:bg-muted/80"
                    >
                      {codeCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {codeCopied ? t("theme.codeCopied") : t("theme.copyCode")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Helper components ──

function ColorGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
      <div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function OpacitySlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-sm text-foreground">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
      />
      <span className="w-12 text-right text-xs text-muted-foreground">{Math.round(value * 100)}%</span>
    </div>
  );
}
