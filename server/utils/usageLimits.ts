import { getPlanLimits } from "#shared/utils/subscriptionLimits";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "#shared/types/database.types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UsageCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
  resetDate: string;
}

export interface UsageDeniedPayload {
  allowed: false;
  reason: "LIMIT_REACHED";
  type: "UPLOAD" | "GENERATION" | "YOUTUBE_LINK";
  limit: number;
  used: number;
  resetDate: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Current month in YYYY-MM format (UTC). */
function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** First day of the next month (UTC) as a YYYY-MM-DD string. */
function getResetDate(): string {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return next.toISOString().split("T")[0]!;
}

/**
 * Fetch the user's effective plan limits and current-month usage counters.
 * Uses the admin client (bypasses RLS).
 */
async function getUserPlanAndUsage(userId: string) {
  const supabase = useSupabaseAdmin();
  const currentMonth = getCurrentMonth();

  const [profileResult, usageResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("subscription_plan, subscription_status, upload_credits")
      .eq("id", userId)
      .single(),
    supabase
      .from("monthly_usage")
      .select("uploads_count, youtube_links_count")
      .eq("user_id", userId)
      .eq("month", currentMonth)
      .maybeSingle(),
  ]);

  const profile = profileResult.data as any;
  const usage = usageResult.data as any;

  // Only active / trialing subscriptions count; everything else → free
  const isActive =
    profile &&
    ["active", "trialing"].includes(profile.subscription_status ?? "");
  const planName = (isActive ? profile.subscription_plan : "free") || "free";
  const limits = getPlanLimits(planName);

  return {
    limits,
    uploadsUsed: usage?.uploads_count ?? 0,
    youtubeLinksUsed: usage?.youtube_links_count ?? 0,
    uploadCredits: profile?.upload_credits ?? 0,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check whether the user is allowed to upload another video this month.
 * Upload is allowed if:
 *   1. User has remaining paid uploads, OR
 *   2. User has upload_credits > 0 (earned via referrals)
 */
export async function canUpload(userId: string): Promise<UsageCheckResult> {
  const { limits, uploadsUsed, uploadCredits } =
    await getUserPlanAndUsage(userId);
  const resetDate = getResetDate();

  const hasSubscriptionUploads = uploadsUsed < limits.videoUploadsPerMonth;
  const hasCredits = uploadCredits > 0;

  return {
    allowed: hasSubscriptionUploads || hasCredits,
    remaining:
      Math.max(0, limits.videoUploadsPerMonth - uploadsUsed) + uploadCredits,
    limit: limits.videoUploadsPerMonth,
    used: uploadsUsed,
    resetDate,
  };
}

/**
 * Check whether the user is allowed to submit another YouTube link this month.
 */
export async function canSubmitYoutubeLink(
  userId: string,
): Promise<UsageCheckResult> {
  const { limits, youtubeLinksUsed } = await getUserPlanAndUsage(userId);
  const resetDate = getResetDate();

  return {
    allowed: youtubeLinksUsed < limits.youtubeLinksPerMonth,
    remaining: Math.max(0, limits.youtubeLinksPerMonth - youtubeLinksUsed),
    limit: limits.youtubeLinksPerMonth,
    used: youtubeLinksUsed,
    resetDate,
  };
}

/**
 * Atomically increment the upload counter for the current month.
 * If the user has no subscription uploads remaining, consume an upload credit instead.
 */
export async function incrementUploadCount(userId: string): Promise<void> {
  const supabase = useSupabaseAdmin() as unknown as SupabaseClient<Database>;
  const currentMonth = getCurrentMonth();

  // Check if we should consume a credit instead of a plan upload
  const { limits, uploadsUsed, uploadCredits } =
    await getUserPlanAndUsage(userId);
  const hasSubscriptionUploads = uploadsUsed < limits.videoUploadsPerMonth;

  if (!hasSubscriptionUploads && uploadCredits > 0) {
    // Consume an upload credit
    await (supabase as any)
      .from("profiles")
      .update({ upload_credits: Math.max(0, uploadCredits - 1) })
      .eq("id", userId);
    return;
  }

  // Increment the monthly counter
  const { data: existing } = (await supabase
    .from("monthly_usage")
    .select("id, uploads_count")
    .eq("user_id", userId)
    .eq("month", currentMonth)
    .maybeSingle()) as {
    data: Pick<Tables<"monthly_usage">, "id" | "uploads_count"> | null;
  };

  if (existing) {
    await (supabase as any)
      .from("monthly_usage")
      .update({ uploads_count: existing.uploads_count + 1 })
      .eq("id", existing.id);
  } else {
    await (supabase as any).from("monthly_usage").insert({
      user_id: userId,
      month: currentMonth,
      uploads_count: 1,
      youtube_links_count: 0,
      generations_count: 0,
    });
  }
}

/**
 * Atomically increment the YouTube link counter for the current month.
 */
export async function incrementYoutubeLinkCount(userId: string): Promise<void> {
  const supabase = useSupabaseAdmin() as unknown as SupabaseClient<Database>;
  const currentMonth = getCurrentMonth();

  const { data: existing } = (await supabase
    .from("monthly_usage")
    .select("id, youtube_links_count")
    .eq("user_id", userId)
    .eq("month", currentMonth)
    .maybeSingle()) as {
    data: { id: string; youtube_links_count: number } | null;
  };

  if (existing) {
    await (supabase as any)
      .from("monthly_usage")
      .update({ youtube_links_count: (existing.youtube_links_count ?? 0) + 1 })
      .eq("id", existing.id);
  } else {
    await (supabase as any).from("monthly_usage").insert({
      user_id: userId,
      month: currentMonth,
      uploads_count: 0,
      youtube_links_count: 1,
      generations_count: 0,
    });
  }
}

/**
 * Build the standardised denial payload returned to clients.
 */
export function buildDeniedPayload(
  type: "UPLOAD" | "GENERATION" | "YOUTUBE_LINK",
  check: UsageCheckResult,
): UsageDeniedPayload {
  return {
    allowed: false,
    reason: "LIMIT_REACHED",
    type,
    limit: check.limit,
    used: check.used,
    resetDate: check.resetDate,
  };
}
