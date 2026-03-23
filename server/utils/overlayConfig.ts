/**
 * Centralized Overlay Configuration
 * Single source of truth for subtitle styles, watermark settings, and positioning rules.
 *
 * ALL values (fontSize, outline, shadow, marginV) are in VIDEO PIXELS (1080×1920).
 * The preview scales them down proportionally via CSS transform.
 * FFmpeg uses them directly in the ASS file (PlayResX=1080, PlayResY=1920).
 * No conversion, no ratio, no phone-pixel concept.
 */

// ─── Subtitle Defaults ───────────────────────────────────────────────────────

export interface SubtitleStyleConfig {
  fontName: string;
  fontSize: number; // video pixels (1080×1920)
  primaryColor: string; // hex "#RRGGBB"
  outlineColor: string; // hex "#RRGGBB"
  bold: boolean;
  outline: number; // video pixels
  shadow: number; // video pixels
  marginV: number; // video pixels
  alignment: number; // ASS alignment: 2=bottom, 5=center, 8=top
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyleConfig = {
  fontName: "Arial",
  fontSize: 72,
  primaryColor: "#FFFFFF",
  outlineColor: "#000000",
  bold: true,
  outline: 5,
  shadow: 2,
  marginV: 80,
  alignment: 2,
};

// ─── Subtitle Input Ranges ───────────────────────────────────────────────────

export const SUBTITLE_RANGES = {
  fontSize: { min: 16, max: 96, step: 1 },
  marginV: { min: 0, max: 200, step: 2 },
} as const;

// ─── Watermark Settings ──────────────────────────────────────────────────────

export interface WatermarkConfig {
  text: string;
  fontName: string;
  fontSize: number; // video pixels
  color: string;
  outlineColor: string;
  outline: number;
  shadow: number;
  marginV: number; // video pixels
  opacity: number;
}

export const WATERMARK_CONFIG: WatermarkConfig = {
  text: "made with Clipmafia",
  fontName: "Arial",
  fontSize: 20,
  color: "#CCCCCC",
  outlineColor: "#000000",
  outline: 1,
  shadow: 0,
  marginV: 30,
  opacity: 0.7,
};

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
