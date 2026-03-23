import { serverSupabaseUser } from "#supabase/server";

/**
 * POST /api/process/start
 * Starts the video processing pipeline.
 * Creates a job record and adds it to the queue.
 */
export default defineEventHandler(async (event) => {
  // Authenticate user
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const body = await readBody(event);
  const { videoId, durationOption = 60, subtitleSettings } = body;

  if (!videoId) {
    throw createError({ statusCode: 400, message: "videoId is required" });
  }

  if (![15, 30, 60].includes(durationOption)) {
    throw createError({
      statusCode: 400,
      message: "durationOption must be 15, 30, or 60",
    });
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

  // Check user quota (skipped when DEV_BYPASS_STRIPE=true)
  const config = useRuntimeConfig();
  if (!config.devBypassStripe) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("videos_processed_this_month, monthly_video_limit")
      .eq("id", user.id)
      .single();

    if (
      profile &&
      profile.videos_processed_this_month >= profile.monthly_video_limit
    ) {
      throw createError({
        statusCode: 429,
        message: "Monthly video limit reached. Please upgrade your plan.",
      });
    }
  }

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
      duration_option: durationOption,
      progress: 0,
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

  // Always increment the monthly counter (bypass only skips the limit *check*, not the counting)
  const { data: profileData } = await supabase
    .from("profiles")
    .select("videos_processed_this_month")
    .eq("id", user.id)
    .single();

  if (profileData) {
    await supabase
      .from("profiles")
      .update({
        videos_processed_this_month:
          profileData.videos_processed_this_month + 1,
      })
      .eq("id", user.id);
  }

  // Add to processing queue
  jobQueue.add({
    jobId: job.id,
    videoId,
    userId: user.id,
    durationOption,
    subtitleSettings,
  });

  return {
    success: true,
    jobId: job.id,
    message: "Processing started",
  };
});
