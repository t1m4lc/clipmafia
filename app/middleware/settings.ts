/**
 * Settings middleware — blocks access to /dashboard/settings for free plan users.
 * Redirects to /dashboard so the client-side upgrade dialog handles the UX.
 */
export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser();
  if (!user.value) return navigateTo("/login");

  const config = useRuntimeConfig();
  if (config.public.bypassPayment) return; // bypass plan check

  try {
    const supabase = useSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("subscription_plan, subscription_status")
      .eq("id", user.value.id)
      .single();

    if (error) {
      console.warn("[settings middleware] profile fetch error:", error.message);
      return navigateTo("/dashboard");
    }

    const isActive = ["active", "trialing"].includes(
      data?.subscription_status ?? "",
    );
    const plan = isActive ? (data?.subscription_plan ?? "free") : "free";

    if (plan === "free") {
      return navigateTo("/dashboard");
    }
  } catch (e) {
    console.warn("[settings middleware] unexpected error:", e);
    return navigateTo("/dashboard");
  }
});
