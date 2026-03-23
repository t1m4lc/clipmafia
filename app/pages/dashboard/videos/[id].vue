<script setup lang="ts">
import type { DurationOption } from '~/types/database'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
})

const route = useRoute()
const videoId = route.params.id as string

const {
  currentVideo,
  currentJob,
  shorts,
  loading,
  fetchVideo,
  fetchJob,
  generateShorts,
  fetchShorts,
  pollJobStatus,
  getDownloadUrl,
} = useVideos()

const { canProcessVideo } = useProfile()

const selectedDuration = ref<DurationOption>(60)
const generating = ref(false)
const errorMessage = ref('')

const durationOptions: { label: string; value: DurationOption }[] = [
  { label: '15 seconds', value: 15 },
  { label: '30 seconds', value: 30 },
  { label: '60 seconds', value: 60 },
]

onMounted(async () => {
  await fetchVideo(videoId)
  await fetchJob(videoId)
  await fetchShorts(videoId)

  // If already processing, start polling
  if (currentJob.value && !['completed', 'failed'].includes(currentJob.value.status)) {
    generating.value = true
    pollJobStatus(videoId)
  }
})

// Watch for job status changes
watch(
  () => currentJob.value?.status,
  (status) => {
    if (status === 'completed' || status === 'failed') {
      generating.value = false
    }
  },
)

async function handleGenerate() {
  if (!canProcessVideo()) {
    errorMessage.value = 'Monthly video limit reached. Please upgrade your plan.'
    return
  }

  generating.value = true
  errorMessage.value = ''

  try {
    await generateShorts(videoId, selectedDuration.value)
    // Start polling for updates
    pollJobStatus(videoId, 2000)
  } catch (e: any) {
    errorMessage.value = e.message || 'Failed to start processing'
    generating.value = false
  }
}

async function handleDownload(storagePath: string, title: string) {
  const url = await getDownloadUrl(storagePath)
  if (url) {
    const a = document.createElement('a')
    a.href = url
    a.download = `${title}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}

function getJobStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    queued: '⏳ In queue...',
    extracting_audio: '🎵 Extracting audio...',
    transcribing: '📝 Transcribing speech...',
    detecting_segments: '🤖 AI detecting best moments...',
    processing_video: '🎬 Creating vertical shorts...',
    burning_subtitles: '✏️ Adding subtitles...',
    uploading: '📤 Uploading results...',
    completed: '✅ Complete!',
    failed: '❌ Failed',
  }
  return labels[status] || status
}

function getProgressForStatus(status: string): number {
  const progressMap: Record<string, number> = {
    queued: 5,
    extracting_audio: 15,
    transcribing: 30,
    detecting_segments: 50,
    processing_video: 70,
    burning_subtitles: 85,
    uploading: 95,
    completed: 100,
    failed: 0,
  }
  return progressMap[status] || 0
}
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-8">
    <!-- Back button -->
    <NuxtLink to="/dashboard" class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
      ← Back to Dashboard
    </NuxtLink>

    <div v-if="loading && !currentVideo" class="text-center py-12 text-muted-foreground">
      Loading video...
    </div>

    <template v-else-if="currentVideo">
      <!-- Video Info -->
      <div class="flex flex-col sm:flex-row gap-6">
        <div class="aspect-video w-full sm:w-80 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <span class="text-4xl">🎬</span>
        </div>
        <div class="space-y-3">
          <h1 class="text-2xl font-bold">{{ currentVideo.title }}</h1>
          <div class="flex flex-wrap gap-2">
            <Badge :variant="currentVideo.status === 'completed' ? 'success' : 'secondary'">
              {{ currentVideo.status }}
            </Badge>
            <span class="text-sm text-muted-foreground">
              Uploaded {{ new Date(currentVideo.created_at).toLocaleDateString() }}
            </span>
          </div>
          <p class="text-sm text-muted-foreground">{{ currentVideo.original_filename }}</p>
        </div>
      </div>

      <!-- Generate Section (show when no job or failed) -->
      <Card v-if="!currentJob || currentJob.status === 'failed'">
        <CardHeader>
          <CardTitle>Generate Shorts</CardTitle>
          <CardDescription>
            Select a duration and our AI will find the best moments from your video.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Duration Selector -->
          <div class="space-y-3">
            <label class="text-sm font-medium">Target Duration</label>
            <div class="flex gap-3">
              <button
                v-for="option in durationOptions"
                :key="option.value"
                class="flex-1 rounded-lg border-2 p-4 text-center transition-colors cursor-pointer"
                :class="selectedDuration === option.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'"
                @click="selectedDuration = option.value"
              >
                <div class="text-lg font-bold">{{ option.value }}s</div>
                <div class="text-xs text-muted-foreground">{{ option.label }}</div>
              </button>
            </div>
          </div>

          <!-- Error from previous attempt -->
          <div v-if="currentJob?.status === 'failed'" class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            Previous attempt failed: {{ currentJob.error_message || 'Unknown error' }}
          </div>

          <div v-if="errorMessage" class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {{ errorMessage }}
          </div>

          <Button size="lg" class="w-full" @click="handleGenerate" :disabled="generating">
            🚀 Generate Shorts
          </Button>
        </CardContent>
      </Card>

      <!-- Processing Status -->
      <Card v-if="currentJob && !['completed', 'failed'].includes(currentJob.status)">
        <CardHeader>
          <CardTitle>Processing Your Video</CardTitle>
          <CardDescription>This may take a few minutes depending on video length.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="text-center space-y-3">
            <div class="text-4xl animate-pulse">
              {{ currentJob.status === 'transcribing' ? '📝' : currentJob.status === 'detecting_segments' ? '🤖' : '🎬' }}
            </div>
            <p class="font-medium">{{ getJobStatusLabel(currentJob.status) }}</p>
            <Progress :model-value="getProgressForStatus(currentJob.status)" class="max-w-md mx-auto" />
            <p class="text-sm text-muted-foreground">
              {{ getProgressForStatus(currentJob.status) }}% complete
            </p>
          </div>
        </CardContent>
      </Card>

      <!-- Generated Shorts -->
      <div v-if="shorts.length > 0">
        <h2 class="text-xl font-semibold mb-4">Generated Shorts ({{ shorts.length }})</h2>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card v-for="short in shorts" :key="short.id">
            <CardContent class="pt-6 space-y-3">
              <!-- Video Preview -->
              <div class="relative aspect-[9/16] rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                <span class="text-3xl">📱</span>
                <div v-if="short.score" class="absolute top-2 right-2">
                  <Badge variant="secondary" class="text-xs">
                    {{ Math.round(short.score * 100) }}% match
                  </Badge>
                </div>
              </div>

              <!-- Info -->
              <div class="space-y-1">
                <h3 class="font-medium text-sm leading-tight">{{ short.title }}</h3>
                <p class="text-xs text-muted-foreground">
                  {{ short.duration?.toFixed(1) }}s •
                  {{ short.width }}x{{ short.height }}
                </p>
              </div>

              <!-- Download Button -->
              <Button
                class="w-full"
                size="sm"
                @click="handleDownload(short.storage_path, short.title)"
              >
                ⬇️ Download
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </template>
  </div>
</template>
