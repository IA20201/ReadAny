/**
 * Icon override utilities — validates SVG strings and resolves theme icon overrides.
 */
import type { IconSlot, ThemeIcons } from "../types/theme";

/**
 * Basic SVG string validation — checks for a valid <svg> root element.
 * Does NOT do full XML parsing for performance.
 */
export function validateSvgString(svg: string): boolean {
  const trimmed = svg.trim();
  if (!trimmed.startsWith("<svg") || !trimmed.endsWith("</svg>")) {
    return false;
  }
  // Must contain at least one viewBox or width/height
  if (!/viewBox\s*=/.test(trimmed) && !/width\s*=/.test(trimmed)) {
    return false;
  }
  // Size guard: max 10KB for a single SVG icon
  if (new TextEncoder().encode(trimmed).length > 10240) {
    return false;
  }
  return true;
}

/**
 * Get an SVG override for a given icon slot.
 * Returns the raw SVG string if the theme provides one, or null otherwise.
 */
export function getIconOverride(
  icons: ThemeIcons | undefined,
  slot: IconSlot,
): string | null {
  if (!icons) return null;
  const svg = icons[slot];
  if (!svg) return null;
  return svg;
}
