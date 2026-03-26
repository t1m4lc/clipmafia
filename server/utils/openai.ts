/**
 * OpenAI-based viral segment detection service.
 *
 * Uses GPT-5.4-mini with a structured prompt for semantic topic analysis,
 * viral pattern matching, and platform-optimised timestamp extraction.
 */

import type { TranscriptWord, Segment } from "#shared/types/domain";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ViralPattern =
  | "VIRAL_HOOK"
  | "PUNCHLINE"
  | "REVELATION"
  | "TENSION_PEAK"
  | "VALEUR_DENSE"
  | "STORYTELLING"
  | "DEBAT_CLIP"
  | "QUOTE_FORTE";

export type ShortsPlatform = "tiktok" | "reels" | "shorts";

export interface OpenAISegment {
  start: number;
  end: number;
  duration: number;
  pattern: ViralPattern;
  topic_id: number;
  topic_label: string;
  viral_score: number;
  hook_sentence: string;
  platforms: ShortsPlatform[];
  title_suggestion: string;
  reason: string;
}

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert in content strategy and viral video editing. Your mission is to analyse a timestamped video transcript and extract the maximum number of self-contained sequences that can become viral Shorts on TikTok, Instagram Reels, and YouTube Shorts.

CORE PRINCIPLE — OVERLAPPING SEGMENTS ALLOWED
Segments can partially or fully overlap. One passage can yield multiple clips of different lengths targeting different use cases. Example: a 50-second topic can produce one full 50-second short AND several tighter 10–20-second clips highlighting specific moments. Never skip high-value passages because they overlap with others.

STEP 1 — THEMATIC BLOCKS
Identify distinct thematic blocks in the transcript. Each block is an independent topic. Never extract a sequence spanning two topics. 
Break markers: change of main subject, change of speaker/context, prolonged silence, transition words ("Now", "Moving on…").

STEP 2 — MULTI-SCALE VIRAL SEQUENCES
For each topic, extract sequences at multiple scales:
  a) FULL (30–60 s) — entire topic or large portion telling a complete story.
  b) MID (15–30 s) — self-contained arc or strong moment within topic.
  c) MICRO (8–15 s) — sharpest individual moments: hooks, punchlines, revelation lines, emotional peaks.
STRICTLY FORBIDDEN: never generate a sequence shorter than 8 seconds. Any sequence below 8 seconds must be discarded or extended. Cover all scales that provide quality content.

STEP 3 — VIRAL PATTERNS
Each sequence must match at least one of these patterns (priority order):
- VIRAL_HOOK: shocking hook, provocative question, surprising stat.
- PUNCHLINE: short, memorable phrase.
- REVELATION: surprise, twist, unexpected confession.
- TENSION_PEAK: strong emotional peak (anger, laughter, emotion).
- VALEUR_DENSE: actionable advice, concentrated insight.
- STORYTELLING: mini-narrative with beginning, problem, resolution.
- DEBAT_CLIP: lively argument or exchange.
- QUOTE_FORTE: memorable quote or striking line.

STEP 4 — PLATFORM DURATIONS
TikTok & Instagram Reels: optimal 10–30 s, acceptable 30–60 s if highly engaging.  
YouTube Shorts: optimal 15–40 s, acceptable 40–60 s if value dense.  
Absolute max: 60 s. ABSOLUTE MINIMUM: 8 s — any segment strictly below 8 seconds is FORBIDDEN and must be dropped. Prioritize optimal durations. Include longer clips only if content is strong.

STEP 5 — SAFE TIMESTAMPS
Adjust each sequence safely:
  start_adjusted = max(topic_start, word_start − 0.3)
  end_adjusted   = min(topic_end, word_end + 0.3)
Do not exceed topic boundaries. Trim sequences >60 s by removing weakest parts. Extend sequences <8 s within the same topic to reach at least 8 s; if that is not possible, discard the sequence entirely — outputting a segment below 8 s is strictly prohibited.

STEP 6 — OUTPUT FORMAT
Return valid JSON only. Object with key "segments" containing an array. Each sequence must include:
- start (float, seconds, adjusted)
- end (float, seconds, adjusted)
- duration (float)
- pattern (viral type)
- topic_id (numeric)
- topic_label (≤5 words)
- viral_score (1–10)
- hook_sentence (first sentence/hook)
- platforms (array: "tiktok", "reels", "shorts")
- title_suggestion (≤8 words)
- reason (one sentence, mention scale: full/mid/micro)

Sort sequences by descending viral_score. Maximise number of sequences. For rich topics, 3–5 overlapping segments at different scales is expected.`;

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Remove near-duplicate segments whose time windows overlap by more than 60%.
 *
 * When two segments overlap by > 60 % of the shorter one's duration the pair
 * is considered a duplicate.  Because the input is sorted by viral_score
 * descending we always keep the higher-scored segment.  When scores are
 * identical the first (longer) segment wins, which maximises content.
 */
function deduplicateOverlappingSegments(
  segments: OpenAISegment[],
): OpenAISegment[] {
  if (segments.length <= 1) return segments;

  const kept: OpenAISegment[] = [];

  for (const candidate of segments) {
    const isDuplicate = kept.some((existing) => {
      const overlapStart = Math.max(existing.start, candidate.start);
      const overlapEnd = Math.min(existing.end, candidate.end);
      const overlapDuration = Math.max(0, overlapEnd - overlapStart);

      // Overlap ratio relative to the shorter segment's duration
      const shorterDuration = Math.min(existing.duration, candidate.duration);
      const overlapRatio =
        shorterDuration > 0 ? overlapDuration / shorterDuration : 0;

      if (overlapRatio > 0.6) {
        console.log(
          `[OpenAI] Dropping duplicate: "${candidate.title_suggestion}" ` +
            `(${candidate.start}–${candidate.end}s, ${candidate.duration}s) ` +
            `overlaps ${(overlapRatio * 100).toFixed(0)}% with ` +
            `"${existing.title_suggestion}" (${existing.start}–${existing.end}s)`,
        );
        return true;
      }
      return false;
    });

    if (!isDuplicate) {
      kept.push(candidate);
    }
  }

  console.log(
    `[OpenAI] Deduplication: ${segments.length} → ${kept.length} segments ` +
      `(removed ${segments.length - kept.length} near-duplicates)`,
  );

  return kept;
}

// ─── Main: OpenAI segment detection ─────────────────────────────────────────

/**
 * Use OpenAI GPT-4.1-mini to identify all viral-worthy segments
 * from a timestamped video transcript.
 *
 * @param transcript - Array of timestamped words from Deepgram
 * @returns Array of enriched segments sorted by viral_score descending
 */
export async function detectSegmentsOpenAI(
  transcript: TranscriptWord[],
): Promise<OpenAISegment[]> {
  const config = useRuntimeConfig();

  if (!config.openaiApiKey) {
    throw new Error(
      "OpenAI API key is not configured. Set OPENAI_API_KEY in your environment.",
    );
  }

  // Build timestamped transcript string
  const transcriptText = transcript
    .map((w) => `[${w.start.toFixed(1)}s] ${w.text}`)
    .join(" ");

  const userPrompt = `Here is the timestamped transcript to analyse:\n\n${transcriptText}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_completion_tokens: 16000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OpenAI] API error ${response.status}:`, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response content from OpenAI API");
    }

    // Parse the JSON response
    let segments: OpenAISegment[];
    try {
      const parsed = JSON.parse(content);

      if (Array.isArray(parsed)) {
        segments = parsed;
      } else {
        // Try known wrapper keys
        segments =
          parsed.segments ||
          parsed.clips ||
          parsed.results ||
          parsed.data ||
          parsed.shorts ||
          parsed.sequences ||
          [];

        // Fallback: grab first array value from the object
        if (segments.length === 0) {
          const arrayProp = Object.values(parsed).find(Array.isArray);
          if (arrayProp) segments = arrayProp as OpenAISegment[];
        }
      }
    } catch {
      console.error("[OpenAI] Failed to parse response:", content);
      throw new Error(`Failed to parse OpenAI response as JSON: ${content}`);
    }

    // Validate & sanitize each segment
    segments = segments
      .filter((s) => {
        const valid =
          typeof s.start === "number" &&
          typeof s.end === "number" &&
          s.start >= 0 &&
          s.end > s.start &&
          s.end - s.start >= 8 && // strict 8s minimum
          s.end - s.start <= 65; // 60s hard limit + 5s tolerance for the 0.3s buffers
        if (!valid) {
          console.warn(
            `[OpenAI] Dropping invalid segment: start=${s.start}, end=${s.end}, duration=${(s.end - s.start).toFixed(1)}s (min 8s required)`,
          );
        }
        return valid;
      })
      .map((s) => ({
        start: Math.round(s.start * 10) / 10,
        end: Math.round(s.end * 10) / 10,
        duration: Math.round((s.end - s.start) * 10) / 10,
        pattern: s.pattern || "VALEUR_DENSE",
        topic_id: s.topic_id ?? 0,
        topic_label: s.topic_label || "Unknown topic",
        viral_score: Math.min(10, Math.max(1, Math.round(s.viral_score ?? 5))),
        hook_sentence: s.hook_sentence || "",
        platforms: Array.isArray(s.platforms)
          ? s.platforms.filter((p): p is ShortsPlatform =>
              ["tiktok", "reels", "shorts"].includes(p),
            )
          : ["tiktok", "reels", "shorts"],
        title_suggestion: s.title_suggestion || "Untitled Short",
        reason: s.reason || "",
      }));

    // Sort by viral_score descending (prompt already requests this, but enforce it)
    segments.sort((a, b) => b.viral_score - a.viral_score);

    // Deduplicate near-identical segments (>60% overlap → keep the longer one)
    segments = deduplicateOverlappingSegments(segments);

    console.log(
      `[OpenAI] Detected ${segments.length} segments (after dedup)`,
      segments.map(
        (s) =>
          `[${s.viral_score}/10] "${s.title_suggestion}" ${s.start}–${s.end}s (${s.duration}s, ${s.pattern})`,
      ),
    );

    return segments;
  } catch (error: any) {
    console.error("[OpenAI] detectSegmentsOpenAI failed:", error);
    throw error;
  }
}

// ─── Adapter: convert OpenAISegment → Segment for pipeline compatibility ────

/**
 * Converts OpenAI enriched segments into the standard `Segment` type
 * used by the rest of the processing pipeline (FFmpeg, subtitle burn, DB).
 */
export function openAISegmentsToStandard(
  openAISegments: OpenAISegment[],
): Segment[] {
  return openAISegments.map((s) => ({
    start: s.start,
    end: s.end,
    title: s.title_suggestion,
    score: s.viral_score / 10, // Normalize 1–10 → 0.1–1.0
  }));
}
