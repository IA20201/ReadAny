const PREFIX = "readany:";

// Try native btoa/atob first, fall back to manual implementation
const hasBtoa = typeof globalThis.btoa === "function";
const hasAtob = typeof globalThis.atob === "function";

const B64CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function manualBtoa(bytes: Uint8Array): string {
  let result = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const a = bytes[i];
    const b = i + 1 < len ? bytes[i + 1] : 0;
    const c = i + 2 < len ? bytes[i + 2] : 0;
    result += B64CHARS[a >> 2];
    result += B64CHARS[((a & 3) << 4) | (b >> 4)];
    result += i + 1 < len ? B64CHARS[((b & 0xf) << 2) | (c >> 6)] : "=";
    result += i + 2 < len ? B64CHARS[c & 0x3f] : "=";
  }
  return result;
}

function manualAtob(str: string): Uint8Array {
  const clean = str.replace(/[^A-Za-z0-9+/=]/g, "");
  const len = clean.length;
  const bytes: number[] = [];
  for (let i = 0; i < len; i += 4) {
    const a = B64CHARS.indexOf(clean[i]);
    const b = B64CHARS.indexOf(clean[i + 1]);
    const c = B64CHARS.indexOf(clean[i + 2]);
    const d = B64CHARS.indexOf(clean[i + 3]);
    bytes.push((a << 2) | (b >> 4));
    if (clean[i + 2] !== "=") bytes.push(((b & 0xf) << 4) | (c >> 2));
    if (clean[i + 3] !== "=") bytes.push(((c & 3) << 6) | d);
  }
  return new Uint8Array(bytes);
}

/** Encode any JSON-serializable data into a transfer token */
export function encodeConfig(data: unknown): string {
  const json = JSON.stringify(data);
  // Use encodeURIComponent/unescape trick to convert UTF-8 to Latin-1 for btoa
  const latin1 = unescape(encodeURIComponent(json));
  if (hasBtoa) {
    return PREFIX + globalThis.btoa(latin1);
  }
  // Manual: convert Latin-1 string to bytes then base64
  const bytes = new Uint8Array(latin1.length);
  for (let i = 0; i < latin1.length; i++) bytes[i] = latin1.charCodeAt(i);
  return PREFIX + manualBtoa(bytes);
}

/** Decode a transfer token back to data. Returns null if invalid. */
export function decodeConfig<T>(token: string): T | null {
  try {
    const trimmed = token.trim();
    if (!trimmed.startsWith(PREFIX)) return null;
    const base64 = trimmed.slice(PREFIX.length);
    let latin1: string;
    if (hasAtob) {
      latin1 = globalThis.atob(base64);
    } else {
      const bytes = manualAtob(base64);
      latin1 = "";
      for (let i = 0; i < bytes.length; i++) latin1 += String.fromCharCode(bytes[i]);
    }
    const json = decodeURIComponent(escape(latin1));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
