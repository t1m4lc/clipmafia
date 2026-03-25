import { getPlanLimits } from "#shared/utils/subscriptionLimits";
import type { YouTubeMetadata } from "#shared/types/domain";

/**
 * POST /api/videos/youtube
 *
 * Accept a YouTube URL, validate it, fetch metadata + transcript,
 * and create a video record with source='youtube'.
 *
 * This route is FREE — no upload-limit check (uses youtube_links_count instead).
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const body = await readBody(event);
  const { url } = body;

  if (!url || typeof url !== "string") {
    throw createError({ statusCode: 400, message: "YouTube URL is required" });
  }

  // ── Validate YouTube URL ───────────────────────────────────────────────
  const videoId = extractYoutubeVideoId(url);
  if (!videoId) {
    throw createError({
      statusCode: 400,
      message:
        "Invalid YouTube URL. Please provide a valid youtube.com or youtu.be link.",
    });
  }

  // ── Check YouTube link rate limit ──────────────────────────────────────
  const config = useRuntimeConfig();
  if (!config.bypassPayment) {
    const linkCheck = await canSubmitYoutubeLink(user.id);
    if (!linkCheck.allowed) {
      throw createError({
        statusCode: 429,
        data: buildDeniedPayload("YOUTUBE_LINK", linkCheck),
        message:
          "Monthly YouTube link limit reached. Please upgrade your plan.",
      });
    }
  }

  // ── Fetch metadata via oEmbed (free, no API key needed) ────────────────
  let metadata: YouTubeMetadata;
  try {
    metadata = await fetchYoutubeMetadata(videoId, url);
  } catch (e: any) {
    throw createError({
      statusCode: 422,
      message:
        e.message ||
        "Could not fetch video metadata. The video may be private or restricted.",
    });
  }

  // ── Duration check against plan limits ─────────────────────────────────
  if (metadata.duration > 0) {
    const supabaseAdmin = useSupabaseAdmin();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("subscription_plan, subscription_status")
      .eq("id", user.id)
      .single();

    const isActive =
      profile &&
      ["active", "trialing"].includes(profile.subscription_status ?? "");
    const planName = (isActive ? profile.subscription_plan : "free") || "free";
    const limits = getPlanLimits(planName);
    const maxSeconds = limits.maxDurationMinutes * 60;

    if (metadata.duration > maxSeconds) {
      throw createError({
        statusCode: 413,
        message: `Video is ${Math.ceil(metadata.duration / 60)} min long — your plan allows up to ${limits.maxDurationMinutes} min.`,
      });
    }
  }

  // ── Fetch transcript ───────────────────────────────────────────────────
  let transcript: any[] | null = null;
  let transcriptError: string | null = null;

  try {
    const { YoutubeTranscript } = await import("youtube-transcript");
    let rawTranscript: any[] | null = null;

    try {
      rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);
    } catch {
      // Fallback: request English explicitly (handles auto-generated captions)
      rawTranscript = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: "en",
      });
    }

    if (rawTranscript && rawTranscript.length > 0) {
      // youtube-transcript returns offset/duration in seconds
      transcript = rawTranscript.map((item: any) => ({
        start: Number(item.offset),
        end: Number(item.offset) + Number(item.duration),
        text: item.text,
        confidence: 1.0,
      }));
    }
  } catch (e: any) {
    console.warn(
      `[YouTube] Transcript fetch failed for ${videoId}:`,
      e.message,
    );
    transcriptError = e.message || "Transcript not available";
  }

  // ── Create video record ────────────────────────────────────────────────
  const supabase = useSupabaseAdmin();

  const videoData: any = {
    user_id: user.id,
    title: metadata.title || `YouTube Video (${videoId})`,
    original_filename: null,
    storage_path: null,
    source: "youtube",
    source_url: url,
    youtube_metadata: metadata as any,
    duration: metadata.duration || null,
    status: transcript && transcript.length > 0 ? "ready" : "uploaded",
    transcript: transcript,
  };

  const { data: video, error } = await supabase
    .from("videos")
    .insert(videoData)
    .select()
    .single();

  if (error) {
    console.error("Failed to create YouTube video record:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to create video record",
    });
  }

  // ── Increment YouTube link counter ─────────────────────────────────────
  await incrementYoutubeLinkCount(user.id);

  return {
    ...video,
    transcriptAvailable: !!(transcript && transcript.length > 0),
    transcriptError,
  };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract YouTube video ID from various URL formats.
 */
function extractYoutubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // bare video ID
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Fetch video metadata via YouTube oEmbed API (free, no API key).
 */
async function fetchYoutubeMetadata(
  videoId: string,
  originalUrl: string,
): Promise<YouTubeMetadata> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(originalUrl)}&format=json`;

  try {
    const response = await fetch(oembedUrl);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "This video is private or restricted and cannot be accessed.",
        );
      }
      throw new Error(`YouTube returned status ${response.status}`);
    }

    const data = await response.json();

    return {
      videoId,
      title: data.title || "",
      author: data.author_name || "",
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: 0, // oEmbed doesn't provide duration; will be inferred from transcript
    };
  } catch (e: any) {
    if (e.message?.includes("private") || e.message?.includes("restricted")) {
      throw e;
    }
    throw new Error(
      "Could not fetch video metadata. Please check the URL and try again.",
    );
  }
}
