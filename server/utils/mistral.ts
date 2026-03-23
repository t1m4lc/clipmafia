import type { TranscriptWord, Segment, DurationOption } from '~/types/database'

/**
 * Use Mistral AI to detect the best segments for short videos.
 * Analyzes the transcript and identifies engaging moments.
 */
export async function detectSegments(
  transcript: TranscriptWord[],
  durationOption: DurationOption,
  videoDuration: number,
): Promise<Segment[]> {
  const config = useRuntimeConfig()

  // Build a readable transcript text with timestamps
  const transcriptText = transcript
    .map(w => `[${w.start.toFixed(1)}s] ${w.text}`)
    .join(' ')

  const prompt = `You are an expert video editor specializing in creating viral short-form content.

Analyze this transcript from a video and identify the BEST segments that would make engaging short videos (Shorts/Reels/TikTok).

TRANSCRIPT (with timestamps in seconds):
${transcriptText}

VIDEO DURATION: ${videoDuration} seconds
TARGET SEGMENT DURATION: approximately ${durationOption} seconds each (±5 seconds tolerance)

RULES:
1. Each segment must be approximately ${durationOption} seconds long
2. Segments must not overlap
3. Start and end times must align with natural speech boundaries (don't cut mid-sentence)
4. Prioritize segments with:
   - Strong hooks or attention-grabbing openings
   - Complete thoughts or stories
   - Emotional moments
   - Actionable advice or key insights
   - Surprising or controversial statements
5. Score each segment from 0.0 to 1.0 based on viral potential
6. Return 3-5 segments maximum
7. Give each segment a catchy, clickbait-style title

Return ONLY a valid JSON array with this exact format (no markdown, no explanation):
[
  {
    "start": 32.5,
    "end": 62.1,
    "title": "Catchy title here",
    "score": 0.95
  }
]`

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.mistralApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-large-latest',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Mistral AI error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('No response from Mistral AI')
  }

  // Parse the JSON response
  let segments: Segment[]
  try {
    const parsed = JSON.parse(content)
    // Handle both direct array and object with segments key
    segments = Array.isArray(parsed) ? parsed : parsed.segments || []
  } catch {
    throw new Error(`Failed to parse Mistral response: ${content}`)
  }

  // Validate and clean segments
  segments = segments
    .filter(s => s.start >= 0 && s.end <= videoDuration && s.end > s.start)
    .map(s => ({
      start: Math.round(s.start * 10) / 10,
      end: Math.round(s.end * 10) / 10,
      title: s.title || 'Untitled Segment',
      score: Math.min(1, Math.max(0, s.score || 0.5)),
    }))
    .sort((a, b) => b.score - a.score)

  return segments
}
