/**
 * POST /api/referrals/claim
 *
 * Record a referral share action (e.g. Twitter) and grant +1 upload credit.
 * Rate-limited to 1 credit per day per user to prevent abuse.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = await readBody(event);
  const platform = body?.platform || "unknown";

  const supabase = useSupabaseAdmin();

  // ── Rate limit: max 1 referral credit per day ────────────────────────
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_id", user.id)
    .gte("created_at", oneDayAgo);

  if ((count ?? 0) >= 1) {
    return { ok: true, message: "Already claimed today" };
  }

  // ── Insert referral record ───────────────────────────────────────────
  const { error: insertError } = await supabase.from("referrals").insert({
    referrer_id: user.id,
    platform,
    credited: false,
  });

  if (insertError) {
    throw createError({
      statusCode: 500,
      message: "Failed to record referral",
    });
  }

  // ── Grant +1 upload credit ───────────────────────────────────────────
  const { error: creditError } = await supabase.rpc("increment_upload_credit", {
    user_id_param: user.id,
  });

  // Fallback if RPC doesn't exist — direct update
  if (creditError) {
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("upload_credits")
      .eq("id", user.id)
      .single();

    await supabase
      .from("profiles")
      .update({
        upload_credits: ((currentProfile as any)?.upload_credits ?? 0) + 1,
      } as any)
      .eq("id", user.id);
  }

  return { ok: true, message: "Upload credit granted!" };
});
