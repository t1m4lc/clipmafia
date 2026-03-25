/**
 * Server middleware to protect API routes under /api/ (except webhooks).
 */
export default defineEventHandler(async (event) => {
  // Skip auth for webhook endpoints and public routes
  const url = getRequestURL(event);
  const publicPaths = ["/api/stripe/webhook", "/api/_"];

  if (publicPaths.some((p) => url.pathname.startsWith(p))) {
    return;
  }

  // Only protect /api/ routes
  if (!url.pathname.startsWith("/api/")) {
    return;
  }
});
