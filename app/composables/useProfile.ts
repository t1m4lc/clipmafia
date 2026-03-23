import type { Database } from "~/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Upload limits per subscription plan.
 * maxFileSizeMB : limit enforced at selection time
 * maxDurationMinutes : informational label shown in the UI
 *
 * NOTE: Free plan is limited to 50 MB by Supabase Storage default
 */
export const PLAN_LIMITS = {
  free: { maxFileSizeMB: 50, maxDurationMinutes: 2 },
  basic: { maxFileSizeMB: 750, maxDurationMinutes: 30 },
  pro: { maxFileSizeMB: 2000, maxDurationMinutes: 60 },
} as const;

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
   * Always returns true when DEV_BYPASS_STRIPE=true.
   */
  function canProcessVideo(): boolean {
    const config = useRuntimeConfig();
    if (config.public.devBypassStripe) return true;
    if (!profile.value) return false;
    return (
      profile.value.videos_processed_this_month <
      profile.value.monthly_video_limit
    );
  }

  /**
   * Get remaining video quota.
   * Returns 999 when DEV_BYPASS_STRIPE=true.
   */
  function remainingQuota(): number {
    const config = useRuntimeConfig();
    if (config.public.devBypassStripe) return 999;
    if (!profile.value) return 0;
    return Math.max(
      0,
      profile.value.monthly_video_limit -
        profile.value.videos_processed_this_month,
    );
  }

  /**
   * Get max upload file size in bytes for the current user's plan.
   * - bypass  → Infinity (no limit)
   * - free    → 250 MB  (≈ 10 min @ 1080p)
   * - basic   → 750 MB  (≈ 30 min @ 1080p)
   * - pro     → 2 000 MB (≈ 1 h  @ 1080p)
   * Falls back to free limit when plan is inactive / unknown.
   */
  function getUploadLimit(): number {
    const config = useRuntimeConfig();
    if (config.public.devBypassStripe) return Infinity;
    if (!profile.value) return PLAN_LIMITS.free.maxFileSizeMB * 1024 * 1024;

    const isActive = ["active", "trialing"].includes(
      profile.value.subscription_status,
    );
    const plan = isActive ? profile.value.subscription_plan : "free";
    const limitMB =
      PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS]?.maxFileSizeMB ??
      PLAN_LIMITS.free.maxFileSizeMB;
    return limitMB * 1024 * 1024;
  }

  /**
   * Get upload limit info (MB + duration label) for display in the UI.
   */
  function getUploadLimitInfo(): { mb: number; minutes: number } | null {
    const config = useRuntimeConfig();
    if (config.public.devBypassStripe) return null; // null = unlimited

    const toInfo = (p: keyof typeof PLAN_LIMITS) => ({
      mb: PLAN_LIMITS[p].maxFileSizeMB,
      minutes: PLAN_LIMITS[p].maxDurationMinutes,
    });

    if (!profile.value) return toInfo("free");

    const isActive = ["active", "trialing"].includes(
      profile.value.subscription_status,
    );
    const plan = isActive ? profile.value.subscription_plan : "free";
    return toInfo((plan as keyof typeof PLAN_LIMITS) ?? "free");
  }

  return {
    profile,
    loading,
    fetchProfile,
    canProcessVideo,
    remainingQuota,
    getUploadLimit,
    getUploadLimitInfo,
  };
}
