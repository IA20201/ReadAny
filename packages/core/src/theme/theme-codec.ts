/**
 * Theme codec — encode/decode ThemeConfig for sharing via theme codes.
 *
 * Format: "RA-THEME:" + Base64(deflate(JSON))
 *
 * Uses fflate for compression (available via foliate-js).
 * Falls back to uncompressed JSON if compression is unavailable.
 */
import type { PortableTheme, ThemeConfig } from "../types/theme";
import { THEME_CODE_PREFIX } from "../types/theme";

/**
 * Strip internal fields from ThemeConfig to create PortableTheme for sharing.
 */
function toPortable(config: ThemeConfig): PortableTheme {
  return {
    name: config.name,
    author: config.author,
    modes: config.modes,
    typography: config.typography,
    backgroundImages: config.backgroundImages,
    overlayOpacity: config.overlayOpacity,
    icons: config.icons,
  };
}

/**
 * Encode a ThemeConfig into a shareable theme code string.
 * Returns "RA-THEME:..." string.
 */
export async function encodeThemeCode(config: ThemeConfig): Promise<string> {
  const portable = toPortable(config);
  const json = JSON.stringify(portable);
  const bytes = new TextEncoder().encode(json);

  try {
    const { deflateSync } = await import("fflate");
    const compressed = deflateSync(bytes);
    const base64 = uint8ToBase64(compressed);
    return `${THEME_CODE_PREFIX}${base64}`;
  } catch {
    // Fallback: no compression, just base64
    const base64 = uint8ToBase64(bytes);
    return `${THEME_CODE_PREFIX}0:${base64}`;
  }
}

/**
 * Decode a theme code string back into a ThemeConfig.
 * Assigns a new id and timestamps. Returns null if invalid.
 */
export async function decodeThemeCode(code: string): Promise<ThemeConfig | null> {
  if (!code.startsWith(THEME_CODE_PREFIX)) return null;

  const payload = code.slice(THEME_CODE_PREFIX.length);

  try {
    let jsonStr: string;

    if (payload.startsWith("0:")) {
      // Uncompressed fallback
      const bytes = base64ToUint8(payload.slice(2));
      jsonStr = new TextDecoder().decode(bytes);
    } else {
      // Compressed
      const compressed = base64ToUint8(payload);
      const { inflateSync } = await import("fflate");
      const decompressed = inflateSync(compressed);
      jsonStr = new TextDecoder().decode(decompressed);
    }

    const portable = JSON.parse(jsonStr) as PortableTheme;

    // Validate minimum required fields
    if (!portable.name || !portable.modes) return null;
    if (!portable.modes.light && !portable.modes.dark) return null;

    const now = Date.now();
    return {
      id: `imported-${now}-${Math.random().toString(36).slice(2, 8)}`,
      name: portable.name,
      author: portable.author,
      builtIn: false,
      modes: portable.modes,
      typography: portable.typography,
      backgroundImages: portable.backgroundImages,
      overlayOpacity: portable.overlayOpacity,
      icons: portable.icons,
      createdAt: now,
      updatedAt: now,
    };
  } catch {
    return null;
  }
}

// ─── Base64 helpers (browser + RN compatible) ────────────────

function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  // Node.js / RN fallback
  return Buffer.from(bytes).toString("base64");
}

function base64ToUint8(base64: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  // Node.js / RN fallback
  return new Uint8Array(Buffer.from(base64, "base64"));
}
