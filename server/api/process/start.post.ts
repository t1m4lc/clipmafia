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
  const { videoId, durationOption = 60 } = body;

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

  // Create job record
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      video_id: videoId,
      user_id: user.id,
      status: "queued",
      duration_option: durationOption,
      progress: 0,
    })
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
    durationOption,
  });

  return {
    success: true,
    jobId: job.id,
    message: "Processing started",
  };
});
