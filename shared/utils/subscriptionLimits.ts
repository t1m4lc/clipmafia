/**
 * Shared subscription plan limits — source of truth for both client and server.
 * Imported by pricing.vue (client) and server/utils/subscriptionLimits.ts (server).
 */

export type PlanName = "FREE" | "PRO" | "BUSINESS";

export interface PlanLimits {
  videoUploadsPerMonth: number;
  /** Maximum file size in megabytes for a single video upload */
  maxFileSizeMb: number;
}

export const SUBSCRIPTION_LIMITS: Record<PlanName, PlanLimits> = {
  FREE: {
    videoUploadsPerMonth: 1,
    maxFileSizeMb: 50,
  },
  PRO: {
    videoUploadsPerMonth: 10,
    maxFileSizeMb: 500, // 1 GB
  },
  BUSINESS: {
    videoUploadsPerMonth: 50,
    maxFileSizeMb: 1024, // 1 GB
  },
};

export function getPlanLimits(dbPlan: string): PlanLimits {
  const key = dbPlan.toUpperCase() as PlanName;
  return SUBSCRIPTION_LIMITS[key] ?? SUBSCRIPTION_LIMITS.FREE;
}
