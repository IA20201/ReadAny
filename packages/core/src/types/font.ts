/**
 * Custom font types for user-uploaded fonts
 */

export type FontFormat = "ttf" | "otf" | "woff" | "woff2";

export type FontSource = "local" | "remote";

export interface CustomFont {
  id: string;
  name: string;
  fileName: string;
  filePath?: string;
  fontFamily: string;
  format: FontFormat;
  size?: number;
  addedAt: number;
  source: FontSource;
  remoteUrl?: string;
  remoteUrlWoff2?: string;
}

export interface FontPreset {
  id: string;
  name: string;
  nameEn: string;
  fontFamily: string;
  isCustom?: boolean;
}

export const SYSTEM_FONTS: FontPreset[] = [
  { id: "system", name: "系统默认", nameEn: "System Default", fontFamily: "system-ui" },
  { id: "serif", name: "衬线体", nameEn: "Serif", fontFamily: "Georgia, serif" },
  { id: "sans", name: "无衬线体", nameEn: "Sans-serif", fontFamily: "Arial, sans-serif" },
  { id: "mono", name: "等宽字体", nameEn: "Monospace", fontFamily: "Menlo, monospace" },
];
