import { join } from "path";
import { unlink, readFile } from "fs/promises";
import type { SubtitleStyle } from "../../utils/ffmpeg";
import { generateThumbnail } from "../../utils/ffmpeg";
import {
  groupWordsIntoSubtitles,
  generateSRT,
  extractWordsForSegment,
  adjustTimestamps,
} from "../../utils/subtitles";

/**
 * Step order used to determine which steps can be skipped on resume.
 */
const STEP_ORDER = [
  "extracting_audio",
  "transcribing",
  "detecting_segments",
  "processing_video",
  "burning_subtitles",
  "uploading",
  "completed",
] as const;

type StepName = (typeof STEP_ORDER)[number];
type StepState = "pending" | "loading" | "done" | "error";
type StepStatuses = Partial<Record<StepName, StepState>>;

function stepIndex(step: string): number {
  return STEP_ORDER.indexOf(step as StepName);
}

/**
 * Main video processing pipeline.
 * This runs asynchronously in the background via the job queue.
 * Supports resuming from a failed step by reusing cached transcript/segments.
 */
export async function processVideoJob(
  jobId: string,
  videoId: string,
  userId: string,
  subtitleSettings?: SubtitleStyle,
): Promise<void> {
  const supabase = useSupabaseAdmin();

  // Track per-step status
  const steps: StepStatuses = {
    extracting_audio: "pending",
    transcribing: "pending",
    detecting_segments: "pending",
    processing_video: "pending",
    burning_subtitles: "pending",
    uploading: "pending",
  };

  async function markStep(step: StepName, state: StepState) {
    steps[step] = state;
    await updateJobStatus(jobId, undefined as any, undefined as any, { steps });
  }

  try {
    // Get video info (including cached transcript) FIRST,
    // so we can skip steps the UI would otherwise briefly flash.
    const { data: video } = await supabase
      .from("videos")
      .select("*")
      .eq("id", videoId)
      .single();

    if (!video) throw new Error("Video not found");

    // Check if we have cached data from the video or a previous job
    let transcript: TranscriptWord[] | null = (video as any).transcript || null;
    let segments: Segment[] | null = null;

    // Look for data from a previous failed/completed job
    const { data: previousJob } = await supabase
      .from("jobs")
      .select("transcript, segments, failed_at_step")
      .eq("video_id", videoId)
      .eq("user_id", userId)
      .neq("id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pj = previousJob as any;
    if (pj) {
      if (!transcript && pj.transcript) {
        transcript = pj.transcript as TranscriptWord[];
      }
      // Reuse segments from previous job (no longer gated on durationOption)
      if (pj.segments) {
        segments = pj.segments as Segment[];
      }
    }

    // Mark the correct starting step based on what's already cached.
    // This prevents the UI from briefly flashing "Extract Audio" when
    // the transcript (and possibly segments) are already available.
    const hasTranscript = transcript && transcript.length > 0;
    const hasSegments = segments && segments.length > 0;

    if (hasSegments) {
      // Skip all the way to video processing
      steps.extracting_audio = "done";
      steps.transcribing = "done";
      steps.detecting_segments = "done";
      steps.processing_video = "loading";
      await updateJobStatus(jobId, "processing_video", 55, {
        started_at: new Date().toISOString(),
        steps,
      });
    } else if (hasTranscript) {
      // Skip audio extraction and transcription
      steps.extracting_audio = "done";
      steps.transcribing = "done";
      steps.detecting_segments = "loading";
      await updateJobStatus(jobId, "detecting_segments", 35, {
        started_at: new Date().toISOString(),
        steps,
      });
    } else {
      // Full pipeline from scratch
      steps.extracting_audio = "loading";
      await updateJobStatus(jobId, "extracting_audio", 5, {
        started_at: new Date().toISOString(),
        steps,
      });
    }

    // Create temp directory for this job
    const tempDir = await ensureTempDir(jobId);

    // ── Determine if watermark is needed (free users without active subscription) ──
    const { data: profileData } = await supabase
      .from("profiles")
      .select("subscription_status, subscription_plan")
      .eq("id", userId)
      .single();
    const config = useRuntimeConfig();
    const hasActiveSubscription = config.bypassPayment
      ? true
      : profileData &&
        ["active", "trialing"].includes(
          (profileData as any).subscription_status,
        ) &&
        (profileData as any).subscription_plan !== "free";
    const addWatermark = !hasActiveSubscription;
    if (addWatermark) {
      console.log(`[Job ${jobId}] Free user — watermark will be added`);
    }

    // Download video from Supabase Storage
    const v = video as any;
    const { data: videoFile } = await supabase.storage
      .from("videos")
      .download(v.storage_path);

    if (!videoFile) throw new Error("Failed to download video");

    const videoLocalPath = join(tempDir, "input.mp4");
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    const { writeFile: writeFileAsync } = await import("fs/promises");
    await writeFileAsync(videoLocalPath, videoBuffer);

    // Get video metadata
    const metadata = await getVideoMetadata(videoLocalPath);

    // =========================================
    // Step 1: Extract Audio & Transcribe
    // Skip if we already have a cached transcript
    // =========================================
    if (hasTranscript) {
      console.log(
        `Job ${jobId}: Reusing cached transcript (${transcript!.length} words)`,
      );
      // Status was already set above before the pipeline started
    } else {
      // Extract Audio
      steps.extracting_audio = "loading";
      await updateJobStatus(jobId, "extracting_audio", 10, { steps });

      const audioPath = join(tempDir, "audio.mp3");
      await extractAudio(videoLocalPath, audioPath);
      // NOTE: audio is no longer uploaded to Supabase storage;
      // it is sent directly to Deepgram as a binary buffer below.

      steps.extracting_audio = "done";

      // Transcribe with Deepgram — send audio buffer directly (no signed URL needed)
      steps.transcribing = "loading";
      await updateJobStatus(jobId, "transcribing", 25, { steps });

      // Read the local audio file and send bytes directly to Deepgram.
      // This is more reliable than uploading to Supabase and passing a signed URL
      // that Deepgram may not be able to reach from its servers.
      const audioBuffer = await readFile(audioPath);
      transcript = await transcribeAudio(audioBuffer);

      // Guard: if transcript is empty, fail loudly rather than produce silent videos
      if (!transcript || transcript.length === 0) {
        throw new Error(
          "Deepgram returned an empty transcript — check your API key and audio quality.",
        );
      }
      console.log(
        `[Job ${jobId}] Transcript obtained: ${transcript.length} words`,
      );

      // Save transcript to job AND to video (cache for future use)
      steps.transcribing = "done";
      await updateJobStatus(jobId, "transcribing", 35, {
        transcript: transcript,
        steps,
      });

      // Persist transcript on the video record so it's always available
      await supabase
        .from("videos")
        .update({ transcript: transcript as any })
        .eq("id", videoId);
    }

    // =========================================
    // Step 2: AI Segment Detection (OpenAI)
    // Skip if segments already exist from a previous job
    // =========================================
    if (segments && segments.length > 0) {
      console.log(
        `Job ${jobId}: Reusing cached segments (${segments.length} segments)`,
      );
      steps.detecting_segments = "done";
      await updateJobStatus(jobId, "detecting_segments", 50, {
        segments: segments,
        steps,
      });
    } else {
      steps.detecting_segments = "loading";
      await updateJobStatus(jobId, "detecting_segments", 40, { steps });

      // segments = await detectSegments(transcript!, metadata.duration);

      const openAISegments = await detectSegmentsOpenAI(transcript!);
      segments = openAISegmentsToStandard(openAISegments);

      // Save segments to job
      steps.detecting_segments = "done";
      await updateJobStatus(jobId, "detecting_segments", 50, {
        segments: segments,
        steps,
      });
    }

    // =========================================
    // Step 4: Process Each Segment
    // =========================================
    steps.processing_video = "loading";
    await updateJobStatus(jobId, "processing_video", 55, { steps });

    const totalSegments = segments.length;
    for (let i = 0; i < totalSegments; i++) {
      const segment = segments[i]!;
      const segmentProgress = 55 + Math.round((i / totalSegments) * 20);

      await updateJobStatus(jobId, "processing_video", segmentProgress);

      // Cut and convert to vertical
      const segmentPath = join(tempDir, `segment_${i}.mp4`);
      await processSegment(
        videoLocalPath,
        segmentPath,
        segment.start,
        segment.end,
        {
          width: 1080,
          height: 1920,
          smartFraming: true,
        },
      );

      // =========================================
      // Step 5: Burn Subtitles
      // =========================================
      if (i === 0) {
        steps.processing_video = "done";
        steps.burning_subtitles = "loading";
      }
      await updateJobStatus(
        jobId,
        "burning_subtitles",
        75 + Math.round((i / totalSegments) * 10),
        { steps },
      );

      // Get subtitle segment from transcript
      // DEBUG: safety check — transcript must be set by this point
      if (!transcript || transcript.length === 0) {
        console.error(
          `[Job ${jobId}] BUG: transcript is empty at subtitle burn step!`,
        );
      }

      // Extract words using strict containment (word must be fully within segment ± buffer)
      // This guarantees displayed words match the audible audio exactly.
      const segmentWords = extractWordsForSegment(
        transcript || [],
        segment.start,
        segment.end,
      );

      // Adjust timestamps relative to segment start
      const adjustedWords = adjustTimestamps(segmentWords, segment.start);

      // Group into short, readable subtitle blocks (≤4 words, split on silences)
      const subtitleBlocks = groupWordsIntoSubtitles(adjustedWords);
      const srtContent = generateSRT(subtitleBlocks);

      // DEBUG: Log subtitle data before render
      console.log(`[Job ${jobId}] Segment ${i} subtitle info:`, {
        segmentRange: `${segment.start}s – ${segment.end}s`,
        wordsInRange: segmentWords.length,
        subtitleBlocks: subtitleBlocks.length,
        srtLength: srtContent.length,
        srtEmpty: !srtContent.trim(),
        styleApplied: subtitleSettings ? "custom" : "default",
        fontSize: subtitleSettings?.fontSize,
        addWatermark,
      });

      if (!srtContent.trim()) {
        console.warn(
          `[Job ${jobId}] WARNING: SRT content is empty for segment ${i}! Subtitles will NOT be burned.`,
        );
      }

      const subtitledPath = join(tempDir, `short_${i}.mp4`);
      await burnSubtitles(
        segmentPath,
        srtContent,
        subtitledPath,
        subtitleSettings,
        { addWatermark },
      );

      // =========================================
      // Step 6: Upload Result
      // =========================================
      if (i === 0) {
        steps.burning_subtitles = "done";
        steps.uploading = "loading";
      }
      await updateJobStatus(
        jobId,
        "uploading",
        88 + Math.round((i / totalSegments) * 10),
        { steps },
      );

      const shortBuffer = await readFile(subtitledPath);
      const shortStoragePath = `${userId}/${videoId}/short_${i}.mp4`;

      await supabase.storage
        .from("shorts")
        .upload(shortStoragePath, shortBuffer, {
          contentType: "video/mp4",
        });

      // Generate and upload thumbnail
      let thumbnailStoragePath: string | null = null;
      try {
        const thumbLocalPath = join(tempDir, `thumb_${i}.jpg`);
        await generateThumbnail(subtitledPath, thumbLocalPath, 1);
        const { readFile: rf } = await import("fs/promises");
        const thumbBuffer = await rf(thumbLocalPath);
        const thumbPath = `${userId}/${videoId}/thumb_${i}.jpg`;
        const { error: thumbUploadError } = await supabase.storage
          .from("thumbnails")
          .upload(thumbPath, thumbBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          });
        if (!thumbUploadError) {
          thumbnailStoragePath = thumbPath;
        }
        await unlink(thumbLocalPath).catch(() => {});
      } catch (thumbErr) {
        console.warn(
          `Job ${jobId}: thumbnail generation failed for segment ${i}:`,
          thumbErr,
        );
      }

      // Create short record in database
      await supabase.from("shorts").insert({
        job_id: jobId,
        video_id: videoId,
        user_id: userId,
        title: segment.title,
        storage_path: shortStoragePath,
        duration: segment.end - segment.start,
        start_time: segment.start,
        end_time: segment.end,
        score: segment.score,
        width: 1080,
        height: 1920,
        file_size: shortBuffer.length,
        has_subtitles: true,
        thumbnail_path: thumbnailStoragePath,
      });

      // Clean up segment files
      await unlink(segmentPath).catch(() => {});
      await unlink(subtitledPath).catch(() => {});
    }

    // =========================================
    // Complete!
    // =========================================
    steps.uploading = "done";

    // Update video status
    await supabase
      .from("videos")
      .update({
        status: "completed",
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
      })
      .eq("id", videoId);

    await updateJobStatus(jobId, "completed", 100, { steps });

    // Clean up temp files
    const { rm } = await import("fs/promises");
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  } catch (error: any) {
    console.error(`Job ${jobId} failed:`, error);

    // Determine which step failed based on current job status
    const { data: failedJob } = await supabase
      .from("jobs")
      .select("status")
      .eq("id", jobId)
      .single();

    const failedAtStep = failedJob?.status || "unknown";

    // Mark the failed step in the steps tracker
    if (failedAtStep && failedAtStep !== "unknown") {
      steps[failedAtStep as StepName] = "error";
    }

    // Create a clean user-facing error message (hide raw FFmpeg/system details)
    const rawMsg = error.message || "Unknown error";
    let userMessage = rawMsg;

    if (rawMsg.includes("FFmpeg failed")) {
      // Map common FFmpeg errors to friendly messages
      if (rawMsg.includes("Unable to open") && rawMsg.includes(".srt")) {
        userMessage = "Subtitle file could not be loaded. Please retry.";
      } else if (rawMsg.includes("No such file")) {
        userMessage =
          "A temporary file was lost during processing. Please retry.";
      } else if (rawMsg.includes("Invalid data")) {
        userMessage =
          "The video file appears to be corrupted. Please re-upload.";
      } else {
        userMessage =
          "Video processing failed. Please retry or try a different video.";
      }
      console.error(`[Job ${jobId}] Full FFmpeg error:`, rawMsg);
    } else if (rawMsg.includes("Deepgram") || rawMsg.includes("transcrib")) {
      userMessage = "Speech transcription failed. Please retry.";
    }

    // Wrap the failure updates in their own try/catch so a DB hiccup here
    // cannot prevent the job from at least being marked "failed".
    try {
      await updateJobStatus(jobId, "failed", 0, {
        error_message: userMessage,
        failed_at_step: failedAtStep,
        steps,
      });
    } catch (dbErr) {
      console.error(`[Job ${jobId}] Could not persist "failed" status:`, dbErr);
    }

    try {
      await supabase
        .from("videos")
        .update({ status: "failed" } as any)
        .eq("id", videoId);
    } catch (dbErr) {
      console.error(
        `[Job ${jobId}] Could not update video to "failed":`,
        dbErr,
      );
    }
  }
}

/**
 * POST /api/process/run
 *
 * HTTP wrapper around processVideoJob — called internally by start.post.ts
 * as a fire-and-forget request so processing runs in its own independent
 * serverless invocation (works on Vercel Pro with maxDuration: 300).
 *
 * Protected by x-internal-secret header to prevent external abuse.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  // Internal auth — only accept calls from our own server
  const secret = getHeader(event, "x-internal-secret") ?? "";
  if (config.internalSecret && secret !== config.internalSecret) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  const body = await readBody(event);
  const { jobId, videoId, userId, subtitleSettings } = body;

  if (!jobId || !videoId || !userId) {
    throw createError({
      statusCode: 400,
      message: "jobId, videoId and userId are required",
    });
  }

  // Run the full pipeline — this is the long-running operation.
  // Vercel Pro allows up to 300 s (configured in vercel.json maxDuration).
  await processVideoJob(jobId, videoId, userId, subtitleSettings);

  return { ok: true };
});
