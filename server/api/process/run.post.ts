import { join } from "path";
import { unlink, readFile } from "fs/promises";
import type { DurationOption, TranscriptWord, Segment } from "~/types/database";
import type { SubtitleStyle } from "../../utils/ffmpeg";

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
  durationOption: DurationOption,
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
    // Mark job as started
    steps.extracting_audio = "loading";
    await updateJobStatus(jobId, "extracting_audio", 5, {
      started_at: new Date().toISOString(),
      steps,
    });

    // Get video info (including cached transcript)
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

    if (previousJob) {
      if (!transcript && previousJob.transcript) {
        transcript = previousJob.transcript as TranscriptWord[];
      }
      if (previousJob.segments) {
        segments = previousJob.segments as Segment[];
      }
    }

    // Create temp directory for this job
    const tempDir = await ensureTempDir(jobId);

    // Download video from Supabase Storage
    const { data: videoFile } = await supabase.storage
      .from("videos")
      .download(video.storage_path);

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
    if (transcript && transcript.length > 0) {
      console.log(
        `Job ${jobId}: Reusing cached transcript (${transcript.length} words)`,
      );
      steps.extracting_audio = "done";
      steps.transcribing = "done";
      await updateJobStatus(jobId, "transcribing", 35, {
        transcript: transcript,
        steps,
      });
    } else {
      // Extract Audio
      steps.extracting_audio = "loading";
      await updateJobStatus(jobId, "extracting_audio", 10, { steps });

      const audioPath = join(tempDir, "audio.mp3");
      await extractAudio(videoLocalPath, audioPath);

      // Upload audio to storage for Deepgram
      const audioBuffer = await readFile(audioPath);
      const audioStoragePath = `${userId}/${jobId}/audio.mp3`;

      await supabase.storage
        .from("audio")
        .upload(audioStoragePath, audioBuffer, {
          contentType: "audio/mpeg",
        });

      // Get a signed URL for Deepgram
      const { data: audioUrlData } = await supabase.storage
        .from("audio")
        .createSignedUrl(audioStoragePath, 3600);

      if (!audioUrlData?.signedUrl) throw new Error("Failed to get audio URL");

      steps.extracting_audio = "done";

      // Transcribe with Deepgram
      steps.transcribing = "loading";
      await updateJobStatus(jobId, "transcribing", 25, { steps });

      transcript = await transcribeAudio(audioUrlData.signedUrl);

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
    // Step 2: AI Segment Detection with Mistral
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

      segments = await detectSegments(
        transcript!,
        durationOption,
        metadata.duration,
      );

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
      const segment = segments[i];
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
      const segmentWords = transcript.filter(
        (w) => w.start >= segment.start && w.end <= segment.end,
      );

      // Adjust timestamps relative to segment start
      const adjustedWords = segmentWords.map((w) => ({
        ...w,
        start: w.start - segment.start,
        end: w.end - segment.start,
      }));

      const subtitleSegments = groupWordsIntoSegments(adjustedWords, 6);
      const srtContent = transcriptToSrt(subtitleSegments);

      const subtitledPath = join(tempDir, `short_${i}.mp4`);
      await burnSubtitles(
        segmentPath,
        srtContent,
        subtitledPath,
        subtitleSettings,
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

    // Update job as failed, recording the step it failed at
    await updateJobStatus(jobId, "failed", 0, {
      error_message: error.message || "Unknown error",
      failed_at_step: failedAtStep,
      steps,
    });

    // Update video status
    await supabase
      .from("videos")
      .update({ status: "failed" } as any)
      .eq("id", videoId);
  }
}
