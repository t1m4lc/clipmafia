
/**
 * GET /api/videos/[id]
 * Get a single video by ID.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const videoId = getRouterParam(event, "id");
  if (!videoId) {
    throw createError({ statusCode: 400, message: "Video ID is required" });
  }

  const supabase = useSupabaseAdmin();

  const { data: video, error } = await supabase
    .from("videos")
    .select("*")
    .eq("id", videoId)
    .eq("user_id", user.id)
    .single();

  if (error || !video) {
    throw createError({ statusCode: 404, message: "Video not found" });
  }

  return video;
});
