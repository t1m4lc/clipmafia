<script setup lang="ts">
import { Check, MoreVertical, Play, Download, Trash2, ArrowDownUp, Settings, LayoutGrid, List, X } from 'lucide-vue-next'

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

// View mode toggle: 'list' (default) or 'card'
const viewMode = ref<'card' | 'list'>('list')

const durationFilter = ref<'7-15' | '15-30' | '30-60' | 'all'>('all')

const filteredShorts = computed(() => {
  if (durationFilter.value === 'all') return shorts.value
  const [minStr, maxStr] = durationFilter.value.split('-')
  const min = Number(minStr)
  const max = Number(maxStr)
  return shorts.value.filter((s) => {
    const dur = s.duration ?? (s.end_time - s.start_time)
    return dur >= min && dur <= max
  })
})

const durationOptions = [
  { value: 'all' as const, label: 'All' },
  { value: '7-15' as const, label: '7–15s' },
  { value: '15-30' as const, label: '15–30s' },
  { value: '30-60' as const, label: '30–60s' },
] as const
const previewUrl = ref('')
const previewTitle = ref('')
const showPreview = ref(false)
const activeMenuShortId = ref<string | null>(null)

// Inline original video player state (no dialog)
const originalVideoUrl = ref('')
const loadingOriginalVideo = ref(false)
const inlinePlayerRef = ref<HTMLVideoElement | null>(null)
const activeSegmentEnd = ref<number | null>(null)
const activeSegmentIndex = ref<number | null>(null)

async function loadOriginalVideo() {
  if (!currentVideo.value || originalVideoUrl.value) return
  loadingOriginalVideo.value = true
  try {
    const url = await getOriginalVideoUrl(currentVideo.value.id)
    if (url) {
      originalVideoUrl.value = url
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
  // Only load thumbnails when in card view
  if (!shorts.value.length || viewMode.value !== 'card') return
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

// Holds the polling stop function so we can cancel when the component unmounts
let stopPolling: (() => void) | null = null

onMounted(async () => {
  await fetchVideo(videoId)
  await fetchJob(videoId)
  await fetchShorts(videoId, sortMode.value)

  await preloadThumbnails()

  // Auto-load original video if segments are already available
  if (segments.value.length > 0) {
    loadOriginalVideo()
  }

  if (currentJob.value && !['completed', 'failed'].includes(currentJob.value.status ?? '')) {
    // Attempt to rescue stale jobs before starting to poll.
    // The server checks the job age — if it's still fresh the call is a no-op.
    // This handles: fire-and-forget HTTP failures, Vercel function timeouts,
    // and any crash that left the job at an intermediate non-terminal status.
    try {
      const rescue = await $fetch('/api/jobs/rescue', {
        method: 'POST',
        body: { jobId: currentJob.value.id },
      }) as any
      if (rescue?.rescued) {
        // Job is now "failed" — re-fetch so the retry button appears
        await fetchJob(videoId)
      }
    } catch { /* rescue is best-effort; silently ignore */ }

    // Only start polling if the job is still actively in-progress
    if (currentJob.value && !['completed', 'failed'].includes(currentJob.value.status ?? '')) {
      generating.value = true
      const { stop } = pollJobStatus(videoId)
      stopPolling = stop
    }
  }

  document.addEventListener('click', closeMenus)
})

onUnmounted(() => {
  stopPolling?.()  // cancel ongoing polling to avoid memory / network leaks
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

watch(viewMode, (mode) => {
  if (mode === 'card') preloadThumbnails()
})

// Auto-pause at segment end
function handleSegmentTimeUpdate() {
  const el = inlinePlayerRef.value
  if (el && activeSegmentEnd.value !== null && el.currentTime >= activeSegmentEnd.value) {
    el.pause()
    activeSegmentEnd.value = null
  }
}

watch(inlinePlayerRef, (el, oldEl) => {
  if (oldEl) oldEl.removeEventListener('timeupdate', handleSegmentTimeUpdate)
  if (el) el.addEventListener('timeupdate', handleSegmentTimeUpdate)
})

// Whether the Generate button should be shown:
// Only if there's no job yet, or if the last job failed.
// Once completed, it disappears — no regeneration.
const showGenerateSection = computed(() => {
  if (!currentJob.value) return true
  if (currentJob.value.status === 'failed') return true
  return false
})

async function confirmGenerate() {
  generating.value = true
  errorMessage.value = ''
  try {
    await generateShorts(videoId, subtitleSettings.value)
    pollJobStatus(videoId, 2000)
  } catch (e: any) {
    errorMessage.value = e?.data?.message || e.message || 'Failed to start processing'
    generating.value = false
  }
}

async function downloadAsBlob(url: string, filename: string) {
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
      const safeName = short.title.replace(/[/\\?%*:|"<>]/g, '-') + '.mp4'
      files[safeName] = new Uint8Array(buffer)
    }

    if (Object.keys(files).length === 0) {
      errorMessage.value = 'No shorts available to download'
      return
    }

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
  const status = currentJob.value.status ?? ''

  if (status === 'completed') return 100
  if (status === 'failed') return 0

  // ── Step 4: Create Shorts ────────────────────────────────────────────────
  // After the first 3 steps the bar sits at 60 %.
  // The remaining 40 % is distributed evenly across all detected segments;
  // the bar advances by one slice as each short is created.
  if (CREATING_STEPS.includes(status)) {
    const totalSegments = segments.value.length
    if (totalSegments > 0) {
      const completedShorts = shorts.value.length
      return 60 + Math.round((completedShorts / totalSegments) * 40)
    }
    return 60
  }

  // ── Steps 1-3 ────────────────────────────────────────────────────────────
  // Fixed milestones — never exceed 60 % so step-4 always has room to grow.
  const progressMap: Record<string, number> = {
    queued: 3,
    extracting_audio: 20,
    transcribing: 38,
    detecting_segments: 55,
  }
  return progressMap[status] ?? 0
})

const jobSteps = computed(() => (currentJob.value as any)?.steps || null)

const hasSegments = computed(() => {
  return !!(currentJob.value?.segments && Array.isArray(currentJob.value.segments) && currentJob.value.segments.length > 0)
})

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

const CREATING_STEPS = ['processing_video', 'burning_subtitles', 'uploading']

function toDisplayKey(status: string): string {
  return CREATING_STEPS.includes(status) ? 'processing_video' : status
}

function getStepState(stepKey: string): 'completed' | 'active' | 'inactive' | 'error' {
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

// Segments for visualization (from the job)
const segments = computed<Segment[]>(() => {
  if (!currentJob.value?.segments || !Array.isArray(currentJob.value.segments)) return []
  return currentJob.value.segments as Segment[]
})

// Sort by duration descending so shorter segments end up later in DOM → higher natural stacking → get mouse priority
const timelineSegments = computed(() =>
  segments.value
    .map((seg, idx) => ({ seg, idx }))
    .sort((a, b) => (b.seg.end - b.seg.start) - (a.seg.end - a.seg.start))
)

// Auto-load original video when segments become available (e.g. after job completes)
watch(segments, (segs) => {
  if (segs.length > 0 && !originalVideoUrl.value) {
    loadOriginalVideo()
  }
})

function closePreview() {
  showPreview.value = false
  previewUrl.value = ''
}

function _onPreviewKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closePreview()
}

watch(showPreview, (open) => {
  if (!import.meta.client) return
  if (open) {
    document.addEventListener('keydown', _onPreviewKey)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', _onPreviewKey)
    document.body.style.overflow = ''
  }
})

async function seekToSegment(segment: Segment) {
  activeSegmentIndex.value = segments.value.indexOf(segment)
  if (!originalVideoUrl.value) {
    await loadOriginalVideo()
    await nextTick()
  }
  const videoEl = inlinePlayerRef.value
  if (videoEl) {
    activeSegmentEnd.value = segment.end
    videoEl.currentTime = segment.start
    videoEl.play()
    videoEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-6 pb-8" @click.self="closeMenus">
    <!-- Back nav -->
    <NuxtLink to="/dashboard" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground py-1">
      &larr; Back to Dashboard
    </NuxtLink>

    <!-- ═══ SKELETON LOADER (initial page load) ═══ -->
    <template v-if="loading && !currentVideo">
      <!-- Hero skeleton -->
      <div class="rounded-2xl border p-5 space-y-3">
        <Skeleton class="h-8 w-2/3" />
        <Skeleton class="h-5 w-24 rounded-full" />
        <Skeleton class="h-4 w-44" />
        <Skeleton class="h-3 w-52" />
      </div>

      <!-- Shorts list skeleton -->
      <div class="space-y-3">
        <Skeleton class="h-6 w-48" />
        <!-- Filter row -->
        <div class="flex gap-2">
          <Skeleton class="h-8 w-28 rounded-lg" />
          <Skeleton class="h-8 w-20 rounded-lg" />
        </div>
        <!-- List items -->
        <div class="space-y-2">
          <div v-for="i in 4" :key="i" class="flex items-center gap-3 p-3 rounded-lg border">
            <div class="flex flex-col items-center gap-1 w-14 shrink-0">
              <Skeleton class="h-5 w-10" />
              <Skeleton class="h-3 w-6" />
            </div>
            <div class="flex-1 space-y-2">
              <Skeleton class="h-4" :class="i % 2 === 0 ? 'w-3/4' : 'w-5/6'" />
              <Skeleton class="h-3 w-16" />
            </div>
            <Skeleton class="h-8 w-20 rounded-md shrink-0" />
          </div>
        </div>
      </div>

      <!-- Detected segments skeleton -->
      <div class="space-y-3">
        <Skeleton class="h-6 w-52" />
        <Skeleton class="w-full h-10 rounded-lg" />
        <div class="flex gap-2">
          <Skeleton v-for="j in 3" :key="j" class="h-8 w-28 rounded-lg shrink-0" />
        </div>
      </div>
    </template>

    <template v-else-if="currentVideo">
      <!-- ═══════════════ VIDEO HEADER HERO ═══════════════ -->
      <div class="relative rounded-2xl overflow-hidden border bg-gradient-to-bl from-primary/[0.07] to-background  px-5 py-5">
        <!-- Decorative blurred orbs -->
        <div class="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full bg-primary/10 blur-3xl" />
        <div class="pointer-events-none absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-purple-500/10 blur-3xl" />

        <div class="relative flex items-start justify-between gap-3">
          <div class="min-w-0 space-y-2.5">
            <h1 class="text-2xl font-extrabold leading-tight tracking-tight truncate">{{ currentVideo.title }}</h1>

            <!-- Status pill -->
            <div
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border"
              :class="{
                'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400': currentVideo.status === 'completed',
                'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400': currentVideo.status === 'processing',
                'bg-destructive/10 border-destructive/30 text-destructive': currentVideo.status === 'failed',
                'bg-muted border-border text-muted-foreground': !['completed','processing','failed'].includes(currentVideo.status ?? ''),
              }"
            >
              <span
                class="w-1.5 h-1.5 rounded-full shrink-0"
                :class="{
                  'bg-green-500': currentVideo.status === 'completed',
                  'bg-yellow-500 animate-pulse': currentVideo.status === 'processing',
                  'bg-destructive': currentVideo.status === 'failed',
                  'bg-muted-foreground': !['completed','processing','failed'].includes(currentVideo.status ?? ''),
                }"
              />
              <span class="capitalize">{{ currentVideo.status }}</span>
            </div>

            <!-- Date · duration -->
            <p class="text-sm text-muted-foreground">
              {{ currentVideo.created_at ? new Date(currentVideo.created_at).toLocaleDateString() : '' }}<span v-if="currentVideo.duration"> · {{ formatDuration(currentVideo.duration) }}</span>
            </p>

            <!-- Filename -->
            <p class="text-xs text-muted-foreground/60 font-mono truncate">{{ currentVideo.original_filename }}</p>
          </div>

          <Button variant="ghost" size="sm" class="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0" @click="showDeleteDialog = true">
            <Trash2 class="size-4" />
            <span class="hidden sm:inline ml-1">Delete</span>
          </Button>
        </div>
      </div>

      <!-- ═══════════════ GENERATED SHORTS ═══════════════ -->
      <div v-if="shorts.length > 0" class="space-y-4">
        <!-- Header row -->
        <div class="flex flex-col gap-3">
          <div class="flex items-center flex-col sm:flex-row justify-between gap-2">
            <h2 class="text-xl font-bold flex items-center gap-2">✨ Generated Shorts <span class="text-base font-normal text-muted-foreground">({{ shorts.length }})</span></h2>
                    <!-- Batch Download -->
        <Button variant="outline" class="w-full sm:w-auto gap-2" @click="handleBatchDownload" :disabled="batchDownloading">
          <Download class="size-4" />
          {{ batchDownloading ? 'Downloading...' : `Download All Shorts` }}
        </Button>


          </div>
          
          <!-- Filters row -->
          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center gap-1 rounded-lg bg-muted p-1">
              <button
                v-for="opt in durationOptions"
                :key="opt.value"
                class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer"
                :class="durationFilter === opt.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                @click="durationFilter = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
                        <!-- View toggle -->
            <div class="flex items-center gap-1 rounded-lg bg-muted p-1">
              <button
                class="p-1.5 rounded-md transition-colors cursor-pointer"
                :class="viewMode === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                title="Card view"
                @click="viewMode = 'card'"
              >
                <LayoutGrid class="size-4" />
              </button>
              <button
                class="p-1.5 rounded-md transition-colors cursor-pointer"
                :class="viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                title="List view"
                @click="viewMode = 'list'"
              >
                <List class="size-4" />
              </button>
            </div>
            <button
              class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
              @click="sortMode = sortMode === 'score' ? 'chronological' : 'score'"
            >
              <ArrowDownUp class="size-4" />
              <span class="text-xs">{{ sortMode === 'score' ? 'Viral score' : 'Chronological' }}</span>
            </button>
          </div>
        </div>

        <!-- No results for current filter -->
        <div v-if="filteredShorts.length === 0 && shorts.length > 0" class="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          <p>No shorts match the <strong>{{ durationFilter }}</strong> filter.</p>
          <button class="mt-2 text-sm text-primary hover:underline cursor-pointer" @click="durationFilter = 'all'">Show all</button>
        </div>


        <!-- ══ CARD VIEW ══ -->
        <div v-if="viewMode === 'card'" class="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <Card v-for="short in filteredShorts" :key="short.id" class="group relative border-2 hover:border-primary/50 transition-colors">
            <CardContent class="p-0">
              <div
                class="relative aspect-[9/16] bg-gradient-to-b from-slate-800 via-slate-900 to-black flex flex-col items-center justify-end overflow-hidden rounded-t-lg cursor-pointer"
                @click="handlePlayShort(short.id, short.title)"
              >
                <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <div class="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                    <Play class="size-8 text-black ml-1" />
                  </div>
                </div>
                <div class="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-1 rounded-full bg-white/20" />
                <template v-if="thumbnailUrls[short.id]">
                  <img :src="thumbnailUrls[short.id]" :alt="short.title" class="absolute inset-0 w-full h-full object-cover opacity-80" />
                </template>
                <template v-else>
                  <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-25">
                    <span class="text-4xl">📱</span>
                  </div>
                </template>
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
              <div class="p-3 space-y-2">
                <div class="flex items-start justify-between gap-2">
                  <h3 class="font-semibold text-sm leading-tight flex-1 line-clamp-2">{{ short.title }}</h3>
                  <div class="relative" @click.stop>
                    <button class="p-1.5 rounded hover:bg-muted cursor-pointer" @click="toggleMenu(short.id)">
                      <MoreVertical class="size-4 text-muted-foreground" />
                    </button>
                    <div v-if="activeMenuShortId === short.id" class="absolute right-0 top-9 z-50 min-w-[160px] rounded-md border bg-popover p-1 shadow-md">
                      <button class="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-sm hover:bg-accent cursor-pointer" @click="handlePlayShort(short.id, short.title); activeMenuShortId = null">
                        <Play class="size-4" /> Preview
                      </button>
                      <button class="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-sm hover:bg-accent cursor-pointer" @click="handleDownload(short.id, short.title); activeMenuShortId = null">
                        <Download class="size-4" /> Download
                      </button>
                      <hr class="my-1 border-border" />
                      <button class="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 cursor-pointer" @click="handleDeleteShort(short.id); activeMenuShortId = null">
                        <Trash2 class="size-4" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <p class="text-xs text-muted-foreground">
                    {{ formatDuration(short.duration) }} &middot; {{ short.width }}&times;{{ short.height }}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- ══ LIST VIEW ══ -->
        <div v-if="viewMode === 'list'" class="space-y-2">
          <div
            v-for="short in filteredShorts"
            :key="short.id"
            class="group cursor-pointer flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 transition-colors active:bg-muted/40"
            @click="handlePlayShort(short.id, short.title)"
          >
            <!-- Viral score + duration -->
            <div class="flex flex-col items-center justify-center gap-0.5 w-14 shrink-0 text-center">
              <span
                v-if="short.score"
                class="text-base font-extrabold tabular-nums leading-none"
                :class="short.score > 0.8 ? 'text-green-600 dark:text-green-400' : short.score > 0.5 ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'"
              >{{ Math.round(short.score * 100) }}%</span>
              <span v-if="short.score" class="text-[9px] uppercase tracking-wide text-muted-foreground font-medium leading-none">viral</span>
              <span class="text-[11px] text-muted-foreground font-mono mt-1">{{ formatDuration(short.duration) }}</span>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <h3 class="font-medium text-sm leading-snug line-clamp-2">{{ short.title }}</h3>
              <p class="text-xs text-muted-foreground mt-0.5">{{ short.width }}&times;{{ short.height }}</p>
            </div>

            <!-- Actions: Preview button + kebab menu -->
            <div class="flex items-center gap-1 shrink-0" @click.stop>
              <Button variant="outline" size="sm" class="hidden sm:flex h-9 px-3 text-xs gap-1.5" @click="handlePlayShort(short.id, short.title)">
                <Play class="size-3.5" /> Preview
              </Button>
              <div class="relative">
                <button class="p-2 rounded-lg hover:bg-muted cursor-pointer" @click="toggleMenu(short.id)">
                  <MoreVertical class="size-4 text-muted-foreground" />
                </button>
                <div v-if="activeMenuShortId === short.id" class="absolute right-0 top-10 z-50 min-w-[150px] rounded-md border bg-popover p-1 shadow-md">
                           <button class="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-sm hover:bg-accent cursor-pointer" @click="handlePlayShort(short.id, short.title)">
                    <Play class="size-4" /> Preview
                  </button>
                  <button class="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-sm hover:bg-accent cursor-pointer" @click="handleDownload(short.id, short.title); activeMenuShortId = null">
                    <Download class="size-4" /> Download
                  </button>
                  <hr class="my-1 border-border" />
                  <button class="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 cursor-pointer" @click="handleDeleteShort(short.id); activeMenuShortId = null">
                    <Trash2 class="size-4" /> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="text-center py-6">
                                      <!-- Batch Download -->
        <Button variant="secondary" class="w-full sm:w-auto gap-2" @click="handleBatchDownload" :disabled="batchDownloading">
          <Download class="size-4" />
          {{ batchDownloading ? 'Downloading...' : `Download All ${filteredShorts.length} Shorts` }}
        </Button>
        </div>

      </div>

      <!-- ═══════════════ DETECTED SEGMENTS + INLINE PLAYER ═══════════════ -->
      <div v-if="segments.length > 0 && currentVideo.duration" class="space-y-3">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="text-base font-semibold flex items-center gap-2">
            🎯 Detected Segments
            <span class="text-sm font-normal text-muted-foreground">({{ segments.length }})</span>
          </h3>
          <span v-if="loadingOriginalVideo" class="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <svg class="size-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
              <path class="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Loading video…
          </span>
        </div>

        <!-- Inline video player (no dialog) -->
        <!-- Skeleton while the signed URL is being fetched -->
        <Skeleton v-if="loadingOriginalVideo && !originalVideoUrl" class="w-full aspect-video rounded-xl" />
        <div v-else-if="originalVideoUrl" class="rounded-xl overflow-hidden bg-black shadow-lg">
          <video
            ref="inlinePlayerRef"
            id="original-video-player"
            :src="originalVideoUrl"
            controls
            playsinline
            class="w-full aspect-video object-contain"
          />
        </div>

        <!-- Visual timeline bar (two layers: clipped bars + free-floating tooltips) -->
        <div class="relative h-10 my-1">
          <!-- Layer 1: colored bars — inside overflow-hidden so they respect the rounded corners -->
          <div class="absolute inset-0 rounded-lg bg-muted border overflow-hidden">
            <div
              v-for="({ seg, idx }, sortOrder) in timelineSegments"
              :key="`bar-${idx}`"
              class="absolute top-0 h-full border-r border-background/40 transition-colors duration-150"
              :class="activeSegmentIndex === idx
                ? 'bg-red-500'
                : seg.score > 0.8
                  ? 'bg-green-500/70'
                  : seg.score > 0.5
                    ? 'bg-yellow-500/70'
                    : 'bg-orange-500/70'"
              :style="{
                left: `${(seg.start / currentVideo.duration!) * 100}%`,
                width: `${Math.max(((seg.end - seg.start) / currentVideo.duration!) * 100, 1.5)}%`,
                zIndex: activeSegmentIndex === idx ? 50 : sortOrder + 1,
              }"
            />
          </div>
          <!-- Layer 2: invisible hit-areas + tooltips — NOT overflow-hidden so tooltips float above -->
          <div
            v-for="({ seg, idx }, sortOrder) in timelineSegments"
            :key="`hit-${idx}`"
            class="absolute top-0 h-full cursor-pointer group/seg hover:bg-white/15"
            :style="{
              left: `${(seg.start / currentVideo.duration!) * 100}%`,
              width: `${Math.max(((seg.end - seg.start) / currentVideo.duration!) * 100, 1.5)}%`,
              zIndex: activeSegmentIndex === idx ? 50 : sortOrder + 1,
            }"
            @click="seekToSegment(seg)"
          >
            <!-- Tooltip: lives outside overflow-hidden so it is never clipped -->
            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/seg:block z-[100] pointer-events-none">
              <div class="bg-popover text-popover-foreground border rounded-md shadow-md px-2.5 py-1.5 text-xs whitespace-nowrap">
                <p class="font-semibold">{{ seg.title }}</p>
                <p class="text-muted-foreground mt-0.5">{{ formatDuration(seg.start) }} → {{ formatDuration(seg.end) }} · 🔥 {{ Math.round(seg.score * 100) }}%</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Segment pills (scrollable on mobile) -->
        <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
          <button
            v-for="(seg, i) in segments"
            :key="i"
            class="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border cursor-pointer transition-all shrink-0 snap-start active:scale-95"
            :class="activeSegmentIndex === i
              ? 'bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400 font-medium'
              : 'hover:bg-accent'"
            @click="seekToSegment(seg)"
          >
            <span
              class="inline-block w-2 h-2 rounded-full shrink-0 transition-colors"
              :class="activeSegmentIndex === i
                ? 'bg-red-500'
                : seg.score > 0.8 ? 'bg-green-500' : seg.score > 0.5 ? 'bg-yellow-500' : 'bg-orange-500'"
            />
            <span class="truncate max-w-[100px]">{{ seg.title }}</span>
            <span class="font-mono transition-colors" :class="activeSegmentIndex === i ? 'text-red-500/70' : 'text-muted-foreground'">{{ formatDuration(seg.start) }}</span>
          </button>
        </div>
      </div>

      <!-- ═══════════════ PROCESSING STATUS ═══════════════ -->
      <!-- Hidden once shorts are available — job is clearly done -->
      <Card v-if="currentJob && !['completed', 'failed'].includes(currentJob.status) && shorts.length === 0">
        <CardHeader class="pb-3">
          <CardTitle class="text-base">⏳ Processing Your Video</CardTitle>
          <CardDescription>This may take a few minutes depending on video length.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-5">
          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium">{{ getJobStatusLabel(currentJob.status) }}</span>
              <span class="text-muted-foreground">{{ jobProgress }}%</span>
            </div>
            <Progress :model-value="jobProgress" class="w-full" />
          </div>
          <div class="space-y-3">
            <div
              v-for="item in stepDefinitions"
              :key="item.key"
              class="flex items-center gap-3"
            >
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
        <div class="mx-6 mb-6 flex items-start gap-2 rounded-lg bg-muted/60 border border-border px-3 py-2.5 text-sm text-muted-foreground">
          <span class="text-base leading-none mt-0.5">💡</span>
          <span>You can <strong class="text-foreground">close this page and come back later</strong> — processing continues in the background.</span>
        </div>
      </Card>

      <!-- ═══════════════ GENERATE / RETRY ═══════════════ -->
      <Card v-if="showGenerateSection">
        <CardHeader class="pb-3">
          <CardTitle>{{ currentJob?.status === 'failed' ? '🔄 Retry Generation' : '🚀 Generate Shorts' }}</CardTitle>
          <CardDescription>Let AI find the best moments and create vertical shorts automatically.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-5">
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

      <!-- ═══════════════ TRANSCRIPT DOWNLOADS ═══════════════ -->
      <Card v-if="hasTranscript()" class="border-dashed">
        <CardHeader class="pb-3">
          <CardTitle class="flex items-center gap-2 text-base">
            📝 Subtitles &amp; Transcript
            <Badge variant="secondary" class="text-xs">Available</Badge>
          </CardTitle>
          <CardDescription v-if="currentJob && !['completed', 'failed'].includes(currentJob.status)">
            Audio has been transcribed — you can already download the subtitles while the video finishes processing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <Button variant="outline" size="sm" class="justify-center" @click="downloadTranscriptSrt()">⬇️ .SRT</Button>
            <Button variant="outline" size="sm" class="justify-center" @click="downloadTranscriptVtt()">⬇️ .VTT</Button>
            <Button variant="outline" size="sm" class="justify-center" @click="downloadTranscriptJson()">📄 Transcript</Button>
            <Button v-if="hasSegments" variant="outline" size="sm" class="justify-center" @click="downloadSegmentsJson()">🤖 Segments</Button>
          </div>
        </CardContent>
      </Card>

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
          <div class="flex flex-col sm:flex-row justify-end gap-3">
            <Button variant="ghost" :disabled="deleting" @click="showDeleteDialog = false">Cancel</Button>
            <Button variant="destructive" :disabled="deleting" @click="handleDelete">
              {{ deleting ? 'Deleting\u2026' : '\u{1F5D1} Yes, Delete' }}
            </Button>
          </div>
        </div>
      </Dialog>

      <!-- Short Preview — full-screen on mobile · blurred float on desktop -->
      <Teleport to="body">
        <Transition name="short-preview">
          <div v-if="showPreview" class="fixed inset-0 z-[9999]">

            <!-- Backdrop: solid black on mobile, blurred dim on desktop -->
            <div
              class="absolute inset-0 bg-black sm:bg-black/75 sm:backdrop-blur-2xl"
              @click="closePreview"
            />

            <!-- Close button -->
            <button
              class="absolute top-4 right-4 z-[60] w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-colors cursor-pointer"
              aria-label="Close preview"
              @click="closePreview"
            >
              <X class="size-5" />
            </button>

            <!-- Title — desktop only -->
            <div class="absolute top-5 left-5 right-16 z-[60] hidden sm:block pointer-events-none">
              <p class="text-white/75 text-sm font-semibold truncate">{{ previewTitle }}</p>
            </div>

            <!-- Video: fills viewport on mobile; centered 9:16 pill on desktop -->
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none sm:p-8">
              <video
                v-if="previewUrl"
                :src="previewUrl"
                controls
                autoplay
                playsinline
                class="pointer-events-auto w-full h-full object-contain sm:h-auto sm:w-auto sm:max-h-[90vh] sm:max-w-[min(320px,42vw)] sm:rounded-2xl sm:shadow-[0_8px_80px_rgba(0,0,0,0.95)]"
              />
            </div>

          </div>
        </Transition>
      </Teleport>
    </template>

  </div>
</template>

<style scoped>
.short-preview-enter-active {
  transition: opacity 0.22s ease;
}
.short-preview-leave-active {
  transition: opacity 0.18s ease;
}
.short-preview-enter-from,
.short-preview-leave-to {
  opacity: 0;
}
</style>
