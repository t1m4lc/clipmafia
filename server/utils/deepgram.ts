import type { TranscriptWord } from "~/types/database";

/**
 * Transcribe audio using Deepgram API.
 * Sends the audio file as a binary buffer directly to Deepgram
 * (more reliable than passing a URL that Deepgram has to fetch remotely).
 */
export async function transcribeAudio(
  audioBuffer: Buffer | Uint8Array,
): Promise<TranscriptWord[]> {
  const config = useRuntimeConfig();

  console.log(
    "[transcribeAudio] Sending audio to Deepgram, buffer size:",
    audioBuffer.length,
    "bytes",
  );

  // Wrap in Blob so fetch sends the correct bytes regardless of Node.js buffer pooling.
  // Using audioBuffer.buffer directly is unreliable because Node.js Buffers can share
  // a pooled ArrayBuffer where byteOffset != 0, causing Deepgram to receive garbage data.
  // We copy the relevant slice into a fresh Buffer to guarantee correctness.
  const freshBuffer = Buffer.from(
    audioBuffer.buffer,
    audioBuffer.byteOffset,
    audioBuffer.byteLength,
  );
  console.log(
    "[transcribeAudio] Fresh buffer size:",
    freshBuffer.byteLength,
    "bytes",
  );
  // Node.js undici (fetch) accepts Buffer natively — cast bypasses overly strict TS types
  const audioBlob = new Blob([freshBuffer as unknown as BlobPart], {
    type: "audio/mpeg",
  });
  console.log("[transcribeAudio] Blob size:", audioBlob.size, "bytes");

  const response = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&words=true&detect_language=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${config.deepgramApiKey}`,
        "Content-Type": "audio/mpeg",
      },
      body: audioBlob,
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Deepgram API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Log the full Deepgram response metadata for debugging
  console.log("[transcribeAudio] Deepgram response metadata:", {
    requestId: data.metadata?.request_id,
    duration: data.metadata?.duration,
    channels: data.metadata?.channels,
    detectedLanguage: data.results?.channels?.[0]?.detected_language,
    transcriptSummary:
      data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.slice(0, 100),
    wordCount:
      data.results?.channels?.[0]?.alternatives?.[0]?.words?.length ?? 0,
  });

  // Extract words with timestamps from Deepgram response
  const words: TranscriptWord[] = [];
  const channels = data.results?.channels;

  if (channels && channels.length > 0) {
    const alternatives = channels[0].alternatives;
    if (alternatives && alternatives.length > 0) {
      const deepgramWords = alternatives[0].words || [];
      console.log(
        "[transcribeAudio] Deepgram returned",
        deepgramWords.length,
        "words",
      );
      for (const word of deepgramWords) {
        words.push({
          start: word.start,
          end: word.end,
          text: word.punctuated_word || word.word,
          confidence: word.confidence,
        });
      }
    } else {
      console.warn(
        "[transcribeAudio] No alternatives in Deepgram response. Full results:",
        JSON.stringify(data.results).slice(0, 1000),
      );
    }
  } else {
    console.warn(
      "[transcribeAudio] No channels in Deepgram response. Full response:",
      JSON.stringify(data).slice(0, 1000),
    );
  }

  if (words.length === 0) {
    throw new Error(
      `Deepgram returned 0 words. Check the logs above for the full response. ` +
        `Duration detected: ${data.metadata?.duration ?? "unknown"}s. ` +
        `Language detected: ${data.results?.channels?.[0]?.detected_language ?? "unknown"}.`,
    );
  }

  return words;
}

/**
 * Group transcript words into sentence-like segments for subtitle display.
 */
export function groupWordsIntoSegments(
  words: TranscriptWord[],
  maxWordsPerSegment: number = 8,
): TranscriptWord[] {
  const segments: TranscriptWord[] = [];
  let currentSegment: TranscriptWord | null = null;
  let wordCount = 0;

  for (const word of words) {
    if (!currentSegment || wordCount >= maxWordsPerSegment) {
      if (currentSegment) {
        segments.push(currentSegment);
      }
      currentSegment = {
        start: word.start,
        end: word.end,
        text: word.text,
        confidence: word.confidence,
      };
      wordCount = 1;
    } else {
      currentSegment.end = word.end;
      currentSegment.text += ` ${word.text}`;
      currentSegment.confidence = Math.min(
        currentSegment.confidence || 1,
        word.confidence || 1,
      );
      wordCount++;
    }
  }

  if (currentSegment) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * Convert transcript segments to SRT subtitle format.
 */
export function transcriptToSrt(segments: TranscriptWord[]): string {
  let srt = "";

  segments.forEach((segment, index) => {
    const startTime = formatSrtTime(segment.start);
    const endTime = formatSrtTime(segment.end);

    srt += `${index + 1}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${segment.text}\n\n`;
  });

  return srt;
}

function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
