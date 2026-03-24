import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";

const execFileAsync = promisify(execFile);

import {
  DEFAULT_SUBTITLE_STYLE,
  WATERMARK_CONFIG,
  getWatermarkAlignment,
  RENDER,
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
 * Convert SRT time "HH:MM:SS,mmm" to ASS time "H:MM:SS.cc" (centiseconds).
 */
function srtTimeToAss(srtTime: string): string {
  const [hhmmss, ms] = srtTime.split(",");
  const [hh, mm, ss] = (hhmmss ?? "00:00:00").split(":");
  const cc = Math.round(parseInt(ms ?? "0") / 10);
  return `${parseInt(hh ?? "0")}:${(mm ?? "00").padStart(2, "0")}:${(ss ?? "00").padStart(2, "0")}.${String(cc).padStart(2, "0")}`;
}

/**
 * Convert SRT subtitle content to a full ASS file.
 *
 * PlayResX/PlayResY match the video dimensions (1080×1920).
 * All style values (fontSize, outline, marginV…) are already in video pixels
 * and are written directly — no scaling needed.
 */
function srtToAss(
  srtContent: string,
  s: Required<SubtitleStyle>,
  playResX: number,
  playResY: number,
): string {
  const bold = s.bold ? -1 : 0; // ASS: -1 = bold, 0 = normal
  const marginLR = 30; // horizontal padding in video pixels

  console.log("[srtToAss] Using values directly (video pixels):", {
    fontSize: s.fontSize,
    outline: s.outline,
    shadow: s.shadow,
    marginV: s.marginV,
    alignment: s.alignment,
    playResX,
    playResY,
  });

  let ass = "[Script Info]\n";
  ass += "ScriptType: v4.00+\n";
  ass += `PlayResX: ${playResX}\n`;
  ass += `PlayResY: ${playResY}\n`;
  ass += "WrapStyle: 0\n";
  ass += "ScaledBorderAndShadow: yes\n\n";

  ass += "[V4+ Styles]\n";
  ass +=
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n";
  ass += `Style: Default,${s.fontName},${s.fontSize},${hexToAss(s.primaryColor)},${hexToAss(s.primaryColor)},${hexToAss(s.outlineColor)},&H80000000,${bold},0,0,0,100,100,0,0,1,${s.outline},${s.shadow},${s.alignment},${marginLR},${marginLR},${s.marginV},1\n\n`;

  ass += "[Events]\n";
  ass +=
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";

  // Parse SRT cues and convert to ASS Dialogue lines
  const cues = srtContent.trim().split(/\n\n+/);
  for (const cue of cues) {
    const lines = cue.trim().split("\n");
    if (lines.length < 3) continue;
    const timing = lines[1]!;
    const m = timing.match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/,
    );
    if (!m) continue;
    const start = srtTimeToAss(m[1]!);
    const end = srtTimeToAss(m[2]!);
    const text = lines.slice(2).join("\\N"); // ASS multi-line separator
    ass += `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}\n`;
  }

  return ass;
}

/**
 * Burn subtitles into a video using FFmpeg.
 * Generates a proper ASS file (not SRT) with explicit PlayResX/PlayResY
 * to guarantee correct font-size rendering regardless of libass defaults.
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

  // Sanity clamp: if fontSize is unreasonably small (< 16 video pixels),
  // it's a stale value from the old phone-pixel system — use the default.
  if (s.fontSize < 16) {
    console.warn(
      `[burnSubtitles] fontSize=${s.fontSize} looks like a stale phone-pixel value. Using default (${DEFAULT_SUBTITLE_STYLE.fontSize}).`,
    );
    s.fontSize = DEFAULT_SUBTITLE_STYLE.fontSize as number;
  }

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

  // Convert SRT → proper ASS file with PlayResX=1080, PlayResY=1920.
  //
  // WHY ASS AND NOT SRT+force_style:
  //   libass defaults to PlayResY=288 for SRT files.  A force_style FontSize
  //   of 33 therefore renders at  33 × (1920÷288) ≈ 220 px — the root cause
  //   of subtitles being WAY too big regardless of any other scaling fix.
  //   With a real ASS file and PlayResY=1920, FontSize=27 renders as exactly
  //   27 px, perfectly matching the 12 px preview on an 844 px-tall phone screen.
  const assContent = srtToAss(srtContent, s, RENDER.width, RENDER.height);
  const assPath = join(dirname(inputPath), `${baseFilename}.ass`);
  await writeFile(assPath, assContent, "utf-8");

  // Verify ASS file was written
  const { stat } = await import("fs/promises");
  const assStat = await stat(assPath).catch(() => null);
  if (!assStat) {
    throw new Error(`Failed to write subtitle file to ${assPath}`);
  }

  // No force_style needed — all style info is embedded in the ASS [V4+ Styles] header
  let vfFilter = `subtitles='${escapePath(assPath)}'`;

  // ── Watermark overlay for free users ──
  if (options?.addWatermark) {
    const wm = WATERMARK_CONFIG;
    const wmAlignment = getWatermarkAlignment(s.alignment);
    // Watermark values are already in video pixels — use directly
    const wmFontSize = wm.fontSize;
    const wmMarginV = wm.marginV;
    // Use drawtext filter for the watermark
    const wmFilter = [
      `drawtext=text='${wm.text}'`,
      `fontsize=${wmFontSize}`,
      `fontcolor=${wm.color}@${wm.opacity}`,
      `borderw=${wm.outline}`,
      `bordercolor=${wm.outlineColor}@${wm.opacity}`,
      `shadowx=2`,
      `shadowy=2`,
      `shadowcolor=black@0.6`,
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
    await unlink(assPath).catch(() => {});
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
