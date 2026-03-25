
/**
 * GET /api/shorts/:id
 * Returns a signed download URL for a short video.
 * Must be done server-side because the shorts bucket is private
 * and the service-role key is needed for createSignedUrl.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const shortId = getRouterParam(event, "id");
  if (!shortId) {
    throw createError({ statusCode: 400, message: "Short ID is required" });
  }

  const supabase = useSupabaseAdmin();

  // Fetch the short record and verify ownership
  const { data: short, error } = await supabase
    .from("shorts")
    .select("*")
    .eq("id", shortId)
    .eq("user_id", user.id)
    .single();

  if (error || !short) {
    throw createError({ statusCode: 404, message: "Short not found" });
  }

  const s = short as any;

  // Generate a signed URL using the admin client
  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from("shorts")
    .createSignedUrl(s.storage_path, 3600); // 1 hour

  if (urlError || !signedUrlData?.signedUrl) {
    console.error("Failed to create signed URL:", urlError);
    throw createError({
      statusCode: 500,
      message: "Failed to generate download link",
    });
  }

  // Generate thumbnail URL if available
  let thumbnailUrl: string | null = null;
  if (s.thumbnail_path) {
    const { data: thumbUrlData } = await supabase.storage
      .from("thumbnails")
      .createSignedUrl(s.thumbnail_path, 3600);
    thumbnailUrl = thumbUrlData?.signedUrl ?? null;
  }

  return {
    url: signedUrlData.signedUrl,
    title: s.title,
    storagePath: s.storage_path,
    thumbnailUrl,
  };
});
