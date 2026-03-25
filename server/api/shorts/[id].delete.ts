
/**
 * DELETE /api/shorts/:id
 * Deletes a single generated short (storage file + DB record).
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

  // Delete from storage
  const storagePath = (short as any).storage_path;
  if (storagePath) {
    await supabase.storage.from("shorts").remove([storagePath]);
  }

  // Delete from database
  const { error: deleteError } = await supabase
    .from("shorts")
    .delete()
    .eq("id", shortId);

  if (deleteError) {
    console.error("Failed to delete short:", deleteError);
    throw createError({
      statusCode: 500,
      message: "Failed to delete short",
    });
  }

  return { success: true };
});
