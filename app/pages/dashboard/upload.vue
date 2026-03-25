<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
})

const { uploadVideo } = useVideos()
const { profile, fetchProfile, getUploadLimit, getUploadLimitInfo } = useProfile()
const { showUpgradeDialog, limitPayload, handleLimitError } = useUsageLimits()

const uploadLimitInfo = computed(() => getUploadLimitInfo())
const uploadLimitBytes = computed(() => getUploadLimit())

const uploading = ref(false)
const dragOver = ref(false)
const uploadProgress = ref(0)
const errorMessage = ref('')
const selectedFile = ref<File | null>(null)

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
    errorMessage.value = `"${file.name}" exceeds the ${info ? info.mb + ' MB' : '?'} limit.`
    return
  }

  selectedFile.value = file

  // Auto-upload immediately after validation
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
    if (!handleLimitError(e)) {
      errorMessage.value = e?.data?.message || e.message || 'Upload failed. Please try again.'
    }
    uploading.value = false
    selectedFile.value = null
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
      <h1 class="text-3xl font-bold">Upload Video</h1>
      <p class="text-muted-foreground mt-1">Upload a horizontal video to generate shorts</p>
    </div>

    <Card>
      <CardContent class="pt-6 space-y-4">

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
                  Max {{ uploadLimitInfo.mb }} MB
                  <NuxtLink v-if="profile?.subscription_plan === 'free'" to="/pricing" class="underline ml-1">Upgrade</NuxtLink>
                </span>
                <span v-else>Unlimited size</span>
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

      </CardContent>
    </Card>

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
