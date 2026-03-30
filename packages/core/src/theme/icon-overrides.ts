/**
 * Icon override utilities — validates SVG strings and resolves theme icon overrides.
 */
import type { IconSlot, ThemeIcons } from "../types/theme";

export type SvgValidationResult = {
  valid: boolean;
  error?: string;
};

/**
 * Basic SVG string validation — checks for a valid <svg> root element.
 * Does NOT do full XML parsing for performance.
 */
export function validateSvgString(svg: string): boolean {
  return validateSvgDetailed(svg).valid;
}

/**
 * Detailed SVG validation with error messages.
 */
export function validateSvgDetailed(svg: string): SvgValidationResult {
  const trimmed = svg.trim();
  
  if (!trimmed) {
    return { valid: false, error: "SVG 内容为空" };
  }
  
  if (!trimmed.startsWith("<svg")) {
    return { valid: false, error: "SVG 必须以 <svg 开头" };
  }
  
  if (!trimmed.endsWith("</svg>")) {
    return { valid: false, error: "SVG 必须以 </svg> 结尾（可能复制不完整）" };
  }
  
  // Must contain at least one viewBox or width/height
  if (!/viewBox\s*=/.test(trimmed) && !/width\s*=/.test(trimmed)) {
    return { valid: false, error: "SVG 必须包含 viewBox 或 width 属性" };
  }
  
  // Size guard: max 10KB for a single SVG icon
  const byteSize = new TextEncoder().encode(trimmed).length;
  if (byteSize > 10240) {
    return { valid: false, error: `SVG 大小超过限制（${Math.round(byteSize / 1024)}KB > 10KB）` };
  }
  
  // Check for common issues
  if (/xmlns\s*=\s*["']`/.test(trimmed)) {
    return { valid: false, error: "xmlns 属性格式错误：URL 不应包含反引号" };
  }
  
  return { valid: true };
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
