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
  type: "UPLOAD" | "GENERATION";
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
      .select("subscription_plan, subscription_status")
      .eq("id", userId)
      .single(),
    supabase
      .from("monthly_usage")
      .select("uploads_count, generations_count")
      .eq("user_id", userId)
      .eq("month", currentMonth)
      .maybeSingle(),
  ]);

  const profile = profileResult.data as Tables<"profiles"> | null;
  const usage = usageResult.data as Pick<
    Tables<"monthly_usage">,
    "uploads_count" | "generations_count"
  > | null;

  // Only active / trialing subscriptions count; everything else → free
  const isActive =
    profile &&
    ["active", "trialing"].includes(profile.subscription_status ?? "");
  const planName = (isActive ? profile.subscription_plan : "free") || "free";
  const limits = getPlanLimits(planName);

  return {
    limits,
    uploadsUsed: usage?.uploads_count ?? 0,
    generationsUsed: usage?.generations_count ?? 0,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check whether the user is allowed to upload another video this month.
 */
export async function canUpload(userId: string): Promise<UsageCheckResult> {
  const { limits, uploadsUsed } = await getUserPlanAndUsage(userId);
  const resetDate = getResetDate();

  return {
    allowed: uploadsUsed < limits.videoUploadsPerMonth,
    remaining: Math.max(0, limits.videoUploadsPerMonth - uploadsUsed),
    limit: limits.videoUploadsPerMonth,
    used: uploadsUsed,
    resetDate,
  };
}

/**
 * Check whether the user is allowed to generate another short this month.
 */
export async function canGenerateShort(
  userId: string,
): Promise<UsageCheckResult> {
  const { limits, generationsUsed } = await getUserPlanAndUsage(userId);
  const resetDate = getResetDate();

  return {
    allowed: generationsUsed < limits.shortsGenerationsPerMonth,
    remaining:
      limits.shortsGenerationsPerMonth === Infinity
        ? Infinity
        : Math.max(0, limits.shortsGenerationsPerMonth - generationsUsed),
    limit: limits.shortsGenerationsPerMonth,
    used: generationsUsed,
    resetDate,
  };
}

/**
 * Atomically increment the upload counter for the current month.
 * Creates the monthly_usage row if it doesn't exist (upsert).
 */
export async function incrementUploadCount(userId: string): Promise<void> {
  const supabase = useSupabaseAdmin() as unknown as SupabaseClient<Database>;
  const currentMonth = getCurrentMonth();

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
      generations_count: 0,
    });
  }
}

/**
 * Atomically increment the generation counter for the current month.
 * Creates the monthly_usage row if it doesn't exist (upsert).
 */
export async function incrementGenerationCount(userId: string): Promise<void> {
  const supabase = useSupabaseAdmin() as unknown as SupabaseClient<Database>;
  const currentMonth = getCurrentMonth();

  const { data: existing } = (await supabase
    .from("monthly_usage")
    .select("id, generations_count")
    .eq("user_id", userId)
    .eq("month", currentMonth)
    .maybeSingle()) as {
    data: Pick<Tables<"monthly_usage">, "id" | "generations_count"> | null;
  };

  if (existing) {
    await (supabase as any)
      .from("monthly_usage")
      .update({ generations_count: existing.generations_count + 1 })
      .eq("id", existing.id);
  } else {
    await (supabase as any).from("monthly_usage").insert({
      user_id: userId,
      month: currentMonth,
      uploads_count: 0,
      generations_count: 1,
    });
  }
}

/**
 * Build the standardised denial payload returned to clients.
 */
export function buildDeniedPayload(
  type: "UPLOAD" | "GENERATION",
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
