import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";

const execFileAsync = promisify(execFile);

import {
  DEFAULT_SUBTITLE_STYLE as OVERLAY_DEFAULTS,
  WATERMARK_CONFIG,
  getWatermarkAlignment,
  RENDER,
  PREVIEW_TO_ASS_SCALE,
  type SubtitleStyleConfig,
  type WatermarkConfig,
} from "./overlayConfig";

export interface SubtitleStyle {
  fontName?: string;
  fontSize?: number;
  primaryColor?: string; // hex like "#FFFFFF"
  outlineColor?: string; // hex like "#000000"
  bold?: boolean;
  outline?: number;
  shadow?: number;
  marginV?: number;
  alignment?: number; // 2 = bottom center
}

const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontName: OVERLAY_DEFAULTS.fontName,
  fontSize: OVERLAY_DEFAULTS.fontSize,
  primaryColor: OVERLAY_DEFAULTS.primaryColor,
  outlineColor: OVERLAY_DEFAULTS.outlineColor,
  bold: OVERLAY_DEFAULTS.bold,
  outline: OVERLAY_DEFAULTS.outline,
  shadow: OVERLAY_DEFAULTS.shadow,
  marginV: OVERLAY_DEFAULTS.marginV,
  alignment: OVERLAY_DEFAULTS.alignment,
};

/** Convert a hex color like "#RRGGBB" to ASS format "&H00BBGGRR" */
function hexToAss(hex: string): string {
  const h = hex.replace("#", "");
  const r = h.substring(0, 2);
  const g = h.substring(2, 4);
  const b = h.substring(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

/**
 * Run ffmpeg via execFile (no shell) with stderr capture for diagnostics.
 */
async function runFfmpeg(
  args: string[],
  timeout: number = 600000,
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync("ffmpeg", args, {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: result.stdout || "", stderr: result.stderr || "" };
  } catch (error: any) {
    const stderr = error.stderr || "";
    const message = `FFmpeg failed (exit ${error.code}): ${stderr.slice(-500)}`;
    throw new Error(message);
  }
}

/**
 * Run ffprobe via execFile (no shell) with stderr capture.
 */
async function runFfprobe(
  args: string[],
  timeout: number = 60000,
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync("ffprobe", args, {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: result.stdout || "", stderr: result.stderr || "" };
  } catch (error: any) {
    const stderr = error.stderr || "";
    const message = `FFprobe failed (exit ${error.code}): ${stderr.slice(-500)}`;
    throw new Error(message);
  }
}

/**
 * Extract audio from a video file.
 * Uses execFile (no shell) to avoid shell-injection with file paths.
 */
export async function extractAudio(
  videoPath: string,
  outputPath: string,
): Promise<string> {
  await runFfmpeg(
    [
      "-y",
      "-i",
      videoPath,
      "-vn",
      "-acodec",
      "libmp3lame",
      "-ab",
      "128k",
      "-ar",
      "16000",
      "-ac",
      "1",
      outputPath,
    ],
    300000, // 5 min
  );
  return outputPath;
}

/**
 * Get video metadata (duration, dimensions) using ffprobe.
 * Uses execFile (no shell) for safety.
 */
export async function getVideoMetadata(videoPath: string): Promise<{
  duration: number;
  width: number;
  height: number;
}> {
  const { stdout } = await runFfprobe([
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    videoPath,
  ]);

  const data = JSON.parse(stdout);

  const videoStream = data.streams?.find((s: any) => s.codec_type === "video");
  const duration = parseFloat(data.format?.duration || "0");
  const width = videoStream?.width || 1920;
  const height = videoStream?.height || 1080;

  return { duration, width, height };
}

/**
 * Cut a segment from a video and convert to vertical 9:16 format.
 * Uses execFile (no shell). Applies scale → pad → crop so sources
 * narrower than 1080 px or shorter than 1920 px are handled correctly.
 */
export async function processSegment(
  inputPath: string,
  outputPath: string,
  startTime: number,
  endTime: number,
  options: {
    width?: number;
    height?: number;
    smartFraming?: boolean;
  } = {},
): Promise<string> {
  const { width = 1080, height = 1920, smartFraming = true } = options;
  const duration = endTime - startTime;

  // Build the filter chain
  let videoFilter: string;

  if (smartFraming) {
    // Scale so the *smaller* dimension matches the target, then pad if
    // the source is too small on the other axis, then center-crop.
    videoFilter = [
      // Scale preserving aspect ratio so at least one axis matches
      `scale=w='if(gt(iw/ih,${width}/${height}),${height}*iw/ih,${width})':h='if(gt(iw/ih,${width}/${height}),${height},${width}*ih/iw)'`,
      // Pad to ensure minimum target dimensions (handles undersized sources)
      `pad=w='max(iw,${width})':h='max(ih,${height})':x=(ow-iw)/2:y=(oh-ih)/2:color=black`,
      // Center-crop to exact target
      `crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2`,
      "setsar=1",
    ].join(",");
  } else {
    videoFilter = [
      `scale=${width}:-2`,
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
      `crop=${width}:${height}`,
      "setsar=1",
    ].join(",");
  }

  await runFfmpeg(
    [
      "-y",
      "-ss",
      String(startTime),
      "-i",
      inputPath,
      "-t",
      String(duration),
      "-vf",
      videoFilter,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    600000, // 10 min
  );
  return outputPath;
}

/**
 * Burn subtitles into a video using FFmpeg.
 * Uses SRT file with styled subtitles optimized for mobile viewing.
 * All subtitles are static (no animations) for rendering reliability.
 * Optionally burns a watermark for free-tier users.
 */
export async function burnSubtitles(
  inputPath: string,
  srtContent: string,
  outputPath: string,
  style?: SubtitleStyle,
  options?: { addWatermark?: boolean },
): Promise<string> {
  // DEBUG: Log render step entry
  console.log("[burnSubtitles] Entry:", {
    inputPath,
    outputPath,
    srtContentLength: srtContent.length,
    srtEmpty: !srtContent.trim(),
    styleProvided: !!style,
    fontSize: style?.fontSize,
    addWatermark: options?.addWatermark,
  });

  // If no subtitle content, just copy the video without subtitle overlay
  if (!srtContent.trim()) {
    console.warn(
      "[burnSubtitles] SRT content is empty — copying video without subtitles!",
    );
    await runFfmpeg(["-y", "-i", inputPath, "-c", "copy", outputPath]);
    return outputPath;
  }

  // Defensive merge: filter out undefined/null values so they never override defaults
  const filteredStyle: Partial<SubtitleStyle> = {};
  if (style) {
    for (const [k, v] of Object.entries(style)) {
      if (v !== undefined && v !== null) {
        (filteredStyle as Record<string, unknown>)[k] = v;
      }
    }
  }
  const s = {
    ...DEFAULT_SUBTITLE_STYLE,
    ...filteredStyle,
  } as Required<SubtitleStyle>;

  // Shared path-escaping for ffmpeg filter-graph syntax
  function escapePath(p: string): string {
    return p
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/:/g, "\\:")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]");
  }

  const baseFilename = `subs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // ── Static path: SRT + force_style (no animations) ──
  console.log("[burnSubtitles] Using STATIC path (SRT + force_style)", {
    fontName: s.fontName,
    fontSize: s.fontSize,
    bold: s.bold,
    alignment: s.alignment,
    marginV: s.marginV,
  });
  const srtPath = join(dirname(inputPath), `${baseFilename}.srt`);
  await writeFile(srtPath, srtContent, "utf-8");

  // Verify SRT file was written
  const { stat } = await import("fs/promises");
  const srtStat = await stat(srtPath).catch(() => null);
  if (!srtStat) {
    throw new Error(`Failed to write subtitle file to ${srtPath}`);
  }

  // Scale fontSize and marginV from phone-screen-pixels → ASS coordinate pixels.
  // Stored settings use "phone screen pixels" (390px-wide reference);
  // ASS uses the video coordinate space (1080×1920).
  const assFontSize = Math.round(s.fontSize * PREVIEW_TO_ASS_SCALE);
  const assMarginV = Math.round(s.marginV * PREVIEW_TO_ASS_SCALE);

  console.log("[burnSubtitles] ASS coords:", {
    assFontSize,
    assMarginV,
    scale: PREVIEW_TO_ASS_SCALE,
  });

  // Build ASS force_style string from the SubtitleStyle
  const subtitleStyle = [
    `FontName=${s.fontName}`,
    `FontSize=${assFontSize}`,
    `PrimaryColour=${hexToAss(s.primaryColor)}`,
    `OutlineColour=${hexToAss(s.outlineColor)}`,
    "BackColour=&H80000000",
    `Bold=${s.bold ? 1 : 0}`,
    `Outline=${s.outline}`,
    `Shadow=${s.shadow}`,
    `MarginV=${assMarginV}`,
    `Alignment=${s.alignment}`,
  ].join(",");

  let vfFilter = `subtitles='${escapePath(srtPath)}':force_style='${subtitleStyle}'`;

  // ── Watermark overlay for free users ──
  if (options?.addWatermark) {
    const wm = WATERMARK_CONFIG;
    const wmAlignment = getWatermarkAlignment(s.alignment);
    // Scale watermark values the same way
    const wmFontSize = Math.round(wm.fontSize * PREVIEW_TO_ASS_SCALE);
    const wmMarginV = Math.round(wm.marginV * PREVIEW_TO_ASS_SCALE);
    // Use drawtext filter for the watermark
    const wmFilter = [
      `drawtext=text='${wm.text}'`,
      `fontsize=${wmFontSize}`,
      `fontcolor=white@${wm.opacity}`,
      `borderw=${wm.outline}`,
      `bordercolor=black@${wm.opacity}`,
      `x=(w-text_w)/2`,
      wmAlignment === 8 ? `y=${wmMarginV}` : `y=h-text_h-${wmMarginV}`,
    ].join(":");
    vfFilter = `${vfFilter},${wmFilter}`;
    console.log("[burnSubtitles] Watermark filter added:", wmFilter);
  }

  // DEBUG: Log the exact FFmpeg filter for subtitle debugging
  console.log("[burnSubtitles] FFmpeg vf filter:", vfFilter);

  try {
    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-vf",
      vfFilter,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "23",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
  } finally {
    await unlink(srtPath).catch(() => {});
  }

  return outputPath;
}

/**
 * Generate a thumbnail from a video at a specific timestamp.
 */
export async function generateThumbnail(
  videoPath: string,
  outputPath: string,
  timestamp: number = 1,
): Promise<string> {
  await runFfmpeg(
    [
      "-y",
      "-ss",
      String(timestamp),
      "-i",
      videoPath,
      "-vframes",
      "1",
      "-q:v",
      "2",
      outputPath,
    ],
    60000,
  );
  return outputPath;
}

/**
 * Ensure a temp directory exists for processing.
 */
export async function ensureTempDir(jobId: string): Promise<string> {
  const dir = join(tmpdir(), "clipmafia", jobId);
  await mkdir(dir, { recursive: true });
  return dir;
}
