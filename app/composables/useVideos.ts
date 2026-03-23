import type { Database } from '~/types/database'

type Video = Database['public']['Tables']['videos']['Row']
type Job = Database['public']['Tables']['jobs']['Row']
type Short = Database['public']['Tables']['shorts']['Row']

/**
 * Composable for video management and job tracking.
 */
export function useVideos() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()

  const videos = ref<Video[]>([])
  const currentVideo = ref<Video | null>(null)
  const currentJob = ref<Job | null>(null)
  const shorts = ref<Short[]>([])
  const loading = ref(false)

  /**
   * Fetch all videos for the current user.
   */
  async function fetchVideos() {
    if (!user.value) return

    loading.value = true
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.value.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      videos.value = data || []
    } catch (e) {
      console.error('Failed to fetch videos:', e)
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch a single video by ID.
   */
  async function fetchVideo(videoId: string) {
    if (!user.value) return null

    loading.value = true
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .eq('user_id', user.value.id)
        .single()

      if (error) throw error
      currentVideo.value = data
      return data
    } catch (e) {
      console.error('Failed to fetch video:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Upload a video file to Supabase Storage.
   */
  async function uploadVideo(file: File) {
    if (!user.value) throw new Error('Not authenticated')

    const fileExt = file.name.split('.').pop()
    const fileName = `${user.value.id}/${Date.now()}.${fileExt}`

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) throw uploadError

    // Create video record in database
    const { data, error: dbError } = await supabase
      .from('videos')
      .insert({
        user_id: user.value.id,
        title: file.name.replace(/\.[^/.]+$/, ''),
        original_filename: file.name,
        storage_path: fileName,
        file_size: file.size,
        mime_type: file.type,
        status: 'uploaded',
      })
      .select()
      .single()

    if (dbError) throw dbError
    return data
  }

  /**
   * Start processing a video — creates a job and triggers the pipeline.
   */
  async function generateShorts(videoId: string, durationOption: 15 | 30 | 60) {
    const response = await $fetch('/api/process/start', {
      method: 'POST',
      body: {
        videoId,
        durationOption,
      },
    })
    return response
  }

  /**
   * Fetch job status for a video.
   */
  async function fetchJob(videoId: string) {
    if (!user.value) return null

    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('video_id', videoId)
      .eq('user_id', user.value.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) return null
    currentJob.value = data
    return data
  }

  /**
   * Poll job status until completion.
   */
  function pollJobStatus(videoId: string, interval: number = 3000) {
    const polling = ref(true)

    const poll = async () => {
      while (polling.value) {
        const job = await fetchJob(videoId)
        if (job && (job.status === 'completed' || job.status === 'failed')) {
          polling.value = false
          if (job.status === 'completed') {
            await fetchShorts(videoId)
          }
          break
        }
        await new Promise(resolve => setTimeout(resolve, interval))
      }
    }

    poll()

    return {
      stop: () => { polling.value = false },
      polling,
    }
  }

  /**
   * Fetch generated shorts for a video.
   */
  async function fetchShorts(videoId: string) {
    if (!user.value) return

    const { data, error } = await supabase
      .from('shorts')
      .select('*')
      .eq('video_id', videoId)
      .eq('user_id', user.value.id)
      .order('score', { ascending: false })

    if (error) {
      console.error('Failed to fetch shorts:', error)
      return
    }
    shorts.value = data || []
  }

  /**
   * Get a download URL for a short video.
   */
  async function getDownloadUrl(storagePath: string): Promise<string> {
    const { data } = await supabase.storage
      .from('shorts')
      .createSignedUrl(storagePath, 3600) // 1 hour expiry

    return data?.signedUrl || ''
  }

  return {
    videos,
    currentVideo,
    currentJob,
    shorts,
    loading,
    fetchVideos,
    fetchVideo,
    uploadVideo,
    generateShorts,
    fetchJob,
    pollJobStatus,
    fetchShorts,
    getDownloadUrl,
  }
}
