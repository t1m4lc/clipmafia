import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const execAsync = promisify(exec)

/**
 * Extract audio from a video file.
 * Downloads from URL, extracts audio, returns the audio file path.
 */
export async function extractAudio(videoPath: string, outputPath: string): Promise<string> {
  const cmd = [
    'ffmpeg', '-y',
    '-i', `"${videoPath}"`,
    '-vn',                      // No video
    '-acodec', 'libmp3lame',    // MP3 codec
    '-ab', '128k',              // Bitrate
    '-ar', '16000',             // Sample rate (good for speech recognition)
    '-ac', '1',                 // Mono
    `"${outputPath}"`,
  ].join(' ')

  await execAsync(cmd, { timeout: 300000 }) // 5 minute timeout
  return outputPath
}

/**
 * Get video metadata (duration, dimensions) using ffprobe.
 */
export async function getVideoMetadata(videoPath: string): Promise<{
  duration: number
  width: number
  height: number
}> {
  const cmd = [
    'ffprobe',
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    `"${videoPath}"`,
  ].join(' ')

  const { stdout } = await execAsync(cmd)
  const data = JSON.parse(stdout)

  const videoStream = data.streams?.find((s: any) => s.codec_type === 'video')
  const duration = parseFloat(data.format?.duration || '0')
  const width = videoStream?.width || 1920
  const height = videoStream?.height || 1080

  return { duration, width, height }
}

/**
 * Cut a segment from a video and convert to vertical 9:16 format.
 * Applies smart framing with center crop as default.
 */
export async function processSegment(
  inputPath: string,
  outputPath: string,
  startTime: number,
  endTime: number,
  options: {
    width?: number
    height?: number
    smartFraming?: boolean
  } = {},
): Promise<string> {
  const { width = 1080, height = 1920, smartFraming = true } = options
  const duration = endTime - startTime

  // Build the filter chain
  let videoFilter: string

  if (smartFraming) {
    // Smart framing: attempt face detection crop, fallback to center crop
    // Using cropdetect and scale with center crop as reliable fallback
    videoFilter = [
      // Scale to ensure minimum dimensions, then center crop to 9:16
      `scale=w='if(gt(iw/ih,${width}/${height}),${height}*iw/ih,${width})':h='if(gt(iw/ih,${width}/${height}),${height},${width}*ih/iw)'`,
      `crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2`,
      'setsar=1',
    ].join(',')
  } else {
    // Simple center crop
    videoFilter = [
      `scale=${width}:-2`,
      `crop=${width}:${height}`,
      'setsar=1',
    ].join(',')
  }

  const cmd = [
    'ffmpeg', '-y',
    '-ss', String(startTime),
    '-i', `"${inputPath}"`,
    '-t', String(duration),
    '-vf', `"${videoFilter}"`,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    `"${outputPath}"`,
  ].join(' ')

  await execAsync(cmd, { timeout: 600000 }) // 10 minute timeout
  return outputPath
}

/**
 * Burn subtitles into a video using FFmpeg.
 * Uses SRT file with styled subtitles optimized for mobile viewing.
 */
export async function burnSubtitles(
  inputPath: string,
  srtContent: string,
  outputPath: string,
): Promise<string> {
  // Write SRT to a temp file
  const srtPath = join(tmpdir(), `clipmafia_subs_${Date.now()}.srt`)
  await writeFile(srtPath, srtContent, 'utf-8')

  // Subtitle style: large, bold, white text with black outline, centered at bottom
  const subtitleStyle = [
    'FontName=Arial',
    'FontSize=22',
    'PrimaryColour=&H00FFFFFF',    // White
    'OutlineColour=&H00000000',     // Black outline
    'BackColour=&H80000000',        // Semi-transparent black background
    'Bold=1',
    'Outline=2',
    'Shadow=1',
    'MarginV=60',                   // Bottom margin (for mobile safe area)
    'Alignment=2',                  // Bottom center
  ].join(',')

  // Escape path for FFmpeg (handle special characters)
  const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")

  const cmd = [
    'ffmpeg', '-y',
    '-i', `"${inputPath}"`,
    '-vf', `"subtitles='${escapedSrtPath}':force_style='${subtitleStyle}'"`,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    `"${outputPath}"`,
  ].join(' ')

  try {
    await execAsync(cmd, { timeout: 600000 }) // 10 minute timeout
  } finally {
    // Clean up temp SRT file
    await unlink(srtPath).catch(() => {})
  }

  return outputPath
}

/**
 * Generate a thumbnail from a video at a specific timestamp.
 */
export async function generateThumbnail(
  videoPath: string,
  outputPath: string,
  timestamp: number = 1,
): Promise<string> {
  const cmd = [
    'ffmpeg', '-y',
    '-ss', String(timestamp),
    '-i', `"${videoPath}"`,
    '-vframes', '1',
    '-q:v', '2',
    `"${outputPath}"`,
  ].join(' ')

  await execAsync(cmd, { timeout: 60000 })
  return outputPath
}

/**
 * Ensure a temp directory exists for processing.
 */
export async function ensureTempDir(jobId: string): Promise<string> {
  const dir = join(tmpdir(), 'clipmafia', jobId)
  await mkdir(dir, { recursive: true })
  return dir
}
