import type { TranscriptWord } from '~/types/database'

/**
 * Transcribe audio using Deepgram API.
 * Returns an array of words with timestamps.
 */
export async function transcribeAudio(audioUrl: string): Promise<TranscriptWord[]> {
  const config = useRuntimeConfig()

  const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&utterances=true&words=true', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${config.deepgramApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: audioUrl,
    }),
  })

  if (!response.ok) {
    throw new Error(`Deepgram API error: ${response.statusText}`)
  }

  const data = await response.json()

  // Extract words with timestamps from Deepgram response
  const words: TranscriptWord[] = []
  const channels = data.results?.channels

  if (channels && channels.length > 0) {
    const alternatives = channels[0].alternatives
    if (alternatives && alternatives.length > 0) {
      const deepgramWords = alternatives[0].words || []
      for (const word of deepgramWords) {
        words.push({
          start: word.start,
          end: word.end,
          text: word.punctuated_word || word.word,
          confidence: word.confidence,
        })
      }
    }
  }

  return words
}

/**
 * Group transcript words into sentence-like segments for subtitle display.
 */
export function groupWordsIntoSegments(words: TranscriptWord[], maxWordsPerSegment: number = 8): TranscriptWord[] {
  const segments: TranscriptWord[] = []
  let currentSegment: TranscriptWord | null = null
  let wordCount = 0

  for (const word of words) {
    if (!currentSegment || wordCount >= maxWordsPerSegment) {
      if (currentSegment) {
        segments.push(currentSegment)
      }
      currentSegment = {
        start: word.start,
        end: word.end,
        text: word.text,
        confidence: word.confidence,
      }
      wordCount = 1
    } else {
      currentSegment.end = word.end
      currentSegment.text += ` ${word.text}`
      currentSegment.confidence = Math.min(currentSegment.confidence || 1, word.confidence || 1)
      wordCount++
    }
  }

  if (currentSegment) {
    segments.push(currentSegment)
  }

  return segments
}

/**
 * Convert transcript segments to SRT subtitle format.
 */
export function transcriptToSrt(segments: TranscriptWord[]): string {
  let srt = ''

  segments.forEach((segment, index) => {
    const startTime = formatSrtTime(segment.start)
    const endTime = formatSrtTime(segment.end)

    srt += `${index + 1}\n`
    srt += `${startTime} --> ${endTime}\n`
    srt += `${segment.text}\n\n`
  })

  return srt
}

function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}
