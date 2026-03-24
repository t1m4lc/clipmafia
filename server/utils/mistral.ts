import { SEGMENT_CONSTRAINTS } from "./overlayConfig";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
 * Calculate speech density for a segment (0–1, where 1 = continuous speech).
 */
function calculateSpeechDensity(
  segment: Segment,
  transcript: TranscriptWord[],
): number {
  const segDuration = segment.end - segment.start;
  if (segDuration <= 0) return 0;

  const wordsInRange = transcript.filter(
    (w) => w.end > segment.start && w.start < segment.end,
  );
  if (wordsInRange.length === 0) return 0;

  let speechTime = 0;
  for (const w of wordsInRange) {
    const wordStart = Math.max(w.start, segment.start);
    const wordEnd = Math.min(w.end, segment.end);
    speechTime += wordEnd - wordStart;
  }

  return speechTime / segDuration;
}

/**
 * Find the longest internal silence gap within a segment.
 */
function longestInternalSilence(
  segment: Segment,
  transcript: TranscriptWord[],
): number {
  const wordsInRange = transcript.filter(
    (w) => w.start >= segment.start && w.end <= segment.end,
  );
  if (wordsInRange.length < 2) return 0;

  let maxGap = 0;
  for (let i = 1; i < wordsInRange.length; i++) {
    const gap = wordsInRange[i]!.start - wordsInRange[i - 1]!.end;
    if (gap > maxGap) maxGap = gap;
  }
  return maxGap;
}

/**
 * Check if a segment ends with sentence-ending punctuation.
 */
function hasCompleteSentences(
  segment: Segment,
  transcript: TranscriptWord[],
): boolean {
  const wordsInRange = transcript.filter(
    (w) => w.start >= segment.start && w.end <= segment.end,
  );
  if (wordsInRange.length === 0) return false;
  const lastWord = wordsInRange[wordsInRange.length - 1]!;
  return /[.!?…।。？！]$/.test(lastWord.text.trim());
}

// ─── Post-processing (3 clear passes) ───────────────────────────────────────

/**
 * Post-process segments with 3 simple passes:
 *  1. Snap boundaries to nearest silence gap & apply ±1s audio buffer
 *  2. Drop segments shorter than absoluteMinDuration
 *  3. Apply speech-density / silence penalties, then sort by score descending
 */
function postProcessSegments(
  segments: Segment[],
  videoDuration: number,
  transcript: TranscriptWord[],
): Segment[] {
  const {
    absoluteMinDuration,
    softMaxDuration,
    audioBufferAfter,
    audioBufferBefore,
    silenceGapThreshold,
  } = SEGMENT_CONSTRAINTS;

  const silenceGaps = detectSilenceGaps(transcript, silenceGapThreshold);

  // ── Pass 1: Snap to silence boundaries & apply audio buffers ──
  let processed = segments.map((seg) => {
    let start = Math.max(0, seg.start - audioBufferBefore);
    let end = Math.min(videoDuration, seg.end + audioBufferAfter);

    // Snap to nearest silence boundary if within 1s
    for (const gap of silenceGaps) {
      if (Math.abs(gap.end - seg.start) < 1.0) {
        start = gap.end;
      }
      if (Math.abs(gap.start - seg.end) < 1.0) {
        end = gap.start;
      }
    }

    // Cap at softMaxDuration
    if (end - start > softMaxDuration) {
      end = start + softMaxDuration;
    }

    return {
      ...seg,
      start: Math.round(start * 10) / 10,
      end: Math.round(end * 10) / 10,
    };
  });

  // ── Pass 2: Drop segments shorter than minimum ──
  processed = processed.filter((seg) => {
    const dur = seg.end - seg.start;
    if (dur < absoluteMinDuration) {
      console.warn(
        `[postProcess] Dropping segment "${seg.title}" — only ${dur.toFixed(1)}s (min: ${absoluteMinDuration}s)`,
      );
      return false;
    }
    return true;
  });

  // ── Pass 3: Score adjustments & sort ──
  for (const seg of processed) {
    const density = calculateSpeechDensity(seg, transcript);
    const maxSilence = longestInternalSilence(seg, transcript);
    const complete = hasCompleteSentences(seg, transcript);

    let scoreAdj = seg.score;

    // Penalize low speech density
    if (density < 0.3) {
      scoreAdj *= 0.5;
    } else if (density < 0.5) {
      scoreAdj *= 0.75;
    }

    // Penalize long internal silences
    if (maxSilence > 3.0) {
      scoreAdj *= 0.6;
    } else if (maxSilence > 2.0) {
      scoreAdj *= 0.8;
    }

    // Small bonus for complete sentences
    if (complete) {
      scoreAdj = Math.min(1.0, scoreAdj * 1.05);
    }

    seg.score = Math.round(scoreAdj * 100) / 100;

    console.log(
      `[postProcess] "${seg.title}": density=${(density * 100).toFixed(0)}%, maxSilence=${maxSilence.toFixed(1)}s, complete=${complete}, score=${seg.score}`,
    );
  }

  // Sort by score descending — best segments first
  processed.sort((a, b) => b.score - a.score);

  return processed;
}

// ─── Main: Mistral AI segment detection ──────────────────────────────────────

/**
 * Use Mistral AI to identify all coherent, self-contained passages
 * that would make engaging short videos.
 *
 * The AI chooses the natural duration for each passage (variable length).
 * It maximizes the number of passages while keeping each one coherent.
 * Each passage receives a virality score (0–1).
 */
export async function detectSegments(
  transcript: TranscriptWord[],
  videoDuration: number,
): Promise<Segment[]> {
  const config = useRuntimeConfig();

  const { absoluteMinDuration, softMaxDuration, silenceGapThreshold } =
    SEGMENT_CONSTRAINTS;

  // Detect silence gaps for context
  const silenceGaps = detectSilenceGaps(transcript, silenceGapThreshold);
  const silenceInfo =
    silenceGaps.length > 0
      ? `\n\nSILENCE GAPS DETECTED (pauses > ${silenceGapThreshold}s):\n${silenceGaps.map((g) => `  ${g.start.toFixed(1)}s – ${g.end.toFixed(1)}s (${(g.end - g.start).toFixed(1)}s pause)`).join("\n")}`
      : "";

  // Build timestamped transcript
  const transcriptText = transcript
    .map((w) => `[${w.start.toFixed(1)}s] ${w.text}`)
    .join(" ");

  const prompt = `You are an expert video editor who creates viral short-form content for TikTok, YouTube Shorts, and Instagram Reels.

TASK: Analyze this transcript and identify ALL coherent, self-contained passages that would make engaging short videos.

TRANSCRIPT (with timestamps in seconds):
${transcriptText}
${silenceInfo}

VIDEO DURATION: ${videoDuration.toFixed(1)} seconds

═══════════════════════════════════════════════════════
DIRECTIVE 1 — IDENTIFY ALL COHERENT PASSAGES
═══════════════════════════════════════════════════════
- Find EVERY passage that forms a complete, self-contained thought (intro → development → conclusion).
- MAXIMIZE the number of passages extracted — cover as much of the transcript as possible.
- Each passage must make sense on its own without additional context.
- Passages must NOT overlap.
- VARIABLE DURATION: let each passage have its natural length. Some ideas need 15s, others 60s+. Choose what fits the content.
- Hard limits: minimum ${absoluteMinDuration}s, maximum ${softMaxDuration}s per passage.
- Start and end at natural sentence boundaries. NEVER cut mid-sentence.
- Prefer starting/ending near silence gaps or natural pauses.
- AVOID passages with long internal silences (>2s gaps between words).

═══════════════════════════════════════════════════════
DIRECTIVE 2 — SCORE EACH PASSAGE FOR VIRALITY (0.0–1.0)
═══════════════════════════════════════════════════════
Score each passage based on its viral potential:
- 0.9–1.0: Exceptional — strong hook, emotional peak, would go viral alone
- 0.7–0.8: Great — engaging, shareable, clear takeaway
- 0.5–0.6: Good — solid content, worth including
- Below 0.5: Weak — only include if it forms a complete thought

Factors that INCREASE score:
- Strong opening hook (first 3 seconds grab attention)
- Emotional peaks: surprise, humor, inspiration, controversy
- Actionable advice or "aha moments"
- High speech density (speaker actively talking)

Factors that DECREASE score:
- Long internal silences or dead air
- Repetitive or filler content
- No clear point or takeaway

═══════════════════════════════════════════════════════
LANGUAGE RULE (CRITICAL):
Segment titles MUST be written in the SAME language as the transcript.
═══════════════════════════════════════════════════════

Return ONLY a valid JSON array (no markdown, no explanation):
[
  {
    "start": 12.5,
    "end": 45.2,
    "title": "Catchy title in same language as transcript",
    "score": 0.85
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
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 4000,
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

  // Parse the JSON response — handle multiple possible wrapper keys
  let segments: Segment[];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      segments = parsed;
    } else {
      segments =
        parsed.segments ||
        parsed.clips ||
        parsed.results ||
        parsed.data ||
        parsed.shorts ||
        parsed.passages ||
        [];
      if (segments.length === 0) {
        const arrayProp = Object.values(parsed).find(Array.isArray);
        if (arrayProp) segments = arrayProp as Segment[];
      }
    }
  } catch {
    throw new Error(`Failed to parse Mistral response: ${content}`);
  }

  console.log(
    `[Mistral] Raw segments from AI: ${segments.length}`,
    segments.map(
      (s) =>
        `"${s.title}" ${s.start}–${s.end}s (${(s.end - s.start).toFixed(1)}s, score=${s.score})`,
    ),
  );

  // Basic validation & cleanup
  segments = segments
    .filter((s) => s.start >= 0 && s.end <= videoDuration && s.end > s.start)
    .map((s) => ({
      start: Math.round(s.start * 10) / 10,
      end: Math.round(s.end * 10) / 10,
      title: s.title || "Untitled Segment",
      score: Math.min(1, Math.max(0, s.score || 0.5)),
    }));

  // Post-process: snap boundaries, drop short segments, score & sort
  segments = postProcessSegments(segments, videoDuration, transcript);

  console.log(
    `[Mistral] Final segments: ${segments.length}`,
    segments.map(
      (s) =>
        `"${s.title}" ${s.start}–${s.end}s (${(s.end - s.start).toFixed(1)}s, score=${s.score})`,
    ),
  );

  return segments;
}
