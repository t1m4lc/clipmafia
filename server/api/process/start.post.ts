/**
 * POST /api/process/start
 * Starts the video processing pipeline.
 * Creates a job record and adds it to the queue.
 */
export default defineEventHandler(async (event) => {
  // Authenticate user
  const user = await requireUser(event);

  const body = await readBody(event);
  const { videoId, subtitleSettings } = body;

  if (!videoId) {
    throw createError({ statusCode: 400, message: "videoId is required" });
  }

  const supabase = useSupabaseAdmin();

  // Check video exists and belongs to user
  const { data: video, error: videoError } = await supabase
    .from("videos")
    .select("*")
    .eq("id", videoId)
    .eq("user_id", user.id)
    .single();

  if (videoError || !video) {
    throw createError({ statusCode: 404, message: "Video not found" });
  }

  // Determine clip mode based on video source
  const videoSource = (video as any).source || "upload";
  const clipMode =
    videoSource === "youtube" ? "transcript_only" : "full_render";

  // Create job record — if a previous job failed, carry over its transcript/segments
  // so we don't redo expensive API calls (Deepgram, Mistral)
  let carryOverData: Record<string, any> = {};

  const { data: previousJob } = await supabase
    .from("jobs")
    .select("*")
    .eq("video_id", videoId)
    .eq("user_id", user.id)
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousJob) {
    if ((previousJob as any).transcript) {
      carryOverData.transcript = (previousJob as any).transcript;
    }
    // Only carry over segments if the failure was AFTER segment detection
    const failedStep = (previousJob as any).failed_at_step;
    const postSegmentSteps = [
      "processing_video",
      "burning_subtitles",
      "uploading",
    ];
    if (
      (previousJob as any).segments &&
      postSegmentSteps.includes(failedStep)
    ) {
      carryOverData.segments = (previousJob as any).segments;
    }
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      video_id: videoId,
      user_id: user.id,
      status: "queued",
      progress: 0,
      clip_mode: clipMode,
      subtitle_settings: subtitleSettings || null,
      ...carryOverData,
    } as any)
    .select()
    .single();

  if (jobError || !job) {
    throw createError({ statusCode: 500, message: "Failed to create job" });
  }

  // Update video status
  await supabase
    .from("videos")
    .update({ status: "processing" })
    .eq("id", videoId);

  // Add to processing queue
  jobQueue.add({
    jobId: job.id,
    videoId,
    userId: user.id,
    subtitleSettings,
  });

  return {
    success: true,
    jobId: job.id,
    message: "Processing started",
  };
});
