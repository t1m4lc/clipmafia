/**
 * Centralized Overlay Configuration — SINGLE SOURCE OF TRUTH
 * Shared between server (FFmpeg rendering) and client (preview + settings form).
 *
 * ALL values (fontSize, outline, shadow, marginV) are in VIDEO PIXELS (1080×1920).
 * The preview scales them down proportionally via CSS transform.
 * FFmpeg uses them directly in the ASS file (PlayResX=1080, PlayResY=1920).
 * No conversion, no ratio, no phone-pixel concept.
 */

// ─── Subtitle Style ──────────────────────────────────────────────────────────

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
  fontName: "Courier New",
  fontSize: 60,
  primaryColor: "#FFFFFF",
  outlineColor: "#000000",
  bold: true,
  outline: 5,
  shadow: 2,
  marginV: 450,
  alignment: 2,
};

// ─── Subtitle Input Ranges ───────────────────────────────────────────────────

export const SUBTITLE_RANGES = {
  fontSize: { min: 16, max: 96, step: 1 },
  marginV: { min: 0, max: 600, step: 2 },
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
  text: "made with clipmafia.com",
  fontName: "Courier New",
  fontSize: 26,
  color: "#FFFFFF",
  outlineColor: "#000000",
  outline: 3,
  shadow: 2,
  marginV: 150,
  opacity: 0.85,
};

// ─── Positioning Rules ──────────────────────────────────────────────────────

/**
 * Returns the watermark ASS alignment based on subtitle position.
 * Subtitles at bottom (1–3) → watermark goes to top (8).
 * Subtitles at top or middle → watermark goes to bottom (2).
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

// ─── Subtitle Display Constraints ───────────────────────────────────────────

export const SUBTITLE_CONSTRAINTS = {
  /** Max words per subtitle block (keeps text short and readable) */
  maxWordsPerBlock: 5,
  /** Max display duration per subtitle block in seconds */
  maxDisplayDuration: 2.5,
  /** Silence gap threshold for splitting subtitle blocks (seconds) */
  silenceGapThreshold: 0.7,
} as const;

// ─── Segment Duration Constraints ───────────────────────────────────────────

export const SEGMENT_CONSTRAINTS = {
  /** Absolute minimum duration in seconds — never generate clips shorter */
  absoluteMinDuration: 10,
  /** Soft maximum duration in seconds — AI can go up to this */
  softMaxDuration: 70,
  /** Audio safety buffer added after segment end (seconds) */
  audioBufferAfter: 0.65,
  /** Audio safety buffer added before segment start (seconds) */
  audioBufferBefore: 0.65,
  /** Silence gap threshold for segment boundary snapping (seconds) */
  silenceGapThreshold: 1,
} as const;
