/**
 * Subtitle generation utilities — SEPARATED from transcription logic.
 *
 * Responsible for:
 * 1. Grouping transcript words into short, readable subtitle blocks
 * 2. Converting subtitle groups to SRT format
 *
 * Rules enforced:
 * - Max ~4 words per subtitle block (keeps text short and readable)
 * - Max ~2 seconds display time per block
 * - Split on any silence gap ≥ 0.7s (prevents subtitles spanning pauses)
 * - Split on sentence-ending punctuation (. ! ? … etc.)
 * - Words displayed must match the audio as faithfully as possible
 */

import { SUBTITLE_CONSTRAINTS } from "./overlayConfig";

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

    // Check if current block exceeds max display duration
    const blockDuration = current ? word.end - current.start : 0;

    // Force a new subtitle block if:
    //  • first word
    //  • max words reached
    //  • silence gap exceeds threshold (prevents subtitles spanning pauses)
    //  • previous word ended a sentence
    //  • block would exceed max display duration
    const shouldSplit =
      !current ||
      wordCount >= maxWords ||
      silenceGap >= silenceGapThreshold ||
      prevEndedSentence ||
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
