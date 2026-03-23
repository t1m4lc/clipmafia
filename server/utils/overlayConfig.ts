/**
 * Centralized Overlay Configuration
 * Single source of truth for subtitle styles, watermark settings, and positioning rules.
 */

// ─── Subtitle Defaults ───────────────────────────────────────────────────────

export interface SubtitleStyleConfig {
  fontName: string;
  fontSize: number;
  primaryColor: string; // hex "#RRGGBB"
  outlineColor: string; // hex "#RRGGBB"
  bold: boolean;
  outline: number;
  shadow: number;
  marginV: number;
  alignment: number; // ASS alignment: 2=bottom, 5=center, 8=top
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyleConfig = {
  fontName: "Arial",
  fontSize: 12,
  primaryColor: "#FFFFFF",
  outlineColor: "#000000",
  bold: true,
  outline: 2,
  shadow: 1,
  marginV: 12,
  alignment: 2,
};

// ─── Subtitle Input Ranges ───────────────────────────────────────────────────

export const SUBTITLE_RANGES = {
  fontSize: { min: 8, max: 32, step: 1 },
  marginV: { min: 0, max: 24, step: 1 },
} as const;

// ─── Watermark Settings ──────────────────────────────────────────────────────

export interface WatermarkConfig {
  text: string;
  fontName: string;
  fontSize: number;
  color: string; // hex "#RRGGBB"
  outlineColor: string; // hex "#RRGGBB"
  outline: number;
  shadow: number;
  marginV: number;
  opacity: number; // 0.0–1.0
}

export const WATERMARK_CONFIG: WatermarkConfig = {
  text: "made with Clipmafia",
  fontName: "Arial",
  fontSize: 9,
  color: "#CCCCCC",
  outlineColor: "#000000",
  outline: 1,
  shadow: 0,
  marginV: 12,
  opacity: 0.7,
};

// ─── Positioning Rules ──────────────────────────────────────────────────────

/**
 * Determine watermark alignment based on subtitle alignment.
 * Rule: watermark must never overlap subtitles.
 *  - Subtitles bottom  (alignment 1–3) → watermark top   (alignment 8)
 *  - Subtitles top     (alignment 7–9) → watermark bottom (alignment 2)
 *  - Subtitles center  (alignment 4–6) → watermark bottom (alignment 2)
 */
export function getWatermarkAlignment(subtitleAlignment: number): number {
  if (subtitleAlignment >= 1 && subtitleAlignment <= 3) return 8; // top
  return 2; // bottom
}

// ─── Video Rendering Constants ──────────────────────────────────────────────

export const RENDER = {
  /** Output width of vertical shorts (9:16) */
  width: 1080,
  /** Output height of vertical shorts (9:16) */
  height: 1920,
  /** ASS PlayResX / PlayResY must match these */
  playResX: 1080,
  playResY: 1920,
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

// ─── Segment Duration Constraints ───────────────────────────────────────────

export const SEGMENT_CONSTRAINTS = {
  /** Absolute minimum duration in seconds — never generate clips shorter */
  absoluteMinDuration: 8,
  /** How close segments should be to the target duration (as fraction) */
  targetFraction: 0.65,
  /** Audio safety buffer added after segment end (seconds) */
  audioBufferAfter: 0.5,
  /** Audio safety buffer added before segment start (seconds) */
  audioBufferBefore: 0.5,
  /** Silence gap threshold for splitting segments (seconds) */
  silenceGapThreshold: 1.5,
} as const;
