/**
 * Desktop theme engine — applies ThemeConfig to the DOM via CSS custom properties.
 *
 * This replaces the old [data-theme="dark"] / [data-theme="sepia"] CSS-only approach.
 * CSS variables are set directly on <html>, so all Tailwind utility classes
 * (bg-background, text-foreground, etc.) continue to work unchanged.
 */
import type { ThemeConfig } from "../types/theme";
import { deriveColors } from "./derive-colors";

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function oklchToRgba(oklch: string, alpha: number): string {
  if (oklch.startsWith("#") || oklch.startsWith("rgb")) {
    return hexToRgba(oklch, alpha);
  }
  return `oklch(${oklch.match(/[\d.]+/g)?.join(" ") || oklch} / ${alpha})`;
}

function applyAlpha(color: string, alpha: number): string {
  if (color.startsWith("oklch")) {
    return oklchToRgba(color, alpha);
  }
  if (color.startsWith("#")) {
    return hexToRgba(color, alpha);
  }
  if (color.startsWith("rgb")) {
    return color.replace(/rgba?\(([^)]+)\)/, (_, inner) => {
      const parts = inner.split(",").map((s: string) => s.trim());
      if (parts.length === 3) {
        return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
      }
      return color;
    });
  }
  return color;
}

/**
 * Apply a theme + mode to the DOM.
 *
 * Sets all CSS custom properties on `<html>` and updates the `data-theme`
 * attribute to "light" or "dark" (needed for Tailwind @custom-variant dark
 * and third-party CSS like highlight.js).
 */
export function applyThemeToDOM(
  config: ThemeConfig,
  mode: "light" | "dark",
): void {
  const colors = config.modes[mode];
  if (!colors) return;

  const derived = deriveColors(colors, mode === "dark");
  const el = document.documentElement;
  const hasBgImage = !!config.backgroundImages?.backgroundImage;
  const overlayOpacity = config.overlayOpacity ?? { sidebar: 0.85, card: 0.9, muted: 0.8 };

  // ── L0: Page base ──
  const backgroundColor = hasBgImage ? applyAlpha(colors.background, overlayOpacity.card ?? 0.9) : colors.background;
  el.style.setProperty("--background", backgroundColor);
  el.style.setProperty("--foreground", colors.foreground);

  // ── L1: Sidebar ──
  const sidebarColor = hasBgImage ? applyAlpha(colors.sidebar, overlayOpacity.sidebar ?? 0.85) : colors.sidebar;
  el.style.setProperty("--sidebar", sidebarColor);
  el.style.setProperty("--sidebar-foreground", colors.sidebarForeground);

  // ── L2: Cards ──
  const cardColor = hasBgImage ? applyAlpha(colors.card, overlayOpacity.card ?? 0.9) : colors.card;
  el.style.setProperty("--card", cardColor);
  el.style.setProperty("--card-foreground", colors.cardForeground);

  // ── L3: Muted ──
  const mutedColor = hasBgImage ? applyAlpha(colors.muted, overlayOpacity.muted ?? 0.8) : colors.muted;
  el.style.setProperty("--muted", mutedColor);
  el.style.setProperty("--muted-foreground", colors.mutedForeground);

  // ── Functional ──
  el.style.setProperty("--primary", colors.primary);
  el.style.setProperty("--primary-foreground", colors.primaryForeground);
  el.style.setProperty("--accent", colors.accent);
  el.style.setProperty("--accent-foreground", colors.accentForeground);
  el.style.setProperty("--border", colors.border);

  // ── Derived (auto-computed) ──
  el.style.setProperty("--popover", hasBgImage ? applyAlpha(derived.popover, overlayOpacity.card ?? 0.9) : derived.popover);
  el.style.setProperty("--popover-foreground", derived.popoverForeground);
  el.style.setProperty("--secondary", derived.secondary);
  el.style.setProperty("--secondary-foreground", derived.secondaryForeground);
  el.style.setProperty("--destructive", derived.destructive);
  el.style.setProperty("--destructive-foreground", derived.destructiveForeground);
  el.style.setProperty("--input", derived.input);
  el.style.setProperty("--ring", derived.ring);

  // ── Typography ──
  if (config.typography?.fontSans) {
    el.style.setProperty("--font-sans", config.typography.fontSans);
  }
  if (config.typography?.fontSerif) {
    el.style.setProperty("--font-serif", config.typography.fontSerif);
  }
  if (config.typography?.fontMono) {
    el.style.setProperty("--font-mono", config.typography.fontMono);
  }

  // ── Overlay opacity (for background images) ──
  el.style.setProperty(
    "--overlay-opacity-sidebar",
    String(overlayOpacity.sidebar ?? 0.85),
  );
  el.style.setProperty(
    "--overlay-opacity-card",
    String(overlayOpacity.card ?? 0.9),
  );
  el.style.setProperty(
    "--overlay-opacity-muted",
    String(overlayOpacity.muted ?? 0.8),
  );

  // ── Background image ──
  if (hasBgImage) {
    document.body.style.backgroundImage = `url(${config.backgroundImages!.backgroundImage})`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundAttachment = "fixed";
    document.body.style.backgroundRepeat = "no-repeat";
    document.body.style.backgroundColor = "transparent";
  } else {
    document.body.style.backgroundImage = "";
    document.body.style.backgroundSize = "";
    document.body.style.backgroundPosition = "";
    document.body.style.backgroundAttachment = "";
    document.body.style.backgroundRepeat = "";
    document.body.style.backgroundColor = "";
  }

  // ── data-theme attribute ──
  // Only "light" or "dark" — used by @custom-variant dark, hljs, driver.js, etc.
  el.setAttribute("data-theme", mode);
}

/**
 * Read the current data-theme attribute.
 */
export function getCurrentDOMMode(): "light" | "dark" {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}
