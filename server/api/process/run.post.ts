import { join } from 'path'
import { unlink, readFile } from 'fs/promises'
import type { DurationOption } from '~/types/database'

/**
 * Main video processing pipeline.
 * This runs asynchronously in the background via the job queue.
 */
export async function processVideoJob(
  jobId: string,
  videoId: string,
  userId: string,
  durationOption: DurationOption,
): Promise<void> {
  const supabase = useSupabaseAdmin()

  try {
    // Mark job as started
    await updateJobStatus(jobId, 'extracting_audio', 5, {
      started_at: new Date().toISOString(),
    })

    // Get video info
    const { data: video } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()

    if (!video) throw new Error('Video not found')

    // Create temp directory for this job
    const tempDir = await ensureTempDir(jobId)

    // Download video from Supabase Storage
    const { data: videoFile } = await supabase.storage
      .from('videos')
      .download(video.storage_path)

    if (!videoFile) throw new Error('Failed to download video')

    const videoLocalPath = join(tempDir, 'input.mp4')
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer())
    const { writeFile: writeFileAsync } = await import('fs/promises')
    await writeFileAsync(videoLocalPath, videoBuffer)

    // =========================================
    // Step 1: Extract Audio
    // =========================================
    await updateJobStatus(jobId, 'extracting_audio', 10)

    const audioPath = join(tempDir, 'audio.mp3')
    await extractAudio(videoLocalPath, audioPath)

    // Get video metadata
    const metadata = await getVideoMetadata(videoLocalPath)

    // Upload audio to storage for Deepgram
    const audioBuffer = await readFile(audioPath)
    const audioStoragePath = `${userId}/${jobId}/audio.mp3`

    await supabase.storage
      .from('audio')
      .upload(audioStoragePath, audioBuffer, {
        contentType: 'audio/mpeg',
      })

    // Get a signed URL for Deepgram
    const { data: audioUrlData } = await supabase.storage
      .from('audio')
      .createSignedUrl(audioStoragePath, 3600)

    if (!audioUrlData?.signedUrl) throw new Error('Failed to get audio URL')

    // =========================================
    // Step 2: Transcribe with Deepgram
    // =========================================
    await updateJobStatus(jobId, 'transcribing', 25)

    const transcript = await transcribeAudio(audioUrlData.signedUrl)

    // Save transcript to job
    await updateJobStatus(jobId, 'transcribing', 35, {
      transcript: transcript,
    })

    // =========================================
    // Step 3: AI Segment Detection with Mistral
    // =========================================
    await updateJobStatus(jobId, 'detecting_segments', 40)

    const segments = await detectSegments(transcript, durationOption, metadata.duration)

    // Save segments to job
    await updateJobStatus(jobId, 'detecting_segments', 50, {
      segments: segments,
    })

    // =========================================
    // Step 4: Process Each Segment
    // =========================================
    await updateJobStatus(jobId, 'processing_video', 55)

    const totalSegments = segments.length
    for (let i = 0; i < totalSegments; i++) {
      const segment = segments[i]
      const segmentProgress = 55 + Math.round((i / totalSegments) * 20)

      await updateJobStatus(jobId, 'processing_video', segmentProgress)

      // Cut and convert to vertical
      const segmentPath = join(tempDir, `segment_${i}.mp4`)
      await processSegment(videoLocalPath, segmentPath, segment.start, segment.end, {
        width: 1080,
        height: 1920,
        smartFraming: true,
      })

      // =========================================
      // Step 5: Burn Subtitles
      // =========================================
      await updateJobStatus(jobId, 'burning_subtitles', 75 + Math.round((i / totalSegments) * 10))

      // Get subtitle segment from transcript
      const segmentWords = transcript.filter(
        w => w.start >= segment.start && w.end <= segment.end,
      )

      // Adjust timestamps relative to segment start
      const adjustedWords = segmentWords.map(w => ({
        ...w,
        start: w.start - segment.start,
        end: w.end - segment.start,
      }))

      const subtitleSegments = groupWordsIntoSegments(adjustedWords, 6)
      const srtContent = transcriptToSrt(subtitleSegments)

      const subtitledPath = join(tempDir, `short_${i}.mp4`)
      await burnSubtitles(segmentPath, srtContent, subtitledPath)

      // =========================================
      // Step 6: Upload Result
      // =========================================
      await updateJobStatus(jobId, 'uploading', 88 + Math.round((i / totalSegments) * 10))

      const shortBuffer = await readFile(subtitledPath)
      const shortStoragePath = `${userId}/${videoId}/short_${i}.mp4`

      await supabase.storage
        .from('shorts')
        .upload(shortStoragePath, shortBuffer, {
          contentType: 'video/mp4',
        })

      // Create short record in database
      await supabase.from('shorts').insert({
        job_id: jobId,
        video_id: videoId,
        user_id: userId,
        title: segment.title,
        storage_path: shortStoragePath,
        duration: segment.end - segment.start,
        start_time: segment.start,
        end_time: segment.end,
        score: segment.score,
        width: 1080,
        height: 1920,
        file_size: shortBuffer.length,
        has_subtitles: true,
      })

      // Clean up segment files
      await unlink(segmentPath).catch(() => {})
      await unlink(subtitledPath).catch(() => {})
    }

    // =========================================
    // Complete!
    // =========================================

    // Update video status
    await supabase
      .from('videos')
      .update({ status: 'completed', duration: metadata.duration, width: metadata.width, height: metadata.height })
      .eq('id', videoId)

    // Increment user's processed count
    const { data: profile } = await supabase
      .from('profiles')
      .select('videos_processed_this_month')
      .eq('id', userId)
      .single()

    if (profile) {
      await supabase
        .from('profiles')
        .update({
          videos_processed_this_month: profile.videos_processed_this_month + 1,
        })
        .eq('id', userId)
    }

    await updateJobStatus(jobId, 'completed', 100)

    // Clean up temp files
    const { rm } = await import('fs/promises')
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})

  } catch (error: any) {
    console.error(`Job ${jobId} failed:`, error)

    // Update job as failed
    await updateJobStatus(jobId, 'failed', 0, {
      error_message: error.message || 'Unknown error',
    })

    // Update video status
    await supabase
      .from('videos')
      .update({ status: 'failed' })
      .eq('id', videoId)
  }
}
