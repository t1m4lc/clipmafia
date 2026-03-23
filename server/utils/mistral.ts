import type { TranscriptWord, Segment, DurationOption } from "~/types/database";
import { SEGMENT_CONSTRAINTS } from "./overlayConfig";

/**
 * Detect silence gaps in the transcript.
 * Returns an array of {start, end} for gaps > threshold.
 */
function detectSilenceGaps(
  transcript: TranscriptWord[],
  threshold: number = SEGMENT_CONSTRAINTS.silenceGapThreshold,
): Array<{ start: number; end: number }> {
  const gaps: Array<{ start: number; end: number }> = [];
  for (let i = 1; i < transcript.length; i++) {
    const prev = transcript[i - 1]!;
    const curr = transcript[i]!;
    const gap = curr.start - prev.end;
    if (gap >= threshold) {
      gaps.push({ start: prev.end, end: curr.start });
    }
  }
  return gaps;
}

/**
 * Post-process segments: enforce minimum duration, merge short segments,
 * apply audio safety buffers, and respect silence gaps.
 */
function postProcessSegments(
  segments: Segment[],
  durationOption: DurationOption,
  videoDuration: number,
  transcript: TranscriptWord[],
): Segment[] {
  const {
    absoluteMinDuration,
    audioBufferAfter,
    audioBufferBefore,
    silenceGapThreshold,
  } = SEGMENT_CONSTRAINTS;

  const silenceGaps = detectSilenceGaps(transcript, silenceGapThreshold);

  // 1. Apply audio safety buffers to avoid cutting mid-word
  let processed = segments.map((seg) => {
    let start = Math.max(0, seg.start - audioBufferBefore);
    let end = Math.min(videoDuration, seg.end + audioBufferAfter);

    // Snap to nearest silence boundary if close
    for (const gap of silenceGaps) {
      // Snap start to silence end if within 1s
      if (Math.abs(gap.end - seg.start) < 1.0) {
        start = gap.end;
      }
      // Snap end to silence start if within 1s
      if (Math.abs(gap.start - seg.end) < 1.0) {
        end = gap.start;
      }
    }

    // Ensure we don't exceed the duration option
    if (end - start > durationOption) {
      end = start + durationOption;
    }

    return {
      ...seg,
      start: Math.round(start * 10) / 10,
      end: Math.round(end * 10) / 10,
    };
  });

  // 2. Merge segments that are too short
  const merged: Segment[] = [];
  for (const seg of processed) {
    const duration = seg.end - seg.start;

    if (duration < absoluteMinDuration && merged.length > 0) {
      // Try to merge with the previous segment
      const prev = merged[merged.length - 1]!;
      const mergedDuration = seg.end - prev.start;

      // Only merge if combined duration doesn't exceed the target
      if (mergedDuration <= durationOption) {
        prev.end = seg.end;
        prev.score = Math.max(prev.score, seg.score);
        // Keep the higher-scoring title
        if (seg.score > prev.score) {
          prev.title = seg.title;
        }
        console.log(
          `[postProcess] Merged short segment "${seg.title}" (${duration.toFixed(1)}s) into previous → ${mergedDuration.toFixed(1)}s`,
        );
        continue;
      }
    }

    // If still too short and cannot merge, try extending the end
    if (duration < absoluteMinDuration) {
      const extendedEnd = Math.min(
        seg.start + absoluteMinDuration,
        videoDuration,
      );
      // Don't extend past the duration option
      if (extendedEnd - seg.start <= durationOption) {
        console.log(
          `[postProcess] Extended short segment "${seg.title}" from ${duration.toFixed(1)}s to ${(extendedEnd - seg.start).toFixed(1)}s`,
        );
        seg.end = Math.round(extendedEnd * 10) / 10;
      }
    }

    merged.push(seg);
  }

  // 3. Final filter: remove any segment still under minimum that couldn't be rescued
  const final = merged.filter((seg) => {
    const dur = seg.end - seg.start;
    if (dur < absoluteMinDuration) {
      console.warn(
        `[postProcess] Dropping segment "${seg.title}" — only ${dur.toFixed(1)}s (min: ${absoluteMinDuration}s)`,
      );
      return false;
    }
    return true;
  });

  // 4. Re-sort by score descending
  final.sort((a, b) => b.score - a.score);

  return final;
}

/**
 * Use Mistral AI to detect the best segments for short videos.
 * Analyzes the transcript and identifies engaging moments.
 */
export async function detectSegments(
  transcript: TranscriptWord[],
  durationOption: DurationOption,
  videoDuration: number,
): Promise<Segment[]> {
  const config = useRuntimeConfig();

  // Detect silence gaps for context
  const silenceGaps = detectSilenceGaps(transcript);
  const silenceInfo =
    silenceGaps.length > 0
      ? `\n\nSILENCE GAPS DETECTED (pauses > ${SEGMENT_CONSTRAINTS.silenceGapThreshold}s):\n${silenceGaps.map((g) => `  ${g.start.toFixed(1)}s – ${g.end.toFixed(1)}s (${(g.end - g.start).toFixed(1)}s pause)`).join("\n")}`
      : "";

  const minDuration = SEGMENT_CONSTRAINTS.absoluteMinDuration;
  const targetMin = Math.round(
    durationOption * SEGMENT_CONSTRAINTS.targetFraction,
  );

  // Build a readable transcript text with timestamps
  const transcriptText = transcript
    .map((w) => `[${w.start.toFixed(1)}s] ${w.text}`)
    .join(" ");

  const prompt = `You are an expert video editor specializing in creating viral short-form content.

Analyze this transcript from a video and identify the BEST segments that would make engaging short videos (Shorts/Reels/TikTok).

TRANSCRIPT (with timestamps in seconds):
${transcriptText}
${silenceInfo}

VIDEO DURATION: ${videoDuration} seconds
TARGET SEGMENT DURATION: ${durationOption} seconds
ABSOLUTE MINIMUM DURATION: ${minDuration} seconds (CRITICAL — NEVER generate a segment shorter than this)

LANGUAGE RULE: Your segment titles MUST be written in the SAME LANGUAGE as the transcript. Detect the language from the transcript text and use it.

DURATION RULES (CRITICAL):
1. Each segment MUST be between ${minDuration}s and ${durationOption}s (hard limits)
2. TARGET each segment to be ${targetMin}–${durationOption}s — closer to the max is better
3. NEVER generate a segment shorter than ${minDuration} seconds
4. Prefer FEWER high-quality, longer segments over many short useless clips
5. Each segment must contain a COMPLETE thought or story arc — never cut mid-sentence or mid-idea

CONTENT RULES:
1. Segments must not overlap
2. Start and end times must align with natural speech boundaries (don't cut mid-word)
3. Prefer starting/ending at silence gaps or natural pauses
4. Prioritize segments with:
   - Strong hooks or attention-grabbing openings
   - Complete thoughts or stories
   - Emotional moments
   - Actionable advice or key insights
   - Surprising or controversial statements
5. Score each segment from 0.0 to 1.0 based on viral potential
6. Give each segment a catchy, clickbait-style title IN THE SAME LANGUAGE as the transcript

Return ONLY a valid JSON array with this exact format (no markdown, no explanation):
[
  {
    "start": 32.5,
    "end": 62.1,
    "title": "Catchy title here",
    "score": 0.95
  }
]`;

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.mistralApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-large-latest",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral AI error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response from Mistral AI");
  }

  // Parse the JSON response
  let segments: Segment[];
  try {
    const parsed = JSON.parse(content);
    // Handle both direct array and object with segments key
    segments = Array.isArray(parsed) ? parsed : parsed.segments || [];
  } catch {
    throw new Error(`Failed to parse Mistral response: ${content}`);
  }

  // Validate and clean segments (basic)
  segments = segments
    .filter((s) => s.start >= 0 && s.end <= videoDuration && s.end > s.start)
    .map((s) => {
      let start = Math.round(s.start * 10) / 10;
      let end = Math.round(s.end * 10) / 10;
      const segDuration = end - start;

      // STRICT ENFORCEMENT: clip segments that exceed the target duration
      if (segDuration > durationOption + 1) {
        console.warn(
          `[Mistral] Segment "${s.title}" was ${segDuration}s, trimming to ${durationOption}s`,
        );
        end = Math.round((start + durationOption) * 10) / 10;
      }

      return {
        start,
        end,
        title: s.title || "Untitled Segment",
        score: Math.min(1, Math.max(0, s.score || 0.5)),
      };
    });

  // Post-process: enforce min duration, merge short segments, apply buffers
  segments = postProcessSegments(
    segments,
    durationOption,
    videoDuration,
    transcript,
  );

  console.log(
    `[Mistral] Final segments after post-processing: ${segments.length} segments`,
    segments.map(
      (s) =>
        `"${s.title}" ${s.start}–${s.end}s (${(s.end - s.start).toFixed(1)}s)`,
    ),
  );

  return segments;
}
