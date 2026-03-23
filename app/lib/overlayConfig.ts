/**
 * Centralized Overlay Configuration (client-side mirror)
 * Keep in sync with server/utils/overlayConfig.ts.
 *
 * ALL values are in VIDEO PIXELS (1080×1920).
 * The preview scales them down via CSS transform.
 * FFmpeg uses them directly — no conversion needed.
 */

// ─── Subtitle Defaults ───────────────────────────────────────────────────────

export const DEFAULT_SUBTITLE_STYLE = {
  fontName: "Arial",
  fontSize: 72,
  primaryColor: "#FFFFFF",
  outlineColor: "#000000",
  bold: true,
  outline: 5,
  shadow: 2,
  marginV: 80,
  alignment: 2,
} as const;

// ─── Subtitle Input Ranges ───────────────────────────────────────────────────

export const SUBTITLE_RANGES = {
  fontSize: { min: 16, max: 96, step: 1 },
  marginV: { min: 0, max: 200, step: 2 },
} as const;

// ─── Watermark Settings ──────────────────────────────────────────────────────

export const WATERMARK_CONFIG = {
  text: "made with Clipmafia",
  fontSize: 20,
  marginV: 30,
} as const;

// ─── Positioning Rules ──────────────────────────────────────────────────────

export function getWatermarkAlignment(subtitleAlignment: number): number {
  if (subtitleAlignment >= 1 && subtitleAlignment <= 3) return 8;
  return 2;
}

// ─── Video Rendering Constants ──────────────────────────────────────────────

export const RENDER = {
  width: 1080,
  height: 1920,
} as const;
