/**
 * Subtitle generation utilities — SEPARATED from transcription logic.
 *
 * Responsible for:
 * 1. Grouping transcript words into short, readable subtitle blocks
 * 2. Converting subtitle groups to SRT format
 * 3. Generating kinetic-caption ASS with word-by-word karaoke highlight
 *
 * Rules enforced:
 * - Max ~4 words per subtitle block (keeps text short and readable)
 * - Max ~2 seconds display time per block
 * - Split on any silence gap ≥ 0.7s (prevents subtitles spanning pauses)
 * - Split on sentence-ending punctuation (. ! ? … etc.)
 * - Words displayed must match the audio as faithfully as possible
 */

import {
  SUBTITLE_CONSTRAINTS,
  RENDER,
  DEFAULT_SUBTITLE_STYLE,
  type SubtitleStyleConfig,
} from "./overlayConfig";

// ─── Types ───────────────────────────────────────────────────────────────────

/** A block of words with individual word timing preserved (for kinetic mode). */
export interface KineticBlock {
  /** Overall block start time (= first word start) */
  start: number;
  /** Overall block end time (= last word end) */
  end: number;
  /** The individual words in this block, each with their own timing */
  words: TranscriptWord[];
}

// ─── Classic-mode grouping (unchanged) ───────────────────────────────────────

/**
 * Group transcript words into subtitle blocks optimized for readability.
 *
 * Unlike the old approach (6 words, 1.5s silence threshold), this uses:
 * - Shorter blocks (≤4 words or ≤2s display, whichever comes first)
 * - Lower silence threshold (0.7s) to avoid spanning pauses
 * - Sentence boundary detection to keep phrases natural
 */
export function groupWordsIntoSubtitles(
  words: TranscriptWord[],
  maxWords: number = SUBTITLE_CONSTRAINTS.maxWordsPerBlock,
  maxDisplayDuration: number = SUBTITLE_CONSTRAINTS.maxDisplayDuration,
  silenceGapThreshold: number = SUBTITLE_CONSTRAINTS.silenceGapThreshold,
): TranscriptWord[] {
  const blocks: TranscriptWord[] = [];
  let current: TranscriptWord | null = null;
  let wordCount = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;

    // Detect silence gap between previous word and this one
    const silenceGap =
      current && i > 0 ? word.start - (words[i - 1]?.end ?? word.start) : 0;

    // Check if the PREVIOUS word ended a sentence (. ! ? … etc.)
    const prevEndedSentence =
      i > 0 && /[.!?…।。？！]$/.test(words[i - 1]!.text.trim());

    // Detect new sentence: current word starts with uppercase without
    // preceding sentence punctuation (catches missed periods in transcript)
    const startsNewSentence =
      i > 0 &&
      !prevEndedSentence &&
      /^[A-ZÀ-ÖØ-Þ]/.test(word.text.trim()) &&
      word.text.trim().length > 1;

    // Detect newline characters embedded in word text
    const hasNewline = i > 0 && /\n/.test(words[i - 1]!.text);

    // Check if current block exceeds max display duration
    const blockDuration = current ? word.end - current.start : 0;

    // Force a new subtitle block if:
    //  • first word
    //  • max words reached
    //  • silence gap exceeds threshold (prevents subtitles spanning pauses)
    //  • previous word ended a sentence
    //  • current word starts a new sentence (uppercase)
    //  • previous word contained a newline
    //  • block would exceed max display duration
    const shouldSplit =
      !current ||
      wordCount >= maxWords ||
      silenceGap >= silenceGapThreshold ||
      prevEndedSentence ||
      startsNewSentence ||
      hasNewline ||
      blockDuration >= maxDisplayDuration;

    if (shouldSplit) {
      if (current) {
        blocks.push(current);
      }
      current = {
        start: word.start,
        end: word.end,
        text: word.text,
        confidence: word.confidence,
      };
      wordCount = 1;
    } else {
      current!.end = word.end;
      current!.text += ` ${word.text}`;
      current!.confidence = Math.min(
        current!.confidence || 1,
        word.confidence || 1,
      );
      wordCount++;
    }
  }

  if (current) {
    blocks.push(current);
  }

  return blocks;
}

/**
 * Convert subtitle blocks to SRT format.
 */
export function generateSRT(blocks: TranscriptWord[]): string {
  let srt = "";

  blocks.forEach((block, index) => {
    const startTime = formatSrtTime(block.start);
    const endTime = formatSrtTime(block.end);

    srt += `${index + 1}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${block.text}\n\n`;
  });

  return srt;
}

// ─── Kinetic-mode grouping ───────────────────────────────────────────────────

/**
 * Group words into kinetic blocks.
 * Each block contains at most `maxWordsOnScreen` words (when > 0),
 * otherwise `maxWordsPerLine * maxLinesPerBlock` words max.
 * Respects silence gaps and sentence boundaries.
 * Individual word timing is preserved for karaoke rendering.
 */
export function groupWordsIntoKineticBlocks(
  words: TranscriptWord[],
  maxWordsPerLine: number = SUBTITLE_CONSTRAINTS.defaultMaxWordsPerLine,
  maxLines: number = 2,
  silenceGapThreshold: number = SUBTITLE_CONSTRAINTS.silenceGapThreshold,
  maxWordsOnScreen: number = 0, // 0 = use maxWordsPerLine * maxLines
): KineticBlock[] {
  const maxWordsPerBlock =
    maxWordsOnScreen > 0 ? maxWordsOnScreen : maxWordsPerLine * maxLines;
  const blocks: KineticBlock[] = [];
  let currentWords: TranscriptWord[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;

    // Detect silence gap
    const silenceGap =
      currentWords.length > 0
        ? word.start - (words[i - 1]?.end ?? word.start)
        : 0;

    // Check if previous word ended a sentence
    const prevEndedSentence =
      i > 0 && /[.!?…।。？！]$/.test(words[i - 1]!.text.trim());

    // Detect new sentence: current word starts with uppercase AND
    // previous word did NOT end with sentence punctuation (already handled above)
    // This catches cases like "merci Bonjour" where Deepgram doesn't add a period.
    const startsNewSentence =
      i > 0 &&
      !prevEndedSentence &&
      /^[A-ZÀ-ÖØ-Þ]/.test(word.text.trim()) &&
      // Ignore single uppercase letters and common proper nouns mid-sentence
      word.text.trim().length > 1;

    // Detect newline characters in the word text (rare, but possible)
    const hasNewline = i > 0 && /\n/.test(words[i - 1]!.text);

    const shouldSplit =
      currentWords.length === 0 ||
      currentWords.length >= maxWordsPerBlock ||
      silenceGap >= silenceGapThreshold ||
      prevEndedSentence ||
      startsNewSentence ||
      hasNewline;

    if (shouldSplit && currentWords.length > 0) {
      blocks.push({
        start: currentWords[0]!.start,
        end: currentWords[currentWords.length - 1]!.end,
        words: [...currentWords],
      });
      currentWords = [];
    }

    currentWords.push(word);
  }

  // Flush remaining words
  if (currentWords.length > 0) {
    blocks.push({
      start: currentWords[0]!.start,
      end: currentWords[currentWords.length - 1]!.end,
      words: [...currentWords],
    });
  }

  return blocks;
}

// ─── Kinetic ASS Generation ─────────────────────────────────────────────────

/** Convert hex "#RRGGBB" → ASS "&H00BBGGRR" */
function hexToAss(hex: string): string {
  const h = hex.replace("#", "");
  const r = h.substring(0, 2);
  const g = h.substring(2, 4);
  const b = h.substring(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

/** Convert hex "#RRGGBB" → ASS with alpha "&HAA BBGGRR" */
function hexToAssAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = h.substring(0, 2);
  const g = h.substring(2, 4);
  const b = h.substring(4, 6);
  const a = Math.round((1 - alpha) * 255)
    .toString(16)
    .toUpperCase()
    .padStart(2, "0");
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

/** Format seconds → ASS time "H:MM:SS.cc" (centiseconds) */
function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/**
 * Generate a complete ASS file with kinetic (word-by-word) captions.
 *
 * Strategy:
 * For each KineticBlock, we emit ONE Dialogue line per block.
 * Inside each Dialogue line, we use ASS override tags to style each word:
 *
 * - Previous words (already spoken): base primaryColor, normal scale
 * - Current word: highlightColor, optional scale-up via \fscx\fscy, bold
 * - Upcoming words: hidden or faded depending on upcomingWordVisibility
 *
 * We use \t (transform) tags for smooth animations and \kf (karaoke fill)
 * for progressive color fill on the active word.
 *
 * For maximum quality, we generate OVERLAPPING Dialogue lines — each
 * word gets its own timed event on a higher layer so scale/animation
 * transforms don't affect neighboring words. The base text (all words
 * in the block) is on layer 0 at reduced opacity.
 */
export function generateKineticASS(
  words: TranscriptWord[],
  style: Partial<SubtitleStyleConfig> = {},
): string {
  const s = { ...DEFAULT_SUBTITLE_STYLE, ...style };
  const playResX = RENDER.width;
  const playResY = RENDER.height;
  const bold = s.bold ? -1 : 0;
  const marginLR = 30;

  const blocks = groupWordsIntoKineticBlocks(
    words,
    s.maxWordsPerLine,
    s.maxLinesPerBlock,
    SUBTITLE_CONSTRAINTS.silenceGapThreshold,
    s.maxWordsOnScreen ?? 0,
  );

  console.log("[generateKineticASS] Config:", {
    blocks: blocks.length,
    totalWords: words.length,
    highlightColor: s.highlightColor,
    fadeColor: (s as any).fadeColor ?? s.primaryColor,
    highlightScale: s.highlightScale,
    animationStyle: s.animationStyle,
    upcomingWordVisibility: s.upcomingWordVisibility,
    maxWordsPerLine: s.maxWordsPerLine,
    maxLinesPerBlock: s.maxLinesPerBlock,
  });

  // ── ASS Header ──
  let ass = "[Script Info]\n";
  ass += "ScriptType: v4.00+\n";
  ass += `PlayResX: ${playResX}\n`;
  ass += `PlayResY: ${playResY}\n`;
  ass += "WrapStyle: 0\n";
  ass += "ScaledBorderAndShadow: yes\n\n";

  // ── Styles ──
  // "Base" style: the muted/neutral color for already-spoken and upcoming words
  // "Highlight" style: the active word style (bright color, potentially larger)
  ass += "[V4+ Styles]\n";
  ass +=
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n";

  // Base style — used as the default for all words in a block
  const backColor = s.backgroundStyle === "box" ? "&H80000000" : "&H00000000";
  ass += `Style: Base,${s.fontName},${s.fontSize},${hexToAss(s.primaryColor)},${hexToAss(s.primaryColor)},${hexToAss(s.outlineColor)},${backColor},${bold},0,0,0,100,100,0,0,${s.backgroundStyle === "box" ? 3 : 1},${s.outline},${s.shadow},${s.alignment},${marginLR},${marginLR},${s.marginV},1\n`;

  // Highlighted style — for the active word (uses highlightColor, optional scale)
  const hlScaleX = Math.round(s.highlightScale * 100);
  const hlScaleY = Math.round(s.highlightScale * 100);
  ass += `Style: Highlight,${s.fontName},${s.fontSize},${hexToAss(s.highlightColor)},${hexToAss(s.highlightColor)},${hexToAss(s.outlineColor)},${backColor},-1,0,0,0,${hlScaleX},${hlScaleY},0,0,${s.backgroundStyle === "box" ? 3 : 1},${s.outline},${s.shadow},${s.alignment},${marginLR},${marginLR},${s.marginV},1\n`;

  // Faded style — for upcoming words when upcomingWordVisibility === "faded"
  // Uses the dedicated fadeColor (defaults to grey) so it can be set independently
  const fadedBaseColor = (s as any).fadeColor ?? s.primaryColor;
  const fadedColor = hexToAss(fadedBaseColor);
  ass += `Style: Faded,${s.fontName},${s.fontSize},${fadedColor},${fadedColor},${hexToAssAlpha(s.outlineColor, 0.5)},${backColor},${bold},0,0,0,100,100,0,0,${s.backgroundStyle === "box" ? 3 : 1},${s.outline},${s.shadow},${s.alignment},${marginLR},${marginLR},${s.marginV},1\n`;

  ass += "\n[Events]\n";
  ass +=
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";

  // ── Generate Dialogue lines ──
  // For each block, we emit one dialogue line with inline override tags
  // that change color/scale per word based on timing.
  //
  // ASS approach: use \kf (karaoke fill) for smooth color transition per word.
  // \kf<duration_in_centiseconds> progressively fills the text from
  // SecondaryColour → PrimaryColour over the given duration.
  // We set SecondaryColour = muted and PrimaryColour = highlight.
  //
  // For scale animation, we use per-word \t() transforms.
  // Since \kf doesn't support per-word scale, we use a hybrid approach:
  // Layer 0: full block text in Base style (muted) — always visible
  // Layer 1+: per-word overlay in Highlight style with \t() animation
  //           each word only visible during its active time window

  for (const block of blocks) {
    const blockStart = formatAssTime(block.start);
    const blockEnd = formatAssTime(block.end);
    const blockWords = block.words;

    // ── Layer 0: Base text (all words in the block, muted color) ──
    // Build the full block text with line breaks at maxWordsPerLine
    const baseTextParts: string[] = [];
    for (let w = 0; w < blockWords.length; w++) {
      if (w > 0 && w % s.maxWordsPerLine === 0) {
        baseTextParts.push("\\N"); // ASS line break
      }
      const word = blockWords[w]!;

      if (s.upcomingWordVisibility === "hidden") {
        // Use \kf for progressive reveal: words appear as they're spoken
        // Duration in centiseconds for this word
        const wordDuration = Math.round((word.end - word.start) * 100);
        // Gap before this word (silence or inter-word gap)
        const gapBefore =
          w === 0 ? 0 : Math.round((word.start - blockWords[w - 1]!.end) * 100);
        // \k<gap> pauses the fill, then \kf<dur> fills the word
        if (gapBefore > 0) {
          baseTextParts.push(`{\\k${gapBefore}}`);
        }
        baseTextParts.push(`{\\kf${wordDuration}}${word.text}`);
      } else {
        // "faded" mode: all words visible from start in faded style
        // Words transition from faded → primary color as they are spoken
        baseTextParts.push(word.text);
      }

      if (w < blockWords.length - 1 && (w + 1) % s.maxWordsPerLine !== 0) {
        baseTextParts.push(" ");
      }
    }

    if (s.upcomingWordVisibility === "hidden") {
      // Use karaoke style: SecondaryColour = transparent, PrimaryColour = primaryColor
      // The \kf tag fills from transparent to primary color
      const karaokePrimary = hexToAss(s.primaryColor);
      const karaokeSecondary = hexToAssAlpha(s.primaryColor, 0); // fully transparent
      const overrides = `{\\1c${karaokePrimary}\\2c${karaokeSecondary}}`;
      ass += `Dialogue: 0,${blockStart},${blockEnd},Base,,0,0,0,,${overrides}${baseTextParts.join("")}\n`;
    } else {
      // Faded mode: show all words in faded style
      ass += `Dialogue: 0,${blockStart},${blockEnd},Faded,,0,0,0,,${baseTextParts.join("")}\n`;
    }

    // ── Layer 1: Per-word highlight overlays ──
    // Each word gets its own dialogue line on a higher layer,
    // visible only during that word's time window.
    // This allows independent scale/animation per word.

    for (let w = 0; w < blockWords.length; w++) {
      const word = blockWords[w]!;
      const wordStart = formatAssTime(word.start);
      const wordEnd = formatAssTime(word.end);
      // Enforce a minimum animation duration so short words still animate visibly
      const rawDurationMs = Math.round((word.end - word.start) * 1000);
      const wordDurationMs = Math.max(rawDurationMs, 200); // at least 200ms

      // Extend the Dialogue end time to accommodate the full animation
      // when the raw word duration is very short
      const effectiveEnd =
        rawDurationMs < 200 ? formatAssTime(word.start + 0.2) : wordEnd;

      // Build the text: all words in the block, but only the active word
      // is in highlight style; others are invisible (alpha=FF).
      const parts: string[] = [];
      for (let j = 0; j < blockWords.length; j++) {
        if (j > 0 && j % s.maxWordsPerLine === 0) {
          parts.push("\\N");
        }

        if (j === w) {
          // Active word — highlight color, optionally animated
          // Reset scale explicitly to avoid inheriting stale values
          let overrides = `\\1c${hexToAss(s.highlightColor)}\\bord${s.outline}\\alpha&H00&`;

          // Animation
          if (s.animationStyle === "pop") {
            // Scale up then back: start at 90%, peak at highlightScale, settle at 100%
            const peakX = Math.round(s.highlightScale * 100);
            const peakY = peakX;
            const rampUp = Math.max(
              Math.min(Math.round(wordDurationMs * 0.4), 150),
              60,
            );
            const rampDown = Math.max(
              Math.min(Math.round(wordDurationMs * 0.4), 200),
              80,
            );
            overrides += `\\fscx90\\fscy90`;
            overrides += `\\t(0,${rampUp},1,\\fscx${peakX}\\fscy${peakY})`;
            overrides += `\\t(${rampUp},${rampUp + rampDown},1,\\fscx100\\fscy100)`;
          } else if (s.animationStyle === "bounce") {
            const peakX = Math.round(s.highlightScale * 100);
            const peakY = peakX;
            const rampUp = Math.max(
              Math.min(Math.round(wordDurationMs * 0.3), 120),
              50,
            );
            const midSettle = Math.max(
              Math.min(Math.round(wordDurationMs * 0.25), 100),
              40,
            );
            const bounce = Math.max(
              Math.min(Math.round(wordDurationMs * 0.25), 100),
              40,
            );
            overrides += `\\fscx90\\fscy90`;
            overrides += `\\t(0,${rampUp},1,\\fscx${peakX}\\fscy${peakY})`;
            overrides += `\\t(${rampUp},${rampUp + midSettle},1,\\fscx95\\fscy95)`;
            overrides += `\\t(${rampUp + midSettle},${rampUp + midSettle + bounce},1,\\fscx100\\fscy100)`;
          } else if (s.animationStyle === "fade") {
            // Fade in from transparent
            const fadeIn = Math.max(
              Math.min(Math.round(wordDurationMs * 0.3), 150),
              60,
            );
            overrides += `\\alpha&HFF&\\t(0,${fadeIn},1,\\alpha&H00&)`;
          }
          // "none" → no animation overrides

          parts.push(`{${overrides}}${blockWords[j]!.text}`);
        } else {
          // Non-active word — fully transparent on this layer
          // Explicitly reset scale to 100% so previous word's scale doesn't leak
          parts.push(`{\\alpha&HFF&\\fscx100\\fscy100}${blockWords[j]!.text}`);
        }

        if (j < blockWords.length - 1 && (j + 1) % s.maxWordsPerLine !== 0) {
          parts.push(" ");
        }
      }

      ass += `Dialogue: 1,${wordStart},${effectiveEnd},Highlight,,0,0,0,,${parts.join("")}\n`;
    }
  }

  return ass;
}

// ─── Shared utilities ────────────────────────────────────────────────────────

/**
 * Extract words from transcript that fall within a segment's time window.
 *
 * Uses STRICT CONTAINMENT: only includes words whose start AND end
 * both fall within the segment window (± audio buffer).
 * This guarantees displayed words match the audible audio exactly.
 */
export function extractWordsForSegment(
  transcript: TranscriptWord[],
  segmentStart: number,
  segmentEnd: number,
  audioBuffer: number = 0.5,
): TranscriptWord[] {
  const windowStart = segmentStart - audioBuffer;
  const windowEnd = segmentEnd + audioBuffer;

  return transcript.filter((w) => w.start >= windowStart && w.end <= windowEnd);
}

/**
 * Adjust word timestamps to be relative to segment start.
 * (so t=0 = beginning of the clip)
 */
export function adjustTimestamps(
  words: TranscriptWord[],
  segmentStart: number,
): TranscriptWord[] {
  return words.map((w) => ({
    ...w,
    start: Math.max(0, w.start - segmentStart),
    end: Math.max(0, w.end - segmentStart),
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
