/**
 * Settings middleware — requires authentication only.
 * Free plan users can browse the settings page but will be prompted
 * to upgrade when they try to save (handled client-side).
 */
export default defineNuxtRouteMiddleware(() => {
  const user = useSupabaseUser();
  if (!user.value) return navigateTo("/login");
});
