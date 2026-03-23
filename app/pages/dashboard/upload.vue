<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
})

const { uploadVideo, uploadVideoBatch } = useVideos()
const { profile, canProcessVideo, fetchProfile, getUploadLimit, getUploadLimitInfo } = useProfile()

// Computed limits for the current user plan
const uploadLimitInfo = computed(() => getUploadLimitInfo())
const uploadLimitBytes = computed(() => getUploadLimit())

const uploading = ref(false)
const dragOver = ref(false)
const uploadProgress = ref(0)
const uploadCurrent = ref(0)
const errorMessage = ref('')
const selectedFiles = ref<File[]>([])

onMounted(() => {
  fetchProfile()
})

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
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    addFiles(Array.from(files))
  }
}

function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    addFiles(Array.from(input.files))
  }
}

function addFiles(files: File[]) {
  const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska']
  const limitBytes = uploadLimitBytes.value
  const errors: string[] = []

  for (const file of files) {
    if (!validTypes.includes(file.type)) {
      errors.push(`"${file.name}" is not a supported video format.`)
      continue
    }
    if (limitBytes !== Infinity && file.size > limitBytes) {
      const info = uploadLimitInfo.value
      const limitLabel = info ? `${info.mb} MB` : '?'
      errors.push(`"${file.name}" exceeds the ${limitLabel} limit.`)
      continue
    }
    // Avoid duplicates
    if (!selectedFiles.value.some((f: File) => f.name === file.name && f.size === file.size)) {
      selectedFiles.value.push(file)
    }
  }

  if (errors.length > 0) {
    errorMessage.value = errors.join(' ')
  } else {
    errorMessage.value = ''
  }
}

function removeFile(index: number) {
  selectedFiles.value.splice(index, 1)
}

async function handleUpload() {
  if (selectedFiles.value.length === 0) return

  if (!canProcessVideo()) {
    errorMessage.value = 'You have reached your monthly video limit. Please upgrade your plan.'
    return
  }

  uploading.value = true
  uploadProgress.value = 0
  uploadCurrent.value = 0
  errorMessage.value = ''

  try {
    if (selectedFiles.value.length === 1) {
      // Single file: navigate directly to its page
      const progressInterval = setInterval(() => {
        if (uploadProgress.value < 90) uploadProgress.value += 10
      }, 500)

      const video = await uploadVideo(selectedFiles.value[0]!) as any
      clearInterval(progressInterval)
      uploadProgress.value = 100
      await navigateTo(`/dashboard/videos/${video.id}`)
    } else {
      // Batch: upload sequentially and go to dashboard
      const videos = await uploadVideoBatch(selectedFiles.value, (idx: number, total: number) => {
        uploadCurrent.value = idx + 1
        uploadProgress.value = Math.round(((idx) / total) * 100)
      })
      uploadProgress.value = 100
      await navigateTo('/dashboard')
    }
  } catch (e: any) {
    errorMessage.value = e.message || 'Upload failed. Please try again.'
    uploading.value = false
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-8">
    <div>
      <h1 class="text-3xl font-bold">Upload Videos</h1>
      <p class="text-muted-foreground mt-1">Upload one or more horizontal videos to generate shorts</p>
    </div>

    <!-- Quota Warning -->
    <div v-if="profile && !canProcessVideo()" class="rounded-lg border border-destructive bg-destructive/10 p-4">
      <p class="text-sm font-medium text-destructive">
        You've used all {{ profile.monthly_video_limit }} videos this month.
        <NuxtLink to="/pricing" class="underline">Upgrade your plan</NuxtLink> for more.
      </p>
    </div>

    <!-- Upload Zone -->
    <Card>
      <CardContent class="pt-6">
        <div
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
            multiple
            @change="handleFileInput"
          />
          <div class="space-y-4">
            <div class="text-5xl">📤</div>
            <div>
              <p class="text-lg font-medium">Drop your videos here or click to browse</p>
              <p class="text-sm text-muted-foreground mt-1">
                MP4, MOV, AVI, WebM, MKV • You can select multiple files •
                <span v-if="uploadLimitInfo">
                  Max {{ uploadLimitInfo.mb }} MB each (≈ {{ uploadLimitInfo.minutes }} min)
                  <NuxtLink v-if="profile?.subscription_plan === 'free'" to="/pricing" class="underline ml-1">Upgrade</NuxtLink>
                </span>
                <span v-else>Unlimited</span>
              </p>
            </div>
          </div>
        </div>

        <!-- Selected Files List -->
        <div v-if="selectedFiles.length > 0" class="mt-4 space-y-4">
          <div class="space-y-2">
            <div v-for="(file, idx) in selectedFiles" :key="file.name + file.size" class="flex items-center gap-4 p-3 rounded-lg bg-muted">
              <span class="text-2xl">🎬</span>
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate text-sm">{{ file.name }}</p>
                <p class="text-xs text-muted-foreground">{{ formatFileSize(file.size) }}</p>
              </div>
              <Button variant="ghost" size="sm" @click="removeFile(idx)" :disabled="uploading">
                ✕
              </Button>
            </div>
          </div>

          <!-- Upload Progress -->
          <div v-if="uploading" class="space-y-2">
            <Progress :model-value="uploadProgress" />
            <p class="text-sm text-muted-foreground text-center">
              <template v-if="selectedFiles.length > 1">
                Uploading {{ uploadCurrent }} of {{ selectedFiles.length }}... {{ uploadProgress }}%
              </template>
              <template v-else>
                Uploading... {{ uploadProgress }}%
              </template>
            </p>
          </div>

          <!-- Upload Button -->
          <Button
            v-if="!uploading"
            class="w-full"
            size="lg"
            @click="handleUpload"
          >
            🚀 Upload {{ selectedFiles.length > 1 ? `${selectedFiles.length} Videos` : '& Continue' }}
          </Button>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {{ errorMessage }}
        </div>
      </CardContent>
    </Card>
  </div>
</template>
