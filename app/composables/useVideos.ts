type Video = Tables<"videos">;
type Job = Tables<"jobs">;
type Short = Tables<"shorts">;

/** Format seconds to SRT time format: HH:MM:SS,mmm */
function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/** Format seconds to VTT time format: HH:MM:SS.mmm */
function formatVttTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

/** Group words into subtitle segments (~8 words each) */
function groupWordsForSubtitles(
  words: TranscriptWord[],
  maxWordsPerSegment = 8,
): TranscriptWord[] {
  const segments: TranscriptWord[] = [];
  let current: TranscriptWord | null = null;
  let wordCount = 0;

  for (const word of words) {
    if (!current || wordCount >= maxWordsPerSegment) {
      if (current) segments.push(current);
      current = {
        start: word.start,
        end: word.end,
        text: word.text,
        confidence: word.confidence,
      };
      wordCount = 1;
    } else {
      current.end = word.end;
      current.text += ` ${word.text}`;
      wordCount++;
    }
  }
  if (current) segments.push(current);
  return segments;
}

/** Generate SRT content from transcript words */
function generateSrt(words: TranscriptWord[]): string {
  const segments = groupWordsForSubtitles(words);
  return segments
    .map(
      (seg, i) =>
        `${i + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n${seg.text}\n`,
    )
    .join("\n");
}

/** Generate VTT content from transcript words */
function generateVtt(words: TranscriptWord[]): string {
  const segments = groupWordsForSubtitles(words);
  const cues = segments
    .map(
      (seg) =>
        `${formatVttTime(seg.start)} --> ${formatVttTime(seg.end)}\n${seg.text}`,
    )
    .join("\n\n");
  return `WEBVTT\n\n${cues}\n`;
}

/**
 * Composable for video management and job tracking.
 */
export function useVideos() {
  const supabase = useSupabaseClient<Database>();
  const user = useSupabaseUser();

  const videos = ref<Video[]>([]);
  const currentVideo = ref<Video | null>(null);
  const currentJob = ref<Job | null>(null);
  const shorts = ref<Short[]>([]);
  const loading = ref(false);

  /**
   * Fetch all videos for the current user.
   */
  async function fetchVideos() {
    if (!user.value) return;

    loading.value = true;
    try {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("user_id", user.value.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      videos.value = data || [];
    } catch (e) {
      console.error("Failed to fetch videos:", e);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Fetch a single video by ID.
   */
  async function fetchVideo(videoId: string) {
    if (!user.value) return null;

    loading.value = true;
    try {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("id", videoId)
        .eq("user_id", user.value.id)
        .maybeSingle();

      if (error) throw error;
      currentVideo.value = data;
      return data;
    } catch (e) {
      console.error("Failed to fetch video:", e);
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Upload a video file to Supabase Storage, then register it
   * via the server-side API (which enforces upload limits).
   * Throws the raw $fetch error on failure so callers can
   * inspect `error.data` for LIMIT_REACHED payloads.
   */
  async function uploadVideo(file: File) {
    if (!user.value) throw new Error("Not authenticated");

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.value.id}/${Date.now()}.${fileExt}`;

    // 1. Upload binary to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // 2. Create the video record via server API (enforces limits)
    const video = await $fetch("/api/videos/upload", {
      method: "POST",
      body: {
        storagePath: fileName,
        title: file.name.replace(/\.[^/.]+$/, ""),
        originalFilename: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
    });

    return video;
  }

  /**
   * Start processing a video — creates a job and triggers the pipeline.
   * Duration is now determined automatically by the AI.
   */
  async function generateShorts(
    videoId: string,
    subtitleSettings?: SubtitleSettings,
  ) {
    const response = await $fetch("/api/process/start", {
      method: "POST",
      body: {
        videoId,
        subtitleSettings,
      },
    });
    return response;
  }

  /**
   * Fetch job status for a video.
   */
  async function fetchJob(videoId: string) {
    if (!user.value) return null;

    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("video_id", videoId)
      .eq("user_id", user.value.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    currentJob.value = data;
    return data;
  }

  /** Steps that correspond to the "Create Shorts" phase (step 4). */
  const CREATING_STEPS_POLL = [
    "processing_video",
    "burning_subtitles",
    "uploading",
  ];

  /**
   * Poll job status until completion or timeout.
   *
   * Returns a `stop()` helper so the caller can cancel polling when the
   * component unmounts, preventing memory / network leaks.
   *
   * Hard-stops after 20 minutes and automatically calls the rescue endpoint
   * so the job is marked "failed" and the retry button becomes available.
   */
  function pollJobStatus(videoId: string, interval: number = 3000) {
    const polling = ref(true);
    /** 20-minute absolute ceiling — protects against Vercel timeouts / crashes */
    const POLL_TIMEOUT_MS = 20 * 60 * 1000;
    const startedAt = Date.now();

    const poll = async () => {
      while (polling.value) {
        // Hard timeout — rescue the job and stop
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          polling.value = false;
          if (currentJob.value?.id) {
            try {
              await $fetch("/api/jobs/rescue", {
                method: "POST",
                body: { jobId: currentJob.value.id },
              });
              await fetchJob(videoId); // refresh so the UI shows "failed"
            } catch {
              /* ignore — rescue is best-effort */
            }
          }
          break;
        }

        const job = await fetchJob(videoId);
        if (job && (job.status === "completed" || job.status === "failed")) {
          polling.value = false;
          if (job.status === "completed") {
            await fetchShorts(videoId);
          }
          break;
        }
        // Refresh shorts count during step-4 so progress bar can increment
        // after each individual segment is created.
        if (job && CREATING_STEPS_POLL.includes(job.status)) {
          await fetchShorts(videoId);
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    };

    poll();

    return {
      stop: () => {
        polling.value = false;
      },
      polling,
    };
  }

  /**
   * Fetch generated shorts for a video.
   * Default sort: by score descending (most viral first).
   */
  async function fetchShorts(
    videoId: string,
    sortBy: "score" | "chronological" = "score",
  ) {
    if (!user.value) return;

    const order =
      sortBy === "chronological"
        ? { column: "start_time" as const, ascending: true }
        : { column: "score" as const, ascending: false };

    const { data, error } = await supabase
      .from("shorts")
      .select("*")
      .eq("video_id", videoId)
      .eq("user_id", user.value.id)
      .order(order.column, { ascending: order.ascending });

    if (error) {
      console.error("Failed to fetch shorts:", error);
      return;
    }
    shorts.value = data || [];
  }

  /**
   * Get a signed download URL for a short video via server API.
   * This avoids 400 errors from client-side signed URL generation on private buckets.
   */
  async function getDownloadUrl(shortId: string): Promise<string> {
    try {
      const data = await $fetch(`/api/shorts/${shortId}`);
      return (data as any)?.url || "";
    } catch (e) {
      console.error("Failed to get download URL:", e);
      return "";
    }
  }

  /**
   * Delete a single generated short.
   */
  async function deleteShort(shortId: string): Promise<void> {
    await $fetch(`/api/shorts/${shortId}`, { method: "DELETE" });
    shorts.value = shorts.value.filter((s) => s.id !== shortId);
  }

  /**
   * Upload multiple video files at once (batch upload).
   */
  async function uploadVideoBatch(
    files: File[],
    onProgress?: (index: number, total: number) => void,
  ): Promise<any[]> {
    const results: any[] = [];
    for (let i = 0; i < files.length; i++) {
      onProgress?.(i, files.length);
      const file = files[i];
      if (!file) continue;
      const video = await uploadVideo(file);
      results.push(video);
    }
    return results;
  }

  /**
   * Delete a video and all its associated storage files (shorts, audio).
   * The DB deletion cascades to jobs + shorts via FK.
   */
  async function deleteVideo(videoId: string): Promise<void> {
    await $fetch(`/api/videos/${videoId}`, { method: "DELETE" });
    // Remove from local reactive state
    videos.value = videos.value.filter((v) => v.id !== videoId);
    if (currentVideo.value?.id === videoId) {
      currentVideo.value = null;
    }
  }

  /**
   * Check if transcript already exists for the current video (from a previous job).
   */
  function hasTranscript(): boolean {
    return (
      !!currentVideo.value?.transcript &&
      Array.isArray(currentVideo.value.transcript) &&
      currentVideo.value.transcript.length > 0
    );
  }

  /**
   * Download the transcript as an SRT subtitle file.
   */
  function downloadTranscriptSrt(videoTitle?: string) {
    const transcript = currentVideo.value?.transcript;
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0)
      return;

    const srt = generateSrt(transcript);
    const blob = new Blob([srt], { type: "text/srt;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoTitle || currentVideo.value?.title || "subtitles"}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Download the transcript as a VTT subtitle file.
   */
  function downloadTranscriptVtt(videoTitle?: string) {
    const transcript = currentVideo.value?.transcript;
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0)
      return;

    const vtt = generateVtt(transcript);
    const blob = new Blob([vtt], { type: "text/vtt;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoTitle || currentVideo.value?.title || "subtitles"}.vtt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Download the transcript as a JSON file.
   */
  function downloadTranscriptJson(videoTitle?: string) {
    const transcript = currentVideo.value?.transcript;
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0)
      return;

    const json = JSON.stringify(transcript, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoTitle || currentVideo.value?.title || "transcript"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Download segments JSON from a job.
   */
  function downloadSegmentsJson(videoTitle?: string) {
    const segments = currentJob.value?.segments;
    if (!segments || !Array.isArray(segments) || segments.length === 0) return;

    const json = JSON.stringify(segments, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoTitle || currentVideo.value?.title || "segments"}_segments.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Get a signed URL for the original uploaded video.
   */
  async function getOriginalVideoUrl(videoId: string): Promise<string> {
    try {
      const data = await $fetch(`/api/videos/${videoId}`);
      const video = data as any;
      if (!video?.storage_path) return "";
      // Generate a signed URL via Supabase
      const { data: signedData } = await supabase.storage
        .from("videos")
        .createSignedUrl(video.storage_path, 3600);
      return signedData?.signedUrl || "";
    } catch (e) {
      console.error("Failed to get original video URL:", e);
      return "";
    }
  }

  return {
    videos,
    currentVideo,
    currentJob,
    shorts,
    loading,
    fetchVideos,
    fetchVideo,
    uploadVideo,
    uploadVideoBatch,
    generateShorts,
    fetchJob,
    pollJobStatus,
    fetchShorts,
    getDownloadUrl,
    getOriginalVideoUrl,
    deleteVideo,
    deleteShort,
    hasTranscript,
    downloadTranscriptSrt,
    downloadTranscriptVtt,
    downloadTranscriptJson,
    downloadSegmentsJson,
  };
}
