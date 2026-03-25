import { serverSupabaseUser } from "#supabase/server";
import type { H3Event } from "h3";

/**
 * Wrapper around serverSupabaseUser that gracefully handles network errors
 * (e.g. DNS failures when Supabase is unreachable) and always returns either
 * a user object or throws a clean HTTP error — never an unhandled exception.
 */
export async function requireUser(event: H3Event) {
  let user;
  try {
    user = await serverSupabaseUser(event);
  } catch (err: any) {
    const isNetwork =
      err?.cause?.code === "EAI_AGAIN" ||
      err?.cause?.code === "ENOTFOUND" ||
      err?.cause?.code === "ECONNREFUSED" ||
      err?.message?.includes("fetch failed");

    if (isNetwork) {
      throw createError({
        statusCode: 503,
        message:
          "Authentication service temporarily unavailable. Please try again.",
      });
    }
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  return user;
}
