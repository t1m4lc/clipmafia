<script setup lang="ts">
import { Check, MoreVertical, Play, Download, Trash2, ArrowDownUp, Settings } from 'lucide-vue-next'

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
  getOriginalVideoUrl,
  deleteVideo,
  deleteShort,
  hasTranscript,
  downloadTranscriptSrt,
  downloadTranscriptVtt,
  downloadTranscriptJson,
  downloadSegmentsJson,
} = useVideos()

const { settings: subtitleSettings } = useSubtitleSettings()
const { showUpgradeDialog, limitPayload, handleLimitError } = useUsageLimits()

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

const generating = ref(false)
const errorMessage = ref('')
const batchDownloading = ref(false)
const sortMode = ref<'score' | 'chronological'>('score')
const thumbnailUrls = ref<Record<string, string>>({})

const devSelectedSegments = ref<Segment[]>([])

const previewUrl = ref('')
const previewTitle = ref('')
const showPreview = ref(false)
const activeMenuShortId = ref<string | null>(null)

// Original video player state
const showOriginalPlayer = ref(false)
const originalVideoUrl = ref('')
const loadingOriginalVideo = ref(false)

async function playOriginalVideo() {
  if (!currentVideo.value) return
  loadingOriginalVideo.value = true
  try {
    const url = await getOriginalVideoUrl(currentVideo.value.id)
    if (url) {
      originalVideoUrl.value = url
      showOriginalPlayer.value = true
    }
  } catch (e: any) {
    errorMessage.value = 'Failed to load original video'
  } finally {
    loadingOriginalVideo.value = false
  }
}

function toggleMenu(shortId: string) {
  activeMenuShortId.value = activeMenuShortId.value === shortId ? null : shortId
}

function closeMenus() {
  activeMenuShortId.value = null
}

async function preloadThumbnails() {
  if (!shorts.value.length) return
  // Parallel fetch of thumbnail URLs for shorts that have a thumbnail_path
  await Promise.all(
    shorts.value
      .filter(s => s.thumbnail_path)
      .map(async (s) => {
        try {
          const data = await $fetch(`/api/shorts/${s.id}`) as any
          if (data?.thumbnailUrl) {
            thumbnailUrls.value = { ...thumbnailUrls.value, [s.id]: data.thumbnailUrl }
          }
        } catch { /* ignore */ }
      }),
  )
}

onMounted(async () => {
  await fetchVideo(videoId)
  await fetchJob(videoId)
  await fetchShorts(videoId, sortMode.value)

  await preloadThumbnails()

  if (currentJob.value && !['completed', 'failed'].includes(currentJob.value.status)) {
    generating.value = true
    pollJobStatus(videoId)
  }

  document.addEventListener('click', closeMenus)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenus)
})

watch(
  () => currentJob.value?.status,
  async (status) => {
    if (status === 'completed' || status === 'failed') {
      generating.value = false
      if (status === 'completed') {
        await fetchShorts(videoId, sortMode.value)
        await preloadThumbnails()
      }
    }
  },
)

watch(sortMode, (mode) => {
  fetchShorts(videoId, mode)
})

async function confirmGenerate() {
  generating.value = true
  errorMessage.value = ''
  try {
    await generateShorts(videoId, subtitleSettings.value)
    pollJobStatus(videoId, 2000)
  } catch (e: any) {
    // Let the composable check for LIMIT_REACHED — opens the upgrade dialog
    if (!handleLimitError(e)) {
      errorMessage.value = e?.data?.message || e.message || 'Failed to start processing'
    }
    generating.value = false
  }
}

async function downloadAsBlob(url: string, filename: string) {
  // Must fetch as blob — browsers block <a download> for cross-origin URLs (Supabase signed URLs)
  const response = await fetch(url)
  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
}

async function handleDownload(shortId: string, title: string) {
  try {
    const url = await getDownloadUrl(shortId)
    if (!url) return
    await downloadAsBlob(url, title + '.mp4')
  } catch (e: any) {
    errorMessage.value = 'Download failed: ' + (e.message || 'Unknown error')
  }
}

async function handleBatchDownload() {
  if (shorts.value.length === 0) return
  batchDownloading.value = true
  errorMessage.value = ''
  try {
    const { zipSync } = await import('fflate')
    const videoTitle = currentVideo.value?.title || 'shorts'
    const files: Record<string, Uint8Array> = {}

    for (const short of shorts.value) {
      const url = await getDownloadUrl(short.id)
      if (!url) continue
      const response = await fetch(url)
      const buffer = await response.arrayBuffer()
      // Sanitize filename — remove characters not safe in ZIP/OS paths
      const safeName = short.title.replace(/[/\\?%*:|"<>]/g, '-') + '.mp4'
      files[safeName] = new Uint8Array(buffer)
    }

    if (Object.keys(files).length === 0) {
      errorMessage.value = 'No shorts available to download'
      return
    }

    // level: 0 = store only (no compression — videos are already compressed)
    const zipped = zipSync(files, { level: 0 })
    const blob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' })
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `${videoTitle}_shorts.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)
  } catch (e: any) {
    errorMessage.value = 'Batch download failed: ' + (e.message || 'Unknown error')
  } finally {
    batchDownloading.value = false
  }
}

async function handlePlayShort(shortId: string, title: string) {
  const url = await getDownloadUrl(shortId)
  if (url) {
    previewUrl.value = url
    previewTitle.value = title
    showPreview.value = true
  }
}

async function handleDeleteShort(shortId: string) {
  if (!confirm('Delete this short?')) return
  try {
    await deleteShort(shortId)
  } catch (e: any) {
    errorMessage.value = e.message || 'Failed to delete short'
  }
}

function getJobStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    queued: 'In queue...',
    extracting_audio: 'Extracting audio...',
    transcribing: 'Transcribing speech...',
    detecting_segments: 'AI detecting best moments...',
    processing_video: 'Creating vertical shorts...',
    burning_subtitles: 'Adding subtitles...',
    uploading: 'Uploading results...',
    completed: 'Complete!',
    failed: 'Failed',
  }
  return labels[status] || status
}

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

const jobSteps = computed(() => (currentJob.value as any)?.steps || null)

const hasSegments = computed(() => {
  return !!(currentJob.value?.segments && Array.isArray(currentJob.value.segments) && currentJob.value.segments.length > 0)
})

const showSegmentReview = computed(() => isDevMode && hasSegments.value)

interface StepDef {
  step: number
  key: string
  title: string
  description: string
}

const stepDefinitions: StepDef[] = [
  { step: 1, key: 'extracting_audio', title: 'Extract Audio', description: 'Extracting audio track' },
  { step: 2, key: 'transcribing', title: 'Transcribe', description: 'Speech-to-text via Deepgram' },
  { step: 3, key: 'detecting_segments', title: 'Detect Segments', description: 'AI finding best moments' },
  { step: 4, key: 'processing_video', title: 'Create Shorts', description: 'Cropping, subtitles & upload' },
]

// Backend statuses that map to the single display step 'processing_video'
const CREATING_STEPS = ['processing_video', 'burning_subtitles', 'uploading']

function toDisplayKey(status: string): string {
  return CREATING_STEPS.includes(status) ? 'processing_video' : status
}

function getStepState(stepKey: string): 'completed' | 'active' | 'inactive' | 'error' {
  // Sub-keys covered by this display step
  const subKeys = stepKey === 'processing_video' ? CREATING_STEPS : [stepKey]

  const steps = jobSteps.value
  if (steps) {
    const relevant = subKeys.map(k => steps[k]).filter(Boolean)
    if (relevant.some(s => s === 'error'))   return 'error'
    if (relevant.some(s => s === 'loading')) return 'active'
    if (relevant.length && relevant.every(s => s === 'done')) return 'completed'
  }

  if (!currentJob.value) return 'inactive'
  const status = currentJob.value.status
  const displayStatus = toDisplayKey(status)
  const stepOrder = stepDefinitions.map(s => s.key)
  const currentIdx = stepOrder.indexOf(displayStatus)
  const stepIdx   = stepOrder.indexOf(stepKey)

  if (status === 'completed') return 'completed'
  if (status === 'failed') {
    const failedDisplay = toDisplayKey(currentJob.value.failed_at_step || '')
    if (failedDisplay === stepKey) return 'error'
    if (stepIdx < stepOrder.indexOf(failedDisplay)) return 'completed'
    return 'inactive'
  }
  if (stepIdx < currentIdx)  return 'completed'
  if (stepIdx === currentIdx) return 'active'
  return 'inactive'
}

const currentStepNumber = computed(() => {
  if (!currentJob.value) return 1
  const status = currentJob.value.status
  if (status === 'completed') return stepDefinitions.length + 1
  const idx = stepDefinitions.findIndex(s => s.key === toDisplayKey(status))
  return idx >= 0 ? idx + 1 : 1
})

const generateButtonLabel = computed(() => {
  if (!currentJob.value || currentJob.value.status !== 'failed') {
    return '\u{1F680} Generate Shorts'
  }
  const failedStep = toDisplayKey(currentJob.value.failed_at_step || '')
  const stepDef = stepDefinitions.find(s => s.key === failedStep)
  if (stepDef) {
    const cachedCount = stepDefinitions.filter(s => getStepState(s.key) === 'completed').length
    if (cachedCount > 0) {
      return '\u{1F504} Retry from "' + stepDef.title + '" (' + cachedCount + ' steps cached)'
    }
    return '\u{1F504} Retry from "' + stepDef.title + '"'
  }
  return '\u{1F504} Retry Generation'
})

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '\u2014'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return m + ':' + String(s).padStart(2, '0')
}

// Subtitle preview styles for the vertical story preview
const subtitlePreviewStyle = computed(() => {
  const s = subtitleSettings.value
  return {
    fontFamily: s.fontName,
    fontSize: `${Math.max(8, Math.min(s.fontSize, 32))}px`,
    fontWeight: s.bold ? '700' : '400',
    color: s.primaryColor,
    textShadow: `
      -${s.outline}px -${s.outline}px 0 ${s.outlineColor},
       ${s.outline}px -${s.outline}px 0 ${s.outlineColor},
      -${s.outline}px  ${s.outline}px 0 ${s.outlineColor},
       ${s.outline}px  ${s.outline}px 0 ${s.outlineColor}
    `,
    textAlign: 'center' as const,
    padding: '4px 8px',
    lineHeight: '1.3',
  }
})
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-8" @click.self="closeMenus">
    <NuxtLink to="/dashboard" class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
      &larr; Back to Dashboard
    </NuxtLink>

    <div v-if="loading && !currentVideo" class="text-center py-12 text-muted-foreground">
      Loading video...
    </div>

    <template v-else-if="currentVideo">
      <!-- Video Header — compact -->
      <div class="flex flex-col sm:flex-row gap-4 items-start">
        <div
          class="aspect-video w-full sm:w-56 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 relative cursor-pointer group overflow-hidden"
          @click="playOriginalVideo"
        >
          <span class="text-3xl group-hover:scale-110 transition-transform">&#x1F3AC;</span>
          <!-- Play overlay -->
          <div class="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
            <div class="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play class="size-5 text-black ml-0.5" />
            </div>
          </div>
          <span v-if="loadingOriginalVideo" class="absolute inset-0 flex items-center justify-center bg-black/50">
            <svg class="size-6 animate-spin text-white" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
              <path class="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </span>
        </div>
        <div class="flex-1 space-y-2 min-w-0">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <h1 class="text-xl font-bold truncate">{{ currentVideo.title }}</h1>
            <Button variant="ghost" size="sm" class="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0" @click="showDeleteDialog = true">
              <Trash2 class="size-4 mr-1" /> Delete
            </Button>
          </div>
          <div class="flex flex-wrap gap-2 items-center">
            <Badge :variant="currentVideo.status === 'completed' ? 'success' : 'secondary'">
              {{ currentVideo.status }}
            </Badge>
            <span class="text-sm text-muted-foreground">
              {{ new Date(currentVideo.created_at).toLocaleDateString() }}
            </span>
            <span v-if="currentVideo.duration" class="text-sm text-muted-foreground">
              &middot; {{ formatDuration(currentVideo.duration) }}
            </span>
          </div>
          <p class="text-xs text-muted-foreground truncate">{{ currentVideo.original_filename }}</p>
        </div>
      </div>

      <div v-if="shorts.length > 0" class="space-y-5">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold flex items-center gap-2">
              ✨ Generated Shorts
            </h2>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer px-2 py-1 rounded-md hover:bg-muted transition-colors"
              @click="sortMode = sortMode === 'score' ? 'chronological' : 'score'"
            >
              <ArrowDownUp class="size-4" />
              {{ sortMode === 'score' ? 'By viral score' : 'Chronological' }}
            </button>
          </div>
        </div>

        <!-- Batch Download Button — always visible when shorts exist -->
        <div class="flex flex-wrap gap-3">
          <Button size="lg" @click="handleBatchDownload" :disabled="batchDownloading" class="gap-2">
            <Download class="size-4" />
            {{ batchDownloading ? 'Downloading...' : `Download All ${shorts.length} Shorts` }}
          </Button>
        </div>

        <!-- Shorts Grid — vertical story cards -->
        <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Card v-for="short in shorts" :key="short.id" class="group relative border-2 hover:border-primary/50 transition-colors">
            <CardContent class="p-0">
              <!-- Vertical Story Preview -->
              <div
                class="relative aspect-[9/16] bg-gradient-to-b from-slate-800 via-slate-900 to-black flex flex-col items-center justify-end overflow-hidden rounded-t-lg cursor-pointer"
                @click="handlePlayShort(short.id, short.title)"
              >
                <!-- Play overlay -->
                <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <div class="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                    <Play class="size-8 text-black ml-1" />
                  </div>
                </div>

                <!-- Phone frame indicators -->
                <div class="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-1 rounded-full bg-white/20" />

                <!-- Thumbnail if available, else placeholder -->
                <template v-if="thumbnailUrls[short.id]">
                  <img :src="thumbnailUrls[short.id]" :alt="short.title" class="absolute inset-0 w-full h-full object-cover opacity-80" />
                </template>
                <template v-else>
                  <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-25">
                    <span class="text-4xl">📱</span>
                    <span class="text-xs text-white">{{ short.title.slice(0, 20) }}</span>
                  </div>
                </template>



                <!-- Viral score badge -->
                <div v-if="short.score" class="absolute top-3 right-3 z-20">
                  <Badge
                    :variant="short.score > 0.8 ? 'default' : short.score > 0.5 ? 'secondary' : 'outline'"
                    :class="short.score > 0.8 ? 'bg-green-600 hover:bg-green-600 text-white' : ''"
                    class="text-xs font-bold"
                  >
                    🔥 {{ Math.round(short.score * 100) }}%
                  </Badge>
                </div>
              </div>

              <!-- Short Info -->
              <div class="p-3 space-y-2">
                <div class="flex items-start justify-between gap-2">
                  <h3 class="font-semibold text-sm leading-tight flex-1 line-clamp-2">{{ short.title }}</h3>
                  <div class="relative" @click.stop>
                    <button class="p-1 rounded hover:bg-muted cursor-pointer" @click="toggleMenu(short.id)">
                      <MoreVertical class="size-4 text-muted-foreground" />
                    </button>
                    <div v-if="activeMenuShortId === short.id" class="absolute right-0 top-8 z-50 min-w-[160px] rounded-md border bg-popover p-1 shadow-md">
                      <button class="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent cursor-pointer" @click="handlePlayShort(short.id, short.title); activeMenuShortId = null">
                        <Play class="size-4" /> Play
                      </button>
                      <button class="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent cursor-pointer" @click="handleDownload(short.id, short.title); activeMenuShortId = null">
                        <Download class="size-4" /> Download
                      </button>
                      <hr class="my-1 border-border" />
                      <button class="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-destructive hover:bg-destructive/10 cursor-pointer" @click="handleDeleteShort(short.id); activeMenuShortId = null">
                        <Trash2 class="size-4" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <p class="text-xs text-muted-foreground">
                    {{ formatDuration(short.duration) }} &middot; {{ short.width }}&times;{{ short.height }}
                  </p>
                  <Button variant="outline" size="sm" class="h-7 text-xs gap-1" @click.stop="handleDownload(short.id, short.title)">
                    <Download class="size-3" /> Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- Bottom batch download (always available after generation) -->
        <div class="flex justify-center pt-2">
          <Button variant="outline" size="lg" @click="handleBatchDownload" :disabled="batchDownloading" class="gap-2">
            <Download class="size-4" />
            {{ batchDownloading ? 'Downloading...' : `Download All ${shorts.length} Shorts` }}
          </Button>
        </div>
      </div>

      <!-- Delete Confirmation Dialog -->
      <Dialog :open="showDeleteDialog" @update:open="showDeleteDialog = $event">
        <div class="space-y-4">
          <div class="space-y-2">
            <h2 class="text-lg font-semibold">Delete Video?</h2>
            <p class="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{{ currentVideo.title }}</strong>?
              This will permanently remove the video and all generated shorts. This action cannot be undone.
            </p>
          </div>
          <div class="flex justify-end gap-3">
            <Button variant="ghost" :disabled="deleting" @click="showDeleteDialog = false">Cancel</Button>
            <Button variant="destructive" :disabled="deleting" @click="handleDelete">
              {{ deleting ? 'Deleting\u2026' : '\u{1F5D1} Yes, Delete' }}
            </Button>
          </div>
        </div>
      </Dialog>

      <!-- Video Preview Modal — vertical story format -->
      <Dialog :open="showPreview" @update:open="(v: boolean) => { showPreview = v; if(!v) previewUrl = '' }">
        <div class="space-y-4">
          <h2 class="text-lg font-semibold">{{ previewTitle }}</h2>
          <div class="flex justify-center">
            <div class="relative bg-black rounded-2xl overflow-hidden shadow-2xl" style="max-width: 360px; width: 100%;">
              <!-- Phone-like frame -->
              <div class="absolute top-0 left-0 right-0 h-6 bg-black z-10 flex items-center justify-center">
                <div class="w-16 h-1 rounded-full bg-white/20" />
              </div>
              <video
                v-if="previewUrl"
                :src="previewUrl"
                controls
                autoplay
                playsinline
                class="w-full aspect-[9/16] object-contain"
              />
            </div>
          </div>
          <div class="flex justify-end">
            <Button variant="ghost" @click="showPreview = false">Close</Button>
          </div>
        </div>
      </Dialog>

      <!-- Original Video Player Modal — 16:9 landscape -->
      <Dialog :open="showOriginalPlayer" @update:open="(v: boolean) => { showOriginalPlayer = v; if(!v) originalVideoUrl = '' }">
        <div class="space-y-4">
          <h2 class="text-lg font-semibold">{{ currentVideo?.title }} — Original</h2>
          <div class="flex justify-center">
            <div class="relative bg-black rounded-xl overflow-hidden shadow-2xl w-full" style="max-width: 720px;">
              <video
                v-if="originalVideoUrl"
                :src="originalVideoUrl"
                controls
                autoplay
                playsinline
                class="w-full aspect-video object-contain"
              />
            </div>
          </div>
          <div class="flex justify-end">
            <Button variant="ghost" @click="showOriginalPlayer = false">Close</Button>
          </div>
        </div>
      </Dialog>

      <!-- ════════════════════════════════════════════════ -->
      <!-- Processing Status (shown only during processing) -->
      <!-- ════════════════════════════════════════════════ -->
      <Card v-if="currentJob && !['completed', 'failed'].includes(currentJob.status)">
        <CardHeader>
          <CardTitle>⏳ Processing Your Video</CardTitle>
          <CardDescription>This may take a few minutes depending on video length.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium">{{ getJobStatusLabel(currentJob.status) }}</span>
              <span class="text-muted-foreground">{{ jobProgress }}%</span>
            </div>
            <Progress :model-value="jobProgress" class="w-full" />
          </div>

          <!-- Custom left-aligned step list (replaces Radix Stepper to avoid centering/reset issues) -->
          <div class="space-y-2">
            <div
              v-for="item in stepDefinitions"
              :key="item.key"
              class="flex items-center gap-3"
            >
              <!-- Step indicator -->
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors"
                :class="{
                  'border-primary bg-primary text-primary-foreground': getStepState(item.key) === 'completed',
                  'border-primary bg-primary/10 text-primary': getStepState(item.key) === 'active',
                  'border-destructive bg-destructive/10 text-destructive': getStepState(item.key) === 'error',
                  'border-muted bg-background text-muted-foreground': getStepState(item.key) === 'inactive',
                }"
              >
                <Check v-if="getStepState(item.key) === 'completed'" class="size-4" />
                <svg v-else-if="getStepState(item.key) === 'active'" class="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
                  <path class="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span v-else-if="getStepState(item.key) === 'error'" class="text-xs font-bold">✕</span>
                <span v-else class="text-xs font-bold">{{ item.step }}</span>
              </div>
              <!-- Step label -->
              <div class="flex-1">
                <div
                  class="text-sm font-medium leading-tight"
                  :class="{
                    'text-primary': getStepState(item.key) === 'active',
                    'text-destructive': getStepState(item.key) === 'error',
                    'text-muted-foreground': getStepState(item.key) === 'inactive',
                  }"
                >
                  {{ item.title }}
                  <span v-if="getStepState(item.key) === 'active'" class="text-xs font-normal text-muted-foreground ml-1">— in progress…</span>
                </div>
                <div class="text-xs text-muted-foreground">{{ item.description }}</div>
              </div>
            </div>
          </div>
        </CardContent>
                <!-- 'Come back later' hint -->
        <div class="mx-6 mb-6 pb-2  flex items-start gap-2 rounded-lg bg-muted/60 border border-border px-3 py-2.5 text-sm text-muted-foreground">
          <span class="text-base leading-none mt-0.5">💡</span>
          <span>You can <strong class="text-foreground">close this page and come back later</strong> — processing continues in the background and your shorts will be ready here when done.</span>
        </div>
      </Card>

      <!-- ════════════════════════════════════════════════ -->
      <!-- Generate / Retry Section                        -->
      <!-- ════════════════════════════════════════════════ -->
      <Card v-if="!currentJob || currentJob.status === 'failed' || currentJob.status === 'completed'">
        <CardHeader>
          <CardTitle>{{ currentJob?.status === 'failed' ? '🔄 Retry Generation' : currentJob?.status === 'completed' ? '🔄 Regenerate Shorts' : '🚀 Generate Shorts' }}</CardTitle>
          <CardDescription>
            {{ currentJob?.status === 'completed' ? 'Want different results? Adjust duration and regenerate.' : 'Select a duration and let AI find the best moments.' }}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="rounded-lg border border-dashed p-3 flex items-center gap-2 text-sm">
            <span>✨</span>
            <span class="text-muted-foreground">AI will automatically detect the best passages and choose the optimal duration for each short (15–90s).</span>
          </div>

          <!-- Current subtitle style indicator -->
          <div class="rounded-lg border border-dashed p-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 text-sm">
              <span>🎨</span>
              <span class="text-muted-foreground">Subtitle style:</span>
              <span class="font-mono text-xs">{{ subtitleSettings.fontName }} {{ subtitleSettings.fontSize }}px</span>
            </div>
            <NuxtLink to="/dashboard/settings">
              <Button variant="ghost" size="sm" class="text-xs gap-1 h-7">
                <Settings class="size-3" /> Edit
              </Button>
            </NuxtLink>
          </div>

          <!-- Error from previous attempt -->
          <div v-if="currentJob?.status === 'failed'" class="space-y-3">
            <div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive space-y-1">
              <p class="font-medium">
                Previous attempt failed{{ currentJob.failed_at_step ? ' at: ' + (stepDefinitions.find(s => s.key === currentJob!.failed_at_step)?.title || currentJob.failed_at_step) : '' }}
              </p>
              <p>{{ currentJob.error_message || 'Unknown error' }}</p>
            </div>
            <div class="space-y-1">
              <div
                v-for="item in stepDefinitions"
                :key="item.key"
                class="flex items-center gap-3 px-3 py-1.5 rounded text-sm"
                :class="{ 'text-muted-foreground': getStepState(item.key) === 'inactive', 'text-destructive bg-destructive/5': getStepState(item.key) === 'error' }"
              >
                <span class="w-4 text-center">
                  <Check v-if="getStepState(item.key) === 'completed'" class="size-4 text-green-600 inline" />
                  <span v-else-if="getStepState(item.key) === 'error'">&#x274C;</span>
                  <span v-else class="text-muted-foreground">&#x25CB;</span>
                </span>
                <span>{{ item.title }}</span>
                <span v-if="getStepState(item.key) === 'completed'" class="text-xs text-green-600 ml-auto">cached</span>
              </div>
            </div>
          </div>

          <div v-if="errorMessage" class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {{ errorMessage }}
          </div>

          <Button size="lg" class="w-full" @click="confirmGenerate" :disabled="generating">
            {{ generating ? '\u23F3 Processing...' : generateButtonLabel }}
          </Button>
        </CardContent>
      </Card>

      <!-- ════════════════════════════════════════════════ -->
      <!-- Transcript Downloads — visible as soon as audio  -->
      <!-- is transcribed, even while job is still running  -->
      <!-- ════════════════════════════════════════════════ -->
      <Card v-if="hasTranscript()" class="border-dashed">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            📝 Subtitles &amp; Transcript
            <Badge variant="secondary" class="text-xs">Available</Badge>
            <!-- Show a subtle 'ready during processing' badge -->
            <Badge
              v-if="currentJob && !['completed', 'failed'].includes(currentJob.status)"
              variant="outline"
              class="text-xs text-green-600 border-green-500"
            >
              ✅ Transcription done
            </Badge>
          </CardTitle>
          <CardDescription v-if="currentJob && !['completed', 'failed'].includes(currentJob.status)">
            Audio has been transcribed — you can already download the subtitles while the video finishes processing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" @click="downloadTranscriptSrt()">⬇️ .SRT</Button>
            <Button variant="outline" size="sm" @click="downloadTranscriptVtt()">⬇️ .VTT</Button>
            <Button variant="outline" size="sm" @click="downloadTranscriptJson()">📄 Transcript</Button>
            <Button v-if="hasSegments" variant="outline" size="sm" @click="downloadSegmentsJson()">🤖 Segments</Button>
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
    </template>

    <!-- Upgrade Dialog (triggered by backend 429) -->
    <UpgradeDialog
      v-model:open="showUpgradeDialog"
      :type="limitPayload.type"
      :used="limitPayload.used"
      :limit="limitPayload.limit"
      :reset-date="limitPayload.resetDate"
    />
  </div>
</template>
