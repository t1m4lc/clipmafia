/**
 * POST /api/jobs/rescue
 * Marks a stale, non-terminal job as "failed" so the user can retry.
 *
 * A job is considered stale when:
 *  - It has been in "queued" status for more than 2 minutes (fire-and-forget
 *    may have silently failed), OR
 *  - It has been in any other non-terminal status for more than 15 minutes
 *    without an updated_at bump (Vercel function likely timed out / crashed).
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const { jobId } = await readBody<{ jobId: string }>(event);
  if (!jobId) {
    throw createError({ statusCode: 400, message: "jobId is required" });
  }

  const supabase = useSupabaseAdmin();

  // Verify ownership and get current state
  const { data: job, error: fetchErr } = await supabase
    .from("jobs")
    .select("id, status, updated_at, created_at, video_id")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr || !job) {
    throw createError({ statusCode: 404, message: "Job not found" });
  }

  // Nothing to do if already terminal
  if (job.status === "completed" || job.status === "failed") {
    return { ok: true, rescued: false, status: job.status };
  }

  // Determine staleness threshold depending on status
  const ageMs =
    Date.now() -
    new Date((job.updated_at ?? job.created_at) as string).getTime();
  const QUEUED_STALE_MS = 2 * 60 * 1000; // 2 min for "queued"
  const ACTIVE_STALE_MS = 15 * 60 * 1000; // 15 min for all other steps

  const staleThresholdMs =
    job.status === "queued" ? QUEUED_STALE_MS : ACTIVE_STALE_MS;

  if (ageMs < staleThresholdMs) {
    // Still within normal operating window — do not rescue yet
    return { ok: false, rescued: false, message: "Job is still active" };
  }

  // Mark job as failed
  await supabase
    .from("jobs")
    .update({
      status: "failed",
      error_message:
        job.status === "queued"
          ? "Processing could not be started. Please retry."
          : "Processing timed out or was interrupted. Please retry.",
      failed_at_step: job.status,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", jobId);

  // Mark video as failed too
  if (job.video_id) {
    await supabase
      .from("videos")
      .update({ status: "failed" } as any)
      .eq("id", job.video_id)
      .eq("user_id", user.id);
  }

  return { ok: true, rescued: true };
});
