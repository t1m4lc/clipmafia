import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";

const execFileAsync = promisify(execFile);

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
  animated?: boolean;
}

const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontName: "Arial",
  fontSize: 22,
  primaryColor: "#FFFFFF",
  outlineColor: "#000000",
  bold: true,
  outline: 2,
  shadow: 1,
  marginV: 60,
  alignment: 2,
  animated: false,
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

/** Convert SRT timestamp "HH:MM:SS,mmm" to ASS timestamp "H:MM:SS.cc" */
function srtTimeToAss(t: string): string {
  const m = t.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  if (!m || !m[1] || !m[2] || !m[3] || !m[4]) return "0:00:00.00";
  const cs = Math.round(parseInt(m[4]) / 10);
  return `${parseInt(m[1])}:${m[2]}:${m[3]}.${String(cs).padStart(2, "0")}`;
}

/**
 * Build a full ASS file with pop-in animation (fade + scale) from SRT content.
 * Used when subtitleSettings.animated === true.
 */
function buildAssFile(srtContent: string, s: Required<SubtitleStyle>): string {
  const primary = hexToAss(s.primaryColor);
  const outline = hexToAss(s.outlineColor);

  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1080",
    "PlayResY: 1920",
    "WrapStyle: 1",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,${s.fontName},${s.fontSize},${primary},&H000000FF,${outline},&H80000000,${s.bold ? -1 : 0},0,0,0,100,100,0,0,1,${s.outline},${s.shadow},${s.alignment},10,10,${s.marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ].join("\n");

  const dialogues: string[] = [];
  for (const block of srtContent.trim().split(/\n\n+/)) {
    const lines = block.trim().split("\n");
    if (lines.length < 3 || !lines[1]) continue;
    const match = lines[1].match(
      /(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/,
    );
    if (!match || !match[1] || !match[2]) continue;
    const text = lines
      .slice(2)
      .join(" ")
      .replace(/<[^>]+>/g, ""); // strip any HTML tags
    const start = srtTimeToAss(match[1]);
    const end = srtTimeToAss(match[2]);
    // \fad(180,0)  → fade in 180 ms, no fade out
    // \t(0,300,\fscx115\fscy115)\t(300,450,\fscx100\fscy100) → pop scale
    dialogues.push(
      `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\fad(180,0)\\t(0,300,\\fscx115\\fscy115)\\t(300,450,\\fscx100\\fscy100)}${text}`,
    );
  }

  return header + "\n" + dialogues.join("\n");
}

/**
 * Burn subtitles into a video using FFmpeg.
 * Uses SRT file with styled subtitles optimized for mobile viewing.
 * Accepts optional SubtitleStyle for user customization.
 */
export async function burnSubtitles(
  inputPath: string,
  srtContent: string,
  outputPath: string,
  style?: SubtitleStyle,
): Promise<string> {
  // If no subtitle content, just copy the video without subtitle overlay
  if (!srtContent.trim()) {
    await runFfmpeg(["-y", "-i", inputPath, "-c", "copy", outputPath]);
    return outputPath;
  }

  // Defensive merge: filter out undefined/null values so they never override defaults
  // (e.g. old localStorage settings that lack 'outline'/'shadow' keys)
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

  if (s.animated) {
    // ── Animated path: generate a proper ASS file with \fad + pop-scale ──
    // This is more reliable than embedding ASS override tags in SRT, and
    // avoids the "undefined in force_style" issue entirely.
    const assPath = join(dirname(inputPath), `${baseFilename}.ass`);
    await writeFile(assPath, buildAssFile(srtContent, s), "utf-8");
    try {
      await runFfmpeg([
        "-y",
        "-i",
        inputPath,
        "-vf",
        `ass='${escapePath(assPath)}'`,
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

  // ── Non-animated path: SRT + force_style ──
  const srtPath = join(dirname(inputPath), `${baseFilename}.srt`);
  await writeFile(srtPath, srtContent, "utf-8");

  // Verify SRT file was written
  const { stat } = await import("fs/promises");
  const srtStat = await stat(srtPath).catch(() => null);
  if (!srtStat) {
    throw new Error(`Failed to write subtitle file to ${srtPath}`);
  }

  // Build ASS force_style string from the SubtitleStyle
  const subtitleStyle = [
    `FontName=${s.fontName}`,
    `FontSize=${s.fontSize}`,
    `PrimaryColour=${hexToAss(s.primaryColor)}`,
    `OutlineColour=${hexToAss(s.outlineColor)}`,
    "BackColour=&H80000000",
    `Bold=${s.bold ? 1 : 0}`,
    `Outline=${s.outline}`,
    `Shadow=${s.shadow}`,
    `MarginV=${s.marginV}`,
    `Alignment=${s.alignment}`,
  ].join(",");

  const vfFilter = `subtitles='${escapePath(srtPath)}':force_style='${subtitleStyle}'`;

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
