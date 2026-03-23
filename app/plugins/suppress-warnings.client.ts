/**
 * Suppress Vue's "<Suspense> is an experimental feature" runtime warning.
 * Nuxt uses Suspense internally, so this warning is expected and noisy.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.warnHandler = (msg, _instance, _trace) => {
    if (msg.includes("Suspense")) return;
    console.warn(msg);
  };
});
