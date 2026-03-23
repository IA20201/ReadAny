/**
 * Desktop theme engine — applies ThemeConfig to the DOM via CSS custom properties.
 *
 * This replaces the old [data-theme="dark"] / [data-theme="sepia"] CSS-only approach.
 * CSS variables are set directly on <html>, so all Tailwind utility classes
 * (bg-background, text-foreground, etc.) continue to work unchanged.
 */
import type { ThemeConfig } from "../types/theme";
import { deriveColors } from "./derive-colors";

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

  // ── L0: Page base ──
  el.style.setProperty("--background", colors.background);
  el.style.setProperty("--foreground", colors.foreground);

  // ── L1: Sidebar ──
  el.style.setProperty("--sidebar", colors.sidebar);
  el.style.setProperty("--sidebar-foreground", colors.sidebarForeground);

  // ── L2: Cards ──
  el.style.setProperty("--card", colors.card);
  el.style.setProperty("--card-foreground", colors.cardForeground);

  // ── L3: Muted ──
  el.style.setProperty("--muted", colors.muted);
  el.style.setProperty("--muted-foreground", colors.mutedForeground);

  // ── Functional ──
  el.style.setProperty("--primary", colors.primary);
  el.style.setProperty("--primary-foreground", colors.primaryForeground);
  el.style.setProperty("--accent", colors.accent);
  el.style.setProperty("--accent-foreground", colors.accentForeground);
  el.style.setProperty("--border", colors.border);

  // ── Derived (auto-computed) ──
  el.style.setProperty("--popover", derived.popover);
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
  const overlayOpacity = config.overlayOpacity;
  el.style.setProperty(
    "--overlay-opacity-sidebar",
    String(overlayOpacity?.sidebar ?? 0.85),
  );
  el.style.setProperty(
    "--overlay-opacity-card",
    String(overlayOpacity?.card ?? 0.9),
  );
  el.style.setProperty(
    "--overlay-opacity-muted",
    String(overlayOpacity?.muted ?? 0.8),
  );

  // ── Background image ──
  if (config.backgroundImages?.backgroundImage) {
    document.body.style.backgroundImage = `url(${config.backgroundImages.backgroundImage})`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundAttachment = "fixed";
  } else {
    document.body.style.backgroundImage = "";
    document.body.style.backgroundSize = "";
    document.body.style.backgroundPosition = "";
    document.body.style.backgroundAttachment = "";
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
