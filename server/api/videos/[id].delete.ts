import { serverSupabaseUser } from "#supabase/server";
import type { Tables } from "#shared/types/database.types";

type VideoRow = Tables<"videos">;
type ShortStoragePath = Pick<Tables<"shorts">, "storage_path">;
type JobId = Pick<Tables<"jobs">, "id">;

/**
 * DELETE /api/videos/[id]
 * Deletes a video and all associated assets (storage files, shorts, jobs).
 * The DB deletion cascades to jobs + shorts rows via FK constraints.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const videoId = getRouterParam(event, "id");
  if (!videoId) {
    throw createError({ statusCode: 400, message: "Video ID is required" });
  }

  const supabase = useSupabaseAdmin();

  // Verify ownership and get storage path
  const { data: video, error: videoError } = (await supabase
    .from("videos")
    .select("*")
    .eq("id", videoId)
    .eq("user_id", user.id)
    .single()) as { data: VideoRow | null; error: unknown };

  if (videoError || !video) {
    throw createError({ statusCode: 404, message: "Video not found" });
  }

  // Collect short storage paths before deletion
  const { data: shorts } = (await supabase
    .from("shorts")
    .select("storage_path")
    .eq("video_id", videoId)) as {
    data: ShortStoragePath[] | null;
    error: unknown;
  };

  // Collect job IDs to clean up audio files
  const { data: jobs } = (await supabase
    .from("jobs")
    .select("id")
    .eq("video_id", videoId)) as { data: JobId[] | null; error: unknown };

  // --- Delete files from storage buckets ---

  // 1. Original video
  await supabase.storage.from("videos").remove([video.storage_path]);

  // 2. Generated shorts
  if (shorts && shorts.length > 0) {
    const shortPaths = shorts.map((s) => s.storage_path);
    await supabase.storage.from("shorts").remove(shortPaths);
  }

  // 3. Audio files uploaded during processing
  if (jobs && jobs.length > 0) {
    const audioPaths = jobs.map((j) => `${user.id}/${j.id}/audio.mp3`);
    await supabase.storage.from("audio").remove(audioPaths);
  }

  // --- Delete DB record (cascades to jobs + shorts rows) ---
  const { error: deleteError } = await supabase
    .from("videos")
    .delete()
    .eq("id", videoId)
    .eq("user_id", user.id);

  if (deleteError) {
    throw createError({ statusCode: 500, message: "Failed to delete video" });
  }

  return { success: true };
});
