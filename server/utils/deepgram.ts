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

  const DEEPGRAM_URL =
    "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&words=true&detect_language=true";

  // Retry up to 2 times on network-level failures (fetch failed / ECONNRESET).
  const MAX_RETRIES = 2;
  const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes — enough for very large files

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(DEEPGRAM_URL, {
        method: "POST",
        headers: {
          Authorization: `Token ${config.deepgramApiKey}`,
          "Content-Type": "audio/mpeg",
        },
        body: audioBlob,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => response.statusText);
        throw new Error(
          `Deepgram API error (${response.status}): ${errorText}`,
        );
      }

      const data = await response.json();

      // Log the full Deepgram response metadata for debugging
      console.log("[transcribeAudio] Deepgram response metadata:", {
        requestId: data.metadata?.request_id,
        duration: data.metadata?.duration,
        channels: data.metadata?.channels,
        detectedLanguage: data.results?.channels?.[0]?.detected_language,
        transcriptSummary:
          data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.slice(
            0,
            100,
          ),
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
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;

      // Don't retry on Deepgram API errors (4xx/5xx) — only on network failures
      const isNetworkError =
        err?.name === "AbortError" ||
        err?.cause?.code === "ECONNRESET" ||
        err?.cause?.code === "ENOTFOUND" ||
        err?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
        err?.message?.toLowerCase().includes("fetch failed");

      if (!isNetworkError) throw err;

      console.warn(
        `[transcribeAudio] Network error on attempt ${attempt}/${MAX_RETRIES}:`,
        err?.cause?.code ?? err?.name ?? err?.message,
      );

      if (attempt < MAX_RETRIES) {
        const delay = attempt * 3000; // 3s, then 6s
        console.log(`[transcribeAudio] Retrying in ${delay / 1000}s…`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw new Error(
    `Deepgram transcription failed after ${MAX_RETRIES} attempts: ${(lastError as any)?.message ?? lastError}`,
  );
}

// ─── Subtitle utilities have been moved to server/utils/subtitles.ts ─────
// Import { groupWordsIntoSubtitles, generateSRT } from "./subtitles" instead.
