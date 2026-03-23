/**
 * Centralized Overlay Configuration (client-side mirror)
 * Shared with server/utils/overlayConfig.ts — keep in sync.
 */

// ─── Subtitle Defaults ───────────────────────────────────────────────────────

export const DEFAULT_SUBTITLE_STYLE = {
  fontName: "Arial",
  fontSize: 12,
  primaryColor: "#FFFFFF",
  outlineColor: "#000000",
  bold: true,
  outline: 2,
  shadow: 1,
  marginV: 12,
  alignment: 2,
} as const;

// ─── Subtitle Input Ranges ───────────────────────────────────────────────────

export const SUBTITLE_RANGES = {
  fontSize: { min: 8, max: 32, step: 1 },
  marginV: { min: 0, max: 24, step: 1 },
} as const;

// ─── Watermark Settings ──────────────────────────────────────────────────────

export const WATERMARK_CONFIG = {
  text: "made with Clipmafia",
  fontSize: 9,
  marginV: 12,
} as const;

// ─── Positioning Rules ──────────────────────────────────────────────────────

/**
 * Determine watermark alignment based on subtitle alignment.
 *  - Subtitles bottom  (1–3) → watermark top   (8)
 *  - Subtitles top     (7–9) → watermark bottom (2)
 *  - Subtitles center  (4–6) → watermark bottom (2)
 */
export function getWatermarkAlignment(subtitleAlignment: number): number {
  if (subtitleAlignment >= 1 && subtitleAlignment <= 3) return 8;
  return 2;
}

// ─── Video Rendering Constants ──────────────────────────────────────────────

export const RENDER = {
  width: 1080,
  height: 1920,
} as const;

// ─── Preview / Phone Mockup Constants ───────────────────────────────────────
// fontSize and marginV stored in the settings are "phone screen pixels"
// (what looks natural on a 390px-wide phone).
// FFmpeg must scale them to ASS coordinates using PREVIEW_TO_ASS_SCALE.

export const PHONE_PREVIEW = {
  width: 390,
  height: 844,
} as const;

/** Multiply fontSize / marginV by this to get ASS coordinate values for FFmpeg. */
export const PREVIEW_TO_ASS_SCALE = RENDER.width / PHONE_PREVIEW.width; // ≈ 2.77
