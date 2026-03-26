/**
 * Shared subscription plan limits — source of truth for both client and server.
 * Imported by pricing.vue (client) and server/utils/subscriptionLimits.ts (server).
 *
 * Strategy: each plan caps video **duration** and **file size**.
 * Duration is the primary UX-facing limit ("up to 30 min").
 * File size is the hard safety net enforced server-side.
 * Both are checked client-side before upload; the server re-checks file size.
 */

export type PlanName = "FREE" | "STARTER" | "PRO";

export interface PlanSettings {
  videoUploadsPerMonth: number;
  /** Maximum video duration in minutes */
  maxDurationMinutes: number;
  /** Maximum file size in megabytes for a single video upload */
  maxFileSizeMb: number;
  price: number;
}

export const SUBSCRIPTION_CONFIG: Record<PlanName, PlanSettings> = {
  FREE: {
    videoUploadsPerMonth: 3,
    maxDurationMinutes: 3,
    maxFileSizeMb: 50,
    price: 0,
  },
  STARTER: {
    videoUploadsPerMonth: 10,
    maxDurationMinutes: 30,
    maxFileSizeMb: 500, // 500 MB — hard limit matching Vercel Pro /tmp capacity
    price: 9,
  },
  PRO: {
    videoUploadsPerMonth: 50,
    maxDurationMinutes: 60,
    maxFileSizeMb: 3072, // 3 GB
    price: 39,
  },
};

export function getPlanLimits(dbPlan: string): PlanSettings {
  const key = dbPlan.toUpperCase() as PlanName;
  return SUBSCRIPTION_CONFIG[key] ?? SUBSCRIPTION_CONFIG.FREE;
}
