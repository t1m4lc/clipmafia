/**
 * Nitro plugin — filters noisy DNS/network errors from the console.
 *
 * When Supabase is temporarily unreachable (EAI_AGAIN / ENOTFOUND), the
 * @nuxtjs/supabase module calls console.error() with a raw Error object whose
 * `.cause` property is a non-plain Error. In dev mode Nuxt tries to serialise
 * every console.error argument via `devalue` to forward it to the browser
 * devtools, and since non-POJO Error objects are not serialisable by devalue
 * this produces the secondary warning:
 *   "Failed to stringify dev server logs. Received DevalueError: Cannot
 *    stringify arbitrary non-POJOs"
 *
 * By intercepting console.error before Nuxt touches it we:
 *   1. Replace the unserializable Error object with a plain string message.
 *   2. Eliminate the DevalueError warning.
 *   3. Keep a single, readable one-line log instead of a 30-line stack dump.
 */

const NETWORK_ERROR_PATTERNS = [
  "EAI_AGAIN",
  "ENOTFOUND",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "fetch failed",
  "getaddrinfo",
  "network socket disconnected",
];

function isNetworkError(args: unknown[]): boolean {
  return args.some((arg) => {
    let text = "";
    if (typeof arg === "string") {
      text = arg;
    } else if (arg instanceof Error) {
      text = arg.message + String((arg as any).cause ?? "");
    } else {
      try {
        text = String(arg);
      } catch {
        return false;
      }
    }
    return NETWORK_ERROR_PATTERNS.some((p) => text.includes(p));
  });
}

import { defineNitroPlugin } from "nitropack/runtime";

export default defineNitroPlugin(() => {
  const _error = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    if (isNetworkError(args)) {
      // Extract URL from the log if present so we keep useful context
      const combined = args.map((a) => String(a)).join(" ");
      const urlMatch = combined.match(/https?:\/\/[^\s]+/);
      const target = urlMatch ? urlMatch[0].replace(/[{}].*$/, "") : "Supabase";
      // Log a single clean line — all strings, fully serialisable by devalue
      console.warn(
        `[Network] DNS/fetch failure — ${target} unreachable. Check connectivity. (EAI_AGAIN / fetch failed)`,
      );
      return;
    }
    _error(...args);
  };
});
