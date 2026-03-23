/**
 * @readany/core theme module — re-exports
 */
export { BUILT_IN_THEMES, DEFAULT_SELECTION, migrateFromLegacyTheme } from "./built-in-themes";
export { deriveColors } from "./derive-colors";
export { applyThemeToDOM, getCurrentDOMMode } from "./apply-theme-web";
export { resolveRNThemeColors } from "./apply-theme-rn";
export type { RNThemeColors } from "./apply-theme-rn";
export { validateSvgString, getIconOverride } from "./icon-overrides";
export { processBackgroundImage, getDataURISize } from "./background-image";
export { encodeThemeCode, decodeThemeCode } from "./theme-codec";
