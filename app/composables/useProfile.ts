type Profile = Tables<"profiles">;

/** Resolve SUBSCRIPTION_CONFIG entry for a lowercase plan name. */
function planLimits(plan: string) {
  return (
    SUBSCRIPTION_CONFIG[plan.toUpperCase() as PlanName] ??
    SUBSCRIPTION_CONFIG.FREE
  );
}

/**
 * Composable for user profile management.
 */
export function useProfile() {
  const supabase = useSupabaseClient<Database>();
  const user = useSupabaseUser();

  const profile = ref<Profile | null>(null);
  const loading = ref(false);

  /**
   * Fetch the current user's profile.
   */
  async function fetchProfile() {
    if (!user.value) return null;

    loading.value = true;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.value.id)
        .single();

      if (error) throw error;
      profile.value = data;
      return data;
    } catch (e) {
      console.error("Failed to fetch profile:", e);
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Check if user can process more videos this month.
   * Always returns true when BYPASS_PAYMENT=true.
   */
  function canProcessVideo(): boolean {
    const config = useRuntimeConfig();
    if (config.public.bypassPayment) return true;
    if (!profile.value) return false;
    return (
      profile.value.videos_processed_this_month <
      profile.value.monthly_video_limit
    );
  }

  /**
   * Get remaining video quota.
   * Returns 999 when BYPASS_PAYMENT=true.
   */
  function remainingQuota(): number {
    const config = useRuntimeConfig();
    if (config.public.bypassPayment) return 999;
    if (!profile.value) return 0;
    return Math.max(
      0,
      profile.value.monthly_video_limit -
        profile.value.videos_processed_this_month,
    );
  }

  /**
   * Resolve the plan that is actually in effect right now.
   * Any status that is not 'active' or 'trialing' falls back to 'free',
   * because no paid subscription is active.
   */
  function effectivePlan(): "free" | "starter" | "pro" {
    if (!profile.value) return "free";
    const isActive = ["active", "trialing"].includes(
      profile.value.subscription_status,
    );
    if (!isActive) return "free";
    const plan = profile.value.subscription_plan;
    if (plan === "starter" || plan === "pro") return plan;
    return "free";
  }

  /**
   * Get max upload file size in bytes for the current user's plan.
   * - bypass  → Infinity (no limit)
   * - free    → 50 MB   (3 min max)
   * - starter → 500 MB  (30 min max)
   * - pro     → 3 GB    (60 min max)
   * Falls back to free limit when plan is inactive / unknown.
   */
  function getUploadLimit(): number {
    const config = useRuntimeConfig();
    if (config.public.bypassPayment) return Infinity;
    const plan = profile.value ? effectivePlan() : "free";
    return planLimits(plan).maxFileSizeMb * 1024 * 1024;
  }

  /**
   * Get upload limit info for display in the UI and client-side validation.
   * Returns null when bypassPayment is true (unlimited).
   */
  function getUploadLimitInfo(): {
    mb: number;
    durationMinutes: number;
  } | null {
    const config = useRuntimeConfig();
    if (config.public.bypassPayment) return null; // null = unlimited
    const plan = profile.value ? effectivePlan() : "free";
    const l = planLimits(plan);
    return {
      mb: l.maxFileSizeMb,
      durationMinutes: l.maxDurationMinutes,
    };
  }

  // ── Monthly usage (from monthly_usage table) ────────────────────────────

  const monthlyUsage = ref<{
    uploads_count: number;
  } | null>(null);

  function getCurrentMonth(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  /**
   * Fetch this month's usage counters from the monthly_usage table.
   * Safe to call client-side — RLS allows users to read their own rows.
   */
  async function fetchMonthlyUsage() {
    if (!user.value) return;
    const { data } = await supabase
      .from("monthly_usage")
      .select("uploads_count")
      .eq("user_id", user.value.id)
      .eq("month", getCurrentMonth())
      .maybeSingle();
    monthlyUsage.value = data ?? { uploads_count: 0 };
  }

  /**
   * Returns the current usage stats for the UI.
   * All limits derived from effectivePlan() so they're always consistent.
   */
  function usageStats() {
    const plan = effectivePlan();
    const limits = planLimits(plan);
    const uploadsUsed = monthlyUsage.value?.uploads_count ?? 0;
    const uploadsAtLimit = uploadsUsed >= limits.videoUploadsPerMonth;
    return {
      uploadsUsed,
      uploadsLimit: limits.videoUploadsPerMonth,
      uploadsAtLimit,
      atLimit: uploadsAtLimit,
    };
  }

  return {
    profile,
    loading,
    fetchProfile,
    effectivePlan,
    canProcessVideo,
    remainingQuota,
    getUploadLimit,
    getUploadLimitInfo,
    monthlyUsage,
    fetchMonthlyUsage,
    usageStats,
  };
}
