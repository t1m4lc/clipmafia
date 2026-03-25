/**
 * GET /api/profile
 * Get the current user's profile with quota info.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const supabase = useSupabaseAdmin();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw createError({ statusCode: 404, message: "Profile not found" });
  }

  return profile;
});
