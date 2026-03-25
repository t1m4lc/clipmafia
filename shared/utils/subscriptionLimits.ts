/**
 * Shared subscription plan limits — source of truth for both client and server.
 * Imported by pricing.vue (client) and server/utils/subscriptionLimits.ts (server).
 *
 * Strategy:
 * - YouTube links are FREE (low infra cost — transcript-only processing).
 * - File uploads are a PREMIUM feature (heavy infra — FFmpeg, storage, bandwidth).
 * - Each plan caps file uploads, YouTube links, video duration, file size, and clips per generation.
 */

export type PlanName = "FREE" | "PRO" | "BUSINESS";

export interface PlanSettings {
  /** File uploads per month (premium feature) */
  videoUploadsPerMonth: number;
  /** YouTube link submissions per month */
  youtubeLinksPerMonth: number;
  /** Maximum video duration in minutes */
  maxDurationMinutes: number;
  /** Maximum file size in megabytes for a single video upload */
  maxFileSizeMb: number;
  /** Maximum clips generated per run */
  maxClipsPerGeneration: number;
  price: number;
}

export const SUBSCRIPTION_CONFIG: Record<PlanName, PlanSettings> = {
  FREE: {
    videoUploadsPerMonth: 0,
    youtubeLinksPerMonth: 10,
    maxDurationMinutes: 15,
    maxFileSizeMb: 50,
    maxClipsPerGeneration: 5,
    price: 0,
  },
  PRO: {
    videoUploadsPerMonth: 10,
    youtubeLinksPerMonth: 50,
    maxDurationMinutes: 30,
    maxFileSizeMb: 1024, // 1 GB
    maxClipsPerGeneration: 15,
    price: 15,
  },
  BUSINESS: {
    videoUploadsPerMonth: 50,
    youtubeLinksPerMonth: 999,
    maxDurationMinutes: 60,
    maxFileSizeMb: 3072, // 3 GB
    maxClipsPerGeneration: 30,
    price: 75,
  },
};

export function getPlanLimits(dbPlan: string): PlanSettings {
  const key = dbPlan.toUpperCase() as PlanName;
  return SUBSCRIPTION_CONFIG[key] ?? SUBSCRIPTION_CONFIG.FREE;
}
