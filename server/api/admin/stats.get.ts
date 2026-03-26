/**
 * GET /api/admin/stats
 *
 * Returns aggregated admin dashboard statistics.
 * Protected by ADMIN_SECRET query parameter or header.
 *
 * Query params:
 *   - secret   (required) must match ADMIN_SECRET env var
 *   - from     (optional) ISO date string — start of range (default: 30 days ago)
 *   - to       (optional) ISO date string — end of range   (default: now)
 *   - user_id  (optional) filter by specific user
 */
export default defineEventHandler(async (event) => {
  // ── Auth: admin secret ────────────────────────────────────────────
  const config = useRuntimeConfig();
  const query = getQuery(event);
  const secret =
    (query.secret as string) || getHeader(event, "x-admin-secret") || "";

  if (!config.adminSecret || secret !== config.adminSecret) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  // ── Date range ────────────────────────────────────────────────────
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const from = (query.from as string) || thirtyDaysAgo.toISOString();
  const to = (query.to as string) || now.toISOString();
  const filterUserId = query.user_id as string | undefined;

  const supabase = useSupabaseAdmin();

  // ── Parallel queries ──────────────────────────────────────────────
  const profilesQuery = supabase
    .from("profiles")
    .select("id, email, subscription_plan, subscription_status, created_at");

  const videosQuery = supabase
    .from("videos")
    .select("id, user_id, file_size, duration, status, created_at")
    .gte("created_at", from)
    .lte("created_at", to);

  const jobsQuery = supabase
    .from("jobs")
    .select(
      "id, user_id, video_id, status, failed_at_step, created_at, completed_at, started_at",
    )
    .gte("created_at", from)
    .lte("created_at", to);

  const shortsQuery = supabase
    .from("shorts")
    .select("id, user_id, file_size, duration, download_count, created_at")
    .gte("created_at", from)
    .lte("created_at", to);

  const usageQuery = supabase
    .from("monthly_usage")
    .select("user_id, month, uploads_count, generations_count");

  // Apply user filter if provided
  if (filterUserId) {
    videosQuery.eq("user_id", filterUserId);
    jobsQuery.eq("user_id", filterUserId);
    shortsQuery.eq("user_id", filterUserId);
    usageQuery.eq("user_id", filterUserId);
  }

  const [profilesRes, videosRes, jobsRes, shortsRes, usageRes] =
    await Promise.all([
      profilesQuery,
      videosQuery,
      jobsQuery,
      shortsQuery,
      usageQuery,
    ]);

  const profiles = profilesRes.data ?? [];
  const videos = videosRes.data ?? [];
  const jobs = jobsRes.data ?? [];
  const shorts = shortsRes.data ?? [];
  const usage = usageRes.data ?? [];

  // ── Aggregations ──────────────────────────────────────────────────

  // Overview
  const totalUsers = profiles.length;
  const planBreakdown = profiles.reduce<Record<string, number>>((acc, p) => {
    const plan = p.subscription_plan ?? "free";
    acc[plan] = (acc[plan] ?? 0) + 1;
    return acc;
  }, {});

  const totalUploads = videos.length;
  const totalJobs = jobs.length;
  const totalShorts = shorts.length;

  const completedJobs = jobs.filter((j) => j.status === "completed").length;
  const failedJobs = jobs.filter((j) => j.status === "failed").length;
  const queuedJobs = jobs.filter(
    (j) => !["completed", "failed"].includes(j.status ?? ""),
  ).length;

  // Storage (bytes)
  const totalVideoStorageBytes = videos.reduce(
    (sum, v) => sum + (v.file_size ?? 0),
    0,
  );
  const totalShortsStorageBytes = shorts.reduce(
    (sum, s) => sum + (s.file_size ?? 0),
    0,
  );

  // Processing time (avg seconds for completed jobs)
  const processingTimes = jobs
    .filter((j) => j.status === "completed" && j.started_at && j.completed_at)
    .map((j) => {
      const start = new Date(j.started_at!).getTime();
      const end = new Date(j.completed_at!).getTime();
      return (end - start) / 1000;
    });
  const avgProcessingTimeSec =
    processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      : 0;

  // Total downloads
  const totalDownloads = shorts.reduce(
    (sum, s) => sum + (s.download_count ?? 0),
    0,
  );

  // Video duration processed (seconds)
  const totalVideoDurationSec = videos.reduce(
    (sum, v) => sum + (v.duration ?? 0),
    0,
  );

  // ── Daily breakdown ───────────────────────────────────────────────
  const dailyMap = new Map<
    string,
    { uploads: number; jobs: number; shorts: number; failedJobs: number }
  >();

  for (const v of videos) {
    const day = v.created_at?.split("T")[0] ?? "unknown";
    const entry = dailyMap.get(day) ?? {
      uploads: 0,
      jobs: 0,
      shorts: 0,
      failedJobs: 0,
    };
    entry.uploads++;
    dailyMap.set(day, entry);
  }
  for (const j of jobs) {
    const day = j.created_at?.split("T")[0] ?? "unknown";
    const entry = dailyMap.get(day) ?? {
      uploads: 0,
      jobs: 0,
      shorts: 0,
      failedJobs: 0,
    };
    entry.jobs++;
    if (j.status === "failed") entry.failedJobs++;
    dailyMap.set(day, entry);
  }
  for (const s of shorts) {
    const day = s.created_at?.split("T")[0] ?? "unknown";
    const entry = dailyMap.get(day) ?? {
      uploads: 0,
      jobs: 0,
      shorts: 0,
      failedJobs: 0,
    };
    entry.shorts++;
    dailyMap.set(day, entry);
  }

  const daily = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Per-user breakdown ────────────────────────────────────────────
  const userMap = new Map<
    string,
    {
      email: string;
      plan: string;
      uploads: number;
      jobs: number;
      shorts: number;
      failedJobs: number;
      storageMb: number;
      totalDurationMin: number;
    }
  >();

  // Init from profiles
  for (const p of profiles) {
    userMap.set(p.id, {
      email: p.email ?? "—",
      plan: p.subscription_plan ?? "free",
      uploads: 0,
      jobs: 0,
      shorts: 0,
      failedJobs: 0,
      storageMb: 0,
      totalDurationMin: 0,
    });
  }

  for (const v of videos) {
    const entry = userMap.get(v.user_id);
    if (entry) {
      entry.uploads++;
      entry.storageMb += (v.file_size ?? 0) / (1024 * 1024);
      entry.totalDurationMin += (v.duration ?? 0) / 60;
    }
  }
  for (const j of jobs) {
    const entry = userMap.get(j.user_id);
    if (entry) {
      entry.jobs++;
      if (j.status === "failed") entry.failedJobs++;
    }
  }
  for (const s of shorts) {
    const entry = userMap.get(s.user_id);
    if (entry) {
      entry.shorts++;
    }
  }

  const users = Array.from(userMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.uploads - a.uploads);

  // ── Failed jobs detail ────────────────────────────────────────────
  const failedJobDetails = jobs
    .filter((j) => j.status === "failed")
    .map((j) => ({
      id: j.id,
      userId: j.user_id,
      videoId: j.video_id,
      failedAtStep: j.failed_at_step,
      createdAt: j.created_at,
    }));

  // ── Monthly usage ─────────────────────────────────────────────────
  const monthlyAgg = usage.reduce<
    Record<string, { uploads: number; generations: number }>
  >((acc, u) => {
    const month = u.month;
    if (!acc[month]) acc[month] = { uploads: 0, generations: 0 };
    acc[month]!.uploads += u.uploads_count ?? 0;
    acc[month]!.generations += u.generations_count ?? 0;
    return acc;
  }, {});

  const monthly = Object.entries(monthlyAgg)
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // ── API & infra cost estimation ──────────────────────────────────
  //
  // Deepgram Nova-2 pay-as-you-go : $0.0043 / audio-minute
  // GPT-5.4-mini segment detection : ~$0.003 / job  (mini model, ~3k tokens)
  // Vercel Fluid compute (rates sourced from actual Pro billing):
  //   Fluid Active CPU      : $0.1386 / CPU·hr  ($0.97 ÷ 7 hrs observed)
  //   Fluid Provisioned Mem : $0.01057 / GB·Hr  ($1.12 ÷ 106.01 GB·Hrs observed)
  //   Per FFmpeg job: CPU = avgSec/3600 × 0.7 utilisation × $0.1386
  //                  Mem = avgSec/3600 × 0.512 GB × $0.01057
  //
  // Vercel Pro $20/mo subscription is a fixed cost — NOT included here.

  const deepgramCostEstimate = (totalVideoDurationSec / 60) * 0.0043;
  const aiCostEstimate = completedJobs * 0.003;

  const CPU_RATE_PER_HR = 0.1386; // $/CPU·hr (observed from Vercel bill)
  const MEM_RATE_PER_GB_HR = 0.01057; // $/GB·Hr (observed)
  const CPU_UTILISATION = 0.7; // FFmpeg ~70% active CPU during encode
  const FFMPEG_MEM_GB = 0.512; // 512 MB RAM per invocation

  const avgProcHr = (avgProcessingTimeSec || 0) / 3600;
  const vercelCpuEstimate =
    completedJobs * avgProcHr * CPU_UTILISATION * CPU_RATE_PER_HR;
  const vercelMemEstimate =
    completedJobs * avgProcHr * FFMPEG_MEM_GB * MEM_RATE_PER_GB_HR;
  const vercelTotalEstimate = vercelCpuEstimate + vercelMemEstimate;

  const estimatedTotalCost =
    deepgramCostEstimate + aiCostEstimate + vercelTotalEstimate;

  return {
    range: { from, to },
    overview: {
      totalUsers,
      planBreakdown,
      totalUploads,
      totalJobs,
      completedJobs,
      failedJobs,
      queuedJobs,
      totalShorts,
      totalDownloads,
      totalVideoStorageMb: Math.round(totalVideoStorageBytes / (1024 * 1024)),
      totalShortsStorageMb: Math.round(totalShortsStorageBytes / (1024 * 1024)),
      totalVideoDurationMin: Math.round(totalVideoDurationSec / 60),
      avgProcessingTimeSec: Math.round(avgProcessingTimeSec),
    },
    costs: {
      deepgramEstimate: Math.round(deepgramCostEstimate * 100) / 100,
      aiEstimate: Math.round(aiCostEstimate * 100) / 100,
      vercelCpuEstimate: Math.round(vercelCpuEstimate * 100) / 100,
      vercelMemEstimate: Math.round(vercelMemEstimate * 100) / 100,
      vercelTotalEstimate: Math.round(vercelTotalEstimate * 100) / 100,
      totalEstimate: Math.round(estimatedTotalCost * 100) / 100,
      perJobEstimate:
        completedJobs > 0
          ? Math.round((estimatedTotalCost / completedJobs) * 1000) / 1000
          : 0,
      notes: [
        "Deepgram Nova-2 : $0.0043 / audio-minute",
        "GPT-5.4-mini : ~$0.003 / job",
        `Vercel Fluid CPU (FFmpeg) : $0.1386/CPU·hr × ~${Math.round(avgProcessingTimeSec)}s avg × ${completedJobs} jobs`,
        `Vercel Fluid Memory : $0.01057/GB·Hr × 512 MB × ${completedJobs} jobs`,
        "Rates from your actual Vercel Pro bill. $20/mo subscription NOT included.",
      ],
    },
    daily,
    monthly,
    users,
    failedJobs: failedJobDetails,
  };
});
