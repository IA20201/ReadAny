/**
 * @readany/core theme module — re-exports
 */
export { BUILT_IN_THEMES, DEFAULT_SELECTION, migrateFromLegacyTheme } from "./built-in-themes";
export { deriveColors } from "./derive-colors";
export { applyThemeToDOM, getCurrentDOMMode } from "./apply-theme-web";
export { resolveRNThemeColors } from "./apply-theme-rn";
export type { RNThemeColors } from "./apply-theme-rn";
