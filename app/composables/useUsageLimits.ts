/**
 * Composable for handling backend usage-limit responses.
 *
 * UX principle: NEVER disable buttons. Always let the user click.
 * The backend decides — if it returns a 429 with `reason === "LIMIT_REACHED"`,
 * this composable opens the UpgradeDialog with the relevant details.
 */

export interface LimitReachedPayload {
  allowed: false;
  reason: "LIMIT_REACHED";
  type: "UPLOAD" | "GENERATION";
  limit: number;
  used: number;
  resetDate: string;
}

export function useUsageLimits() {
  // Dialog state — reactive so the template can bind to it
  const showUpgradeDialog = ref(false);
  const limitPayload = ref<LimitReachedPayload>({
    allowed: false,
    reason: "LIMIT_REACHED",
    type: "UPLOAD",
    limit: 0,
    used: 0,
    resetDate: "",
  });

  /**
   * Inspect a caught error from `$fetch` / `useFetch`.
   * If it's a 429 LIMIT_REACHED, opens the upgrade dialog and returns `true`.
   * Otherwise returns `false` so the caller can handle it normally.
   */
  function handleLimitError(error: any): boolean {
    // Nuxt's $fetch wraps HTTP errors in FetchError with `error.data`
    const data =
      error?.data?.data ?? error?.data ?? error?.response?._data?.data;

    if (data && data.reason === "LIMIT_REACHED") {
      limitPayload.value = {
        allowed: false,
        reason: "LIMIT_REACHED",
        type: data.type,
        limit: data.limit,
        used: data.used,
        resetDate: data.resetDate,
      };
      showUpgradeDialog.value = true;
      return true;
    }

    return false;
  }

  return {
    showUpgradeDialog,
    limitPayload,
    handleLimitError,
  };
}
