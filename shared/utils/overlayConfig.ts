/**
 * Centralized Overlay Configuration — SINGLE SOURCE OF TRUTH
 * Shared between server (FFmpeg rendering) and client (preview + settings form).
 *
 * ALL values (fontSize, outline, shadow, marginV) are in VIDEO PIXELS (1080×1920).
 * The preview scales them down proportionally via CSS transform.
 * FFmpeg uses them directly in the ASS file (PlayResX=1080, PlayResY=1920).
 * No conversion, no ratio, no phone-pixel concept.
 */

// ─── Subtitle Mode ───────────────────────────────────────────────────────────

/** Classic = block subtitles (current behaviour). Kinetic = word-by-word highlight. */
export type SubtitleMode = "classic" | "kinetic";

/** Animation applied to the currently-spoken word in kinetic mode. */
export type KineticAnimation = "none" | "fade" | "pop" | "bounce";

/** How upcoming (not-yet-spoken) words are displayed. */
export type UpcomingWordVisibility = "hidden" | "faded";

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

  // ── Kinetic caption fields ──
  subtitleMode: SubtitleMode;
  highlightColor: string; // hex "#RRGGBB" — spoken-word color
  fadeColor: string; // hex "#RRGGBB" — upcoming/faded word color
  highlightScale: number; // e.g. 1.2 = 120% of fontSize
  animationStyle: KineticAnimation;
  upcomingWordVisibility: UpcomingWordVisibility;
  maxWordsPerLine: number; // words before line-break (1–8)
  maxLinesPerBlock: number; // max visible lines per block (1–2)
  maxWordsOnScreen: number; // total words shown at once (1 = one-word TikTok style)
  backgroundStyle: "none" | "box"; // subtitle background
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

  // Kinetic defaults
  subtitleMode: "classic",
  highlightColor: "#FFFF00",
  fadeColor: "#888888",
  highlightScale: 1.15,
  animationStyle: "pop",
  upcomingWordVisibility: "faded",
  maxWordsPerLine: 4,
  maxLinesPerBlock: 2,
  maxWordsOnScreen: 8, // 0 = no limit (use maxWordsPerLine * maxLinesPerBlock)
  backgroundStyle: "none",
};

// ─── Subtitle Input Ranges ───────────────────────────────────────────────────

export const SUBTITLE_RANGES = {
  fontSize: { min: 16, max: 96, step: 1 },
  marginV: { min: 0, max: 600, step: 2 },
  highlightScale: { min: 1.0, max: 1.5, step: 0.05 },
  maxWordsPerLine: { min: 1, max: 8, step: 1 },
  maxLinesPerBlock: { min: 1, max: 2, step: 1 },
  maxWordsOnScreen: { min: 1, max: 12, step: 1 },
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
  /** Max words per subtitle block (keeps text short and readable) — classic mode */
  maxWordsPerBlock: 5,
  /** Max display duration per subtitle block in seconds */
  maxDisplayDuration: 2.5,
  /** Silence gap threshold for splitting subtitle blocks (seconds) */
  silenceGapThreshold: 0.7,
  /** Default max words per visual line in kinetic mode */
  defaultMaxWordsPerLine: 4,
} as const;

// ─── Kinetic Caption Presets ─────────────────────────────────────────────────

export interface KineticPreset {
  label: string;
  description: string;
  config: Partial<SubtitleStyleConfig>;
}

export const KINETIC_PRESETS: Record<string, KineticPreset> = {
  tiktokBold: {
    label: "TikTok Bold",
    description: "One word at a time, big yellow pop — maximum impact",
    config: {
      subtitleMode: "kinetic",
      fontName: "Impact",
      fontSize: 88,
      primaryColor: "#FFFFFF",
      outlineColor: "#000000",
      highlightColor: "#FFFF00",
      highlightScale: 1.15,
      animationStyle: "pop",
      bold: true,
      outline: 7,
      shadow: 4,
      maxWordsOnScreen: 1,
      maxWordsPerLine: 1,
      maxLinesPerBlock: 1,
      upcomingWordVisibility: "hidden",
      backgroundStyle: "none",
    },
  },
  reels: {
    label: "Reels",
    description: "3-word blocks, white highlight, clean bounce",
    config: {
      subtitleMode: "kinetic",
      fontName: "Arial",
      fontSize: 72,
      primaryColor: "#999999",
      outlineColor: "#000000",
      highlightColor: "#FFFFFF",
      fadeColor: "#555555",
      highlightScale: 1.12,
      animationStyle: "bounce",
      bold: true,
      outline: 5,
      shadow: 3,
      maxWordsOnScreen: 3,
      maxWordsPerLine: 3,
      maxLinesPerBlock: 1,
      upcomingWordVisibility: "faded",
      backgroundStyle: "none",
    },
  },
  minimal: {
    label: "Minimal",
    description: "Subtle fade, all words visible — professional look",
    config: {
      subtitleMode: "kinetic",
      fontName: "Helvetica",
      fontSize: 58,
      primaryColor: "#888888",
      outlineColor: "#000000",
      highlightColor: "#FFFFFF",
      fadeColor: "#444444",
      highlightScale: 1.08,
      animationStyle: "fade",
      bold: false,
      outline: 3,
      shadow: 1,
      maxWordsOnScreen: 8,
      maxWordsPerLine: 4,
      maxLinesPerBlock: 2,
      upcomingWordVisibility: "faded",
      backgroundStyle: "none",
    },
  },
  neon: {
    label: "Neon",
    description: "Vibrant green glow, one word at a time",
    config: {
      subtitleMode: "kinetic",
      fontName: "Arial",
      fontSize: 80,
      primaryColor: "#555555",
      outlineColor: "#001100",
      highlightColor: "#39FF14",
      highlightScale: 1.2,
      animationStyle: "pop",
      bold: true,
      outline: 5,
      shadow: 6,
      maxWordsOnScreen: 1,
      maxWordsPerLine: 1,
      maxLinesPerBlock: 1,
      upcomingWordVisibility: "hidden",
      backgroundStyle: "none",
    },
  },
  karaoke: {
    label: "Karaoke",
    description: "Smooth color fill, full phrase visible",
    config: {
      subtitleMode: "kinetic",
      fontName: "Arial",
      fontSize: 62,
      primaryColor: "#888888",
      outlineColor: "#000000",
      highlightColor: "#00BFFF",
      fadeColor: "#444444",
      highlightScale: 1.0,
      animationStyle: "none",
      bold: true,
      outline: 5,
      shadow: 2,
      maxWordsOnScreen: 6,
      maxWordsPerLine: 3,
      maxLinesPerBlock: 2,
      upcomingWordVisibility: "faded",
      backgroundStyle: "none",
    },
  },
  boxed: {
    label: "Boxed",
    description: "Semi-transparent background box, clean fade",
    config: {
      subtitleMode: "kinetic",
      fontName: "Verdana",
      fontSize: 58,
      primaryColor: "#CCCCCC",
      outlineColor: "#000000",
      highlightColor: "#FFFFFF",
      fadeColor: "#777777",
      highlightScale: 1.1,
      animationStyle: "fade",
      bold: true,
      outline: 0,
      shadow: 0,
      maxWordsOnScreen: 6,
      maxWordsPerLine: 3,
      maxLinesPerBlock: 2,
      upcomingWordVisibility: "faded",
      backgroundStyle: "box",
    },
  },
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
