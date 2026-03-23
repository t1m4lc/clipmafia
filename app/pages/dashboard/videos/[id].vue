<script setup lang="ts">
import type { DurationOption, SubtitleSettings, Segment } from '~/types/database'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
})

const route = useRoute()
const videoId = route.params.id as string
const config = useRuntimeConfig()
const isDevMode = Boolean(config.public.devMode)

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
  deleteVideo,
  hasTranscript,
  downloadTranscriptSrt,
  downloadTranscriptVtt,
  downloadTranscriptJson,
  downloadSegmentsJson,
} = useVideos()

const router = useRouter()
const deleting = ref(false)
const showDeleteDialog = ref(false)

async function handleDelete() {
  if (!currentVideo.value) return
  deleting.value = true
  try {
    await deleteVideo(currentVideo.value.id)
    router.push('/dashboard')
  } catch (e: any) {
    errorMessage.value = e.message || 'Failed to delete video'
    deleting.value = false
    showDeleteDialog.value = false
  }
}

const { canProcessVideo } = useProfile()

const selectedDuration = ref<DurationOption>(15)
const generating = ref(false)
const errorMessage = ref('')
const showSubtitleSettings = ref(false)

// Default subtitle settings
const subtitleSettings = ref<SubtitleSettings>({
  fontName: 'Arial',
  fontSize: 22,
  primaryColor: '#FFFFFF',
  outlineColor: '#000000',
  bold: true,
  outline: 2,
  shadow: 1,
  marginV: 60,
  alignment: 2,
  animated: false,
})

// Dev mode: selected segments from the review panel
const devSelectedSegments = ref<Segment[]>([])

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
      if (status === 'completed') {
        fetchShorts(videoId)
      }
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
    await generateShorts(videoId, selectedDuration.value, subtitleSettings.value)
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

// Use real progress from job when available, fallback to estimate
const jobProgress = computed(() => {
  if (!currentJob.value) return 0
  if (currentJob.value.progress > 0) return currentJob.value.progress
  const progressMap: Record<string, number> = {
    queued: 5, extracting_audio: 15, transcribing: 30,
    detecting_segments: 50, processing_video: 70,
    burning_subtitles: 85, uploading: 95, completed: 100, failed: 0,
  }
  return progressMap[currentJob.value.status] || 0
})

const jobSteps = computed(() => {
  return (currentJob.value as any)?.steps || null
})

const hasSegments = computed(() => {
  return !!(currentJob.value?.segments && Array.isArray(currentJob.value.segments) && currentJob.value.segments.length > 0)
})

const showSegmentReview = computed(() => {
  return isDevMode && hasSegments.value
})
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
        <div class="flex-1 space-y-3">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <h1 class="text-2xl font-bold">{{ currentVideo.title }}</h1>
            <Button
              variant="ghost"
              size="sm"
              class="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
              @click="showDeleteDialog = true"
            >
              🗑 Delete
            </Button>
          </div>
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

      <!-- Delete Confirmation Dialog -->
      <Dialog :open="showDeleteDialog" @update:open="showDeleteDialog = $event">
        <div class="space-y-4">
          <div class="space-y-2">
            <h2 class="text-lg font-semibold">Delete Video?</h2>
            <p class="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{{ currentVideo.title }}</strong>?
              This will permanently remove the video and all its generated shorts.
              This action cannot be undone.
            </p>
          </div>
          <div class="flex justify-end gap-3">
            <Button variant="ghost" :disabled="deleting" @click="showDeleteDialog = false">
              Cancel
            </Button>
            <Button variant="destructive" :disabled="deleting" @click="handleDelete">
              {{ deleting ? 'Deleting…' : '🗑 Yes, Delete' }}
            </Button>
          </div>
        </div>
      </Dialog>

      <!-- Transcript / Subtitles Download -->
      <Card v-if="hasTranscript()">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            📝 Subtitles & Transcript
            <Badge variant="success" class="text-xs">Available</Badge>
          </CardTitle>
          <CardDescription>
            Subtitles have been extracted from this video. Download them in various formats.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" @click="downloadTranscriptSrt()">
              ⬇️ Download .SRT
            </Button>
            <Button variant="outline" size="sm" @click="downloadTranscriptVtt()">
              ⬇️ Download .VTT
            </Button>
            <Button variant="outline" size="sm" @click="downloadTranscriptJson()">
              📄 Download .JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Dev Mode: Segment Review -->
      <SegmentReview
        v-if="showSegmentReview"
        :segments="(currentJob!.segments as any)"
        :video-title="currentVideo.title"
        @select-segments="devSelectedSegments = $event"
      />

      <!-- Generate Section (show when no job or failed) -->
      <Card v-if="!currentJob || currentJob.status === 'failed'">
        <CardHeader>
          <CardTitle>Generate Shorts</CardTitle>
          <CardDescription>
            Select a duration and customize subtitle style, then let AI find the best moments.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Duration Selector -->
          <div class="space-y-3">
            <div class="text-sm font-medium">Target Duration</div>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="option in durationOptions"
                :key="option.value"
                class="rounded-lg border-2 p-3 text-center transition-colors cursor-pointer"
                :class="selectedDuration === option.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'"
                @click="selectedDuration = option.value"
              >
                <div class="text-base sm:text-lg font-bold">{{ option.value }}s</div>
                <div class="hidden sm:block text-xs text-muted-foreground">{{ option.label }}</div>
              </button>
            </div>
          </div>

          <!-- Subtitle Settings Toggle -->
          <div>
            <button
              class="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 cursor-pointer"
              @click="showSubtitleSettings = !showSubtitleSettings"
            >
              <span class="transition-transform" :class="showSubtitleSettings ? 'rotate-90' : ''">▶</span>
              🎨 Customize Subtitle Style
            </button>

            <div v-if="showSubtitleSettings" class="mt-4 rounded-lg border p-4">
              <SubtitleSettings v-model="subtitleSettings" />
            </div>
          </div>

          <!-- Error from previous attempt -->
          <div v-if="currentJob?.status === 'failed'" class="space-y-3">
            <div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive space-y-1">
              <p class="font-medium">
                Previous attempt failed{{ currentJob.failed_at_step ? ` at step: ${getJobStatusLabel(currentJob.failed_at_step)}` : '' }}
              </p>
              <p>{{ currentJob.error_message || 'Unknown error' }}</p>
            </div>

            <!-- Step breakdown of previous attempt -->
            <JobStepList
              :steps="jobSteps"
              :current-status="currentJob.status"
              :failed-at-step="currentJob.failed_at_step"
              :error-message="currentJob.error_message"
              :has-transcript="hasTranscript()"
              :has-segments="hasSegments"
              @download-transcript="downloadTranscriptJson()"
              @download-subtitles-srt="downloadTranscriptSrt()"
              @download-subtitles-vtt="downloadTranscriptVtt()"
              @download-segments="downloadSegmentsJson()"
            />

            <div v-if="hasTranscript()" class="text-xs text-muted-foreground">
              ✅ Text extraction is cached — it won't be redone on retry.
            </div>
            <div v-if="hasSegments" class="text-xs text-muted-foreground">
              ✅ Segment detection is cached — it won't be redone on retry.
            </div>
          </div>

          <div v-if="errorMessage" class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {{ errorMessage }}
          </div>

          <Button size="lg" class="w-full" @click="handleGenerate" :disabled="generating">
            🚀 Generate Shorts
          </Button>
        </CardContent>
      </Card>

      <!-- Processing Status — Step-by-Step -->
      <Card v-if="currentJob && !['completed', 'failed'].includes(currentJob.status)">
        <CardHeader>
          <CardTitle>Processing Your Video</CardTitle>
          <CardDescription>This may take a few minutes depending on video length.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- Overall progress -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium">{{ getJobStatusLabel(currentJob.status) }}</span>
              <span class="text-muted-foreground">{{ jobProgress }}%</span>
            </div>
            <Progress :model-value="jobProgress" class="w-full" />
          </div>

          <!-- Step-by-step breakdown -->
          <JobStepList
            :steps="jobSteps"
            :current-status="currentJob.status"
            :has-transcript="hasTranscript()"
            :has-segments="hasSegments"
            @download-transcript="downloadTranscriptJson()"
            @download-subtitles-srt="downloadTranscriptSrt()"
            @download-subtitles-vtt="downloadTranscriptVtt()"
            @download-segments="downloadSegmentsJson()"
          />
        </CardContent>
      </Card>

      <!-- Generated Shorts -->
      <div v-if="shorts.length > 0">
        <h2 class="text-xl font-semibold mb-4">Generated Shorts ({{ shorts.length }})</h2>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card v-for="short in shorts" :key="short.id">
            <CardContent class="pt-6 space-y-3">
              <div class="relative aspect-[9/16] rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                <span class="text-3xl">📱</span>
                <div v-if="short.score" class="absolute top-2 right-2">
                  <Badge variant="secondary" class="text-xs">
                    {{ Math.round(short.score * 100) }}% match
                  </Badge>
                </div>
              </div>
              <div class="space-y-1">
                <h3 class="font-medium text-sm leading-tight">{{ short.title }}</h3>
                <p class="text-xs text-muted-foreground">
                  {{ short.duration?.toFixed(1) }}s •
                  {{ short.width }}x{{ short.height }}
                </p>
              </div>
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