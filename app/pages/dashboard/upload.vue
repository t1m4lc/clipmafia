<script setup lang="ts">
import { Link, Upload, Lock, Zap, Crown } from 'lucide-vue-next'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
})

const { uploadVideo, submitYoutubeLink } = useVideos()
const { profile, fetchProfile, getUploadLimit, getUploadLimitInfo, effectivePlan, canUploadFiles } = useProfile()
const { showUpgradeDialog, limitPayload, handleLimitError } = useUsageLimits()

const uploadLimitInfo = computed(() => getUploadLimitInfo())
const uploadLimitBytes = computed(() => getUploadLimit())

// ── Mode selector ──────────────────────────────────────────────────────────
const mode = ref<'youtube' | 'upload'>('youtube')

// ── YouTube mode state ─────────────────────────────────────────────────────
const youtubeUrl = ref('')
const youtubeSubmitting = ref(false)
const youtubeError = ref('')

// ── Upload mode state ──────────────────────────────────────────────────────
const uploading = ref(false)
const dragOver = ref(false)
const uploadProgress = ref(0)
const errorMessage = ref('')
const selectedFile = ref<File | null>(null)

const isPremium = computed(() => effectivePlan() !== 'free')
const hasUploadAccess = computed(() => canUploadFiles())

onMounted(() => {
  fetchProfile()
})

// ── YouTube submission ─────────────────────────────────────────────────────
async function handleYoutubeSubmit() {
  const url = youtubeUrl.value.trim()
  if (!url) {
    youtubeError.value = 'Please enter a YouTube URL'
    return
  }

  // Basic client-side URL validation
  const ytPattern = /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtu\.be\/|youtube\.com\/shorts\/)[a-zA-Z0-9_-]{11}/
  if (!ytPattern.test(url) && !/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    youtubeError.value = 'Please enter a valid YouTube URL'
    return
  }

  youtubeSubmitting.value = true
  youtubeError.value = ''

  try {
    const video = await submitYoutubeLink(url) as any
    await navigateTo(`/dashboard/videos/${video.id}`)
  } catch (e: any) {
    if (handleLimitError(e)) return
    youtubeError.value = e?.data?.message || e.message || 'Failed to process YouTube link. Please try again.'
    youtubeSubmitting.value = false
  }
}

// ── File upload handlers ───────────────────────────────────────────────────
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  dragOver.value = true
}

function handleDragLeave() {
  dragOver.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) selectFile(file)
}

function handleFileInput(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) selectFile(file)
}

async function selectFile(file: File) {
  const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska']
  const limitBytes = uploadLimitBytes.value

  errorMessage.value = ''

  if (!validTypes.includes(file.type)) {
    errorMessage.value = `"${file.name}" is not a supported video format.`
    return
  }
  if (limitBytes !== Infinity && file.size > limitBytes) {
    const info = uploadLimitInfo.value
    errorMessage.value = `"${file.name}" exceeds the ${info ? info.mb + ' MB' : '?'} file size limit.`
    return
  }

  // Duration check
  const info = uploadLimitInfo.value
  if (info) {
    const durationSec = await getVideoDuration(file)
    if (durationSec !== null && durationSec > info.durationMinutes * 60) {
      const durationMin = Math.ceil(durationSec / 60)
      errorMessage.value = `"${file.name}" is ${durationMin} min long — your plan allows up to ${info.durationMinutes} min.`
      return
    }
  }

  selectedFile.value = file
  uploading.value = true
  uploadProgress.value = 0

  try {
    const progressInterval = setInterval(() => {
      if (uploadProgress.value < 90) uploadProgress.value += 10
    }, 500)

    const video = await uploadVideo(file) as any
    clearInterval(progressInterval)
    uploadProgress.value = 100
    await navigateTo(`/dashboard/videos/${video.id}`)
  } catch (e: any) {
    if (handleLimitError(e)) return
    errorMessage.value = e?.data?.message || e.message || 'Upload failed. Please try again.'
    uploading.value = false
    selectedFile.value = null
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(isFinite(video.duration) ? video.duration : null)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    video.src = url
  })
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-8">
    <div>
      <h1 class="text-3xl font-bold">Add Video</h1>
      <p class="text-muted-foreground mt-1">Paste a YouTube link or upload your own video</p>
    </div>

    <!-- ═══════════════ MODE SELECTOR ═══════════════ -->
    <div class="grid grid-cols-2 gap-3">
      <!-- YouTube tab -->
      <button
        class="relative flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all cursor-pointer"
        :class="mode === 'youtube'
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border hover:border-primary/40'"
        @click="mode = 'youtube'"
      >
        <div
          class="flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
          :class="mode === 'youtube' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
        >
          <Link class="size-5" />
        </div>
        <div class="min-w-0">
          <div class="font-semibold text-sm flex items-center gap-1.5">
            YouTube Link
            <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-bold uppercase tracking-wide">
              <Zap class="size-2.5" /> Free
            </span>
          </div>
          <p class="text-xs text-muted-foreground mt-0.5">No upload needed ⚡</p>
        </div>
        <!-- Recommended badge -->
        <div
          v-if="mode === 'youtube'"
          class="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wide"
        >
          Recommended
        </div>
      </button>

      <!-- Upload tab -->
      <button
        class="relative flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all cursor-pointer"
        :class="mode === 'upload'
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border hover:border-primary/40'"
        @click="mode = 'upload'"
      >
        <div
          class="flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
          :class="mode === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
        >
          <Upload class="size-5" />
        </div>
        <div class="min-w-0">
          <div class="font-semibold text-sm flex items-center gap-1.5">
            Upload Video
            <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wide">
              <Crown class="size-2.5" /> Premium
            </span>
          </div>
          <p class="text-xs text-muted-foreground mt-0.5">Full video processing</p>
        </div>
      </button>
    </div>

    <!-- ═══════════════ YOUTUBE MODE ═══════════════ -->
    <Card v-if="mode === 'youtube'">
      <CardContent class="pt-6 space-y-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">YouTube URL</label>
          <div class="flex gap-2">
            <Input
              v-model="youtubeUrl"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              class="flex-1"
              :disabled="youtubeSubmitting"
              @keydown.enter="handleYoutubeSubmit"
            />
            <Button
              :disabled="youtubeSubmitting || !youtubeUrl.trim()"
              @click="handleYoutubeSubmit"
            >
              {{ youtubeSubmitting ? '⏳ Processing...' : '🚀 Go' }}
            </Button>
          </div>
        </div>

        <!-- How it works -->
        <div class="rounded-lg border border-dashed p-4 space-y-3">
          <p class="text-sm font-medium">How it works:</p>
          <ol class="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Paste any public YouTube video link</li>
            <li>We fetch the transcript automatically</li>
            <li>AI detects the most viral moments</li>
            <li>Get timestamped clips ready to share</li>
          </ol>
          <div class="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <Zap class="size-3 text-green-500" />
            <span>No video download or storage — <strong>completely free</strong></span>
          </div>
        </div>

        <!-- Error -->
        <div v-if="youtubeError" class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {{ youtubeError }}
        </div>
      </CardContent>
    </Card>

    <!-- ═══════════════ UPLOAD MODE ═══════════════ -->
    <Card v-if="mode === 'upload'">
      <CardContent class="pt-6 space-y-4">

        <!-- LOCKED STATE — Free users without credits -->
        <template v-if="!hasUploadAccess">
          <div class="rounded-lg border-2 border-dashed border-muted-foreground/20 p-8 text-center space-y-4">
            <div class="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Lock class="size-7 text-muted-foreground" />
            </div>
            <div class="space-y-2">
              <h3 class="text-lg font-semibold">Upload is a Premium feature</h3>
              <p class="text-sm text-muted-foreground max-w-md mx-auto">
                File uploads enable full video processing with frame-accurate clipping,
                subtitle burning, and smart vertical framing.
              </p>
            </div>
            <div class="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <NuxtLink to="/pricing">
                <Button size="lg" class="gap-2">
                  <Crown class="size-4" /> Upgrade to Upload
                </Button>
              </NuxtLink>
            </div>
            <p class="text-xs text-muted-foreground">
              Or earn a free upload by sharing — <button class="underline cursor-pointer" @click="mode = 'youtube'">try YouTube mode first</button>
            </p>
          </div>
        </template>

        <!-- UNLOCKED STATE — Premium users / users with credits -->
        <template v-else>
          <!-- Drop Zone (shown when not uploading) -->
          <div
            v-if="!uploading"
            class="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors"
            :class="dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
            @click="($refs.fileInput as HTMLInputElement).click()"
          >
            <input
              ref="fileInput"
              type="file"
              class="hidden"
              accept="video/*"
              @change="handleFileInput"
            />
            <div class="space-y-4">
              <div class="text-5xl">📤</div>
              <div>
                <p class="text-lg font-medium">Drop your video here or click to browse</p>
                <p class="text-sm text-muted-foreground mt-1">Upload starts automatically</p>
                <p class="text-sm text-muted-foreground mt-1">
                  MP4, MOV, AVI, WebM, MKV ·
                  <span v-if="uploadLimitInfo">
                    Max {{ uploadLimitInfo.durationMinutes }} min · {{ uploadLimitInfo.mb >= 1024 ? (uploadLimitInfo.mb / 1024) + ' GB' : uploadLimitInfo.mb + ' MB' }}
                  </span>
                  <span v-else>Unlimited</span>
                </p>
                <!-- Credit indicator -->
                <p v-if="!isPremium && (profile?.upload_credits ?? 0) > 0" class="text-xs text-green-600 dark:text-green-400 mt-2">
                  🎁 You have {{ profile?.upload_credits }} upload credit{{ (profile?.upload_credits ?? 0) > 1 ? 's' : '' }} remaining
                </p>
              </div>
            </div>
          </div>

          <!-- Uploading State -->
          <div v-if="uploading" class="space-y-4">
            <div class="flex items-center gap-4 p-4 rounded-lg bg-muted">
              <span class="text-3xl">🎬</span>
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">{{ selectedFile?.name }}</p>
                <p class="text-sm text-muted-foreground">{{ selectedFile ? formatFileSize(selectedFile.size) : '' }}</p>
              </div>
            </div>
            <div class="space-y-2">
              <Progress :model-value="uploadProgress" />
              <p class="text-sm text-muted-foreground text-center">Uploading... {{ uploadProgress }}%</p>
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="errorMessage" class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {{ errorMessage }}
          </div>
        </template>

        <!-- Premium feature highlights -->
        <div class="rounded-lg bg-muted/50 p-4">
          <p class="text-xs font-medium text-muted-foreground mb-2">Upload includes:</p>
          <div class="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span class="flex items-center gap-1.5"><span class="text-green-500">✓</span> Frame-accurate clipping</span>
            <span class="flex items-center gap-1.5"><span class="text-green-500">✓</span> Smart vertical framing</span>
            <span class="flex items-center gap-1.5"><span class="text-green-500">✓</span> Burned-in subtitles</span>
            <span class="flex items-center gap-1.5"><span class="text-green-500">✓</span> Downloadable MP4s</span>
          </div>
        </div>

      </CardContent>
    </Card>

    <!-- ═══════════════ UPGRADE DIALOG ═══════════════ -->
    <UpgradeDialog
      v-model:open="showUpgradeDialog"
      :type="limitPayload.type"
      :used="limitPayload.used"
      :limit="limitPayload.limit"
      :reset-date="limitPayload.resetDate"
    />
  </div>
</template>
