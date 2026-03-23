<script setup lang="ts">
const props = defineProps<{
  steps: Record<string, 'pending' | 'loading' | 'done' | 'error'> | null
  currentStatus: string
  failedAtStep?: string | null
  errorMessage?: string | null
  // For download buttons
  hasTranscript?: boolean
  hasSegments?: boolean
}>()

const emit = defineEmits<{
  downloadTranscript: []
  downloadSubtitlesSrt: []
  downloadSubtitlesVtt: []
  downloadSegments: []
}>()

interface StepDisplay {
  key: string
  label: string
  icon: string
  downloadable?: 'transcript' | 'subtitles' | 'segments'
}

const stepDefinitions: StepDisplay[] = [
  { key: 'extracting_audio', label: 'Extracting audio', icon: '🎵' },
  { key: 'transcribing', label: 'Transcribing speech', icon: '📝', downloadable: 'transcript' },
  { key: 'detecting_segments', label: 'AI detecting best moments', icon: '🤖', downloadable: 'segments' },
  { key: 'processing_video', label: 'Creating vertical shorts', icon: '🎬' },
  { key: 'burning_subtitles', label: 'Adding subtitles', icon: '✏️', downloadable: 'subtitles' },
  { key: 'uploading', label: 'Uploading results', icon: '📤' },
]

function getStepState(step: StepDisplay): 'pending' | 'loading' | 'done' | 'error' {
  // If steps JSONB is available, use it directly
  if (props.steps && props.steps[step.key]) {
    return props.steps[step.key]!
  }

  // Fallback: derive from currentStatus
  const order = stepDefinitions.map((s) => s.key)
  const currentIdx = order.indexOf(props.currentStatus)
  const stepIdx = order.indexOf(step.key)

  if (props.currentStatus === 'completed') return 'done'
  if (props.currentStatus === 'failed') {
    if (props.failedAtStep === step.key) return 'error'
    if (stepIdx < order.indexOf(props.failedAtStep || '')) return 'done'
    return 'pending'
  }

  if (stepIdx < currentIdx) return 'done'
  if (stepIdx === currentIdx) return 'loading'
  return 'pending'
}

function getStateIcon(state: 'pending' | 'loading' | 'done' | 'error'): string {
  switch (state) {
    case 'done': return '✅'
    case 'loading': return '⏳'
    case 'error': return '❌'
    default: return '⬜'
  }
}

function canDownload(step: StepDisplay): boolean {
  const state = getStepState(step)
  if (state !== 'done' && state !== 'error') return false

  if (step.downloadable === 'transcript') return !!props.hasTranscript
  if (step.downloadable === 'segments') return !!props.hasSegments
  if (step.downloadable === 'subtitles') return !!props.hasTranscript
  return false
}

function handleDownload(step: StepDisplay) {
  if (step.downloadable === 'transcript') emit('downloadTranscript')
  if (step.downloadable === 'subtitles') emit('downloadSubtitlesSrt')
  if (step.downloadable === 'segments') emit('downloadSegments')
}
</script>

<template>
  <div class="space-y-1">
    <div
      v-for="step in stepDefinitions"
      :key="step.key"
      class="flex items-center justify-between rounded-lg px-3 py-2 transition-colors"
      :class="{
        'bg-primary/5': getStepState(step) === 'loading',
        'bg-destructive/5': getStepState(step) === 'error',
      }"
    >
      <div class="flex items-center gap-3">
        <!-- State icon -->
        <span
          class="text-sm w-5 text-center"
          :class="{ 'animate-pulse': getStepState(step) === 'loading' }"
        >
          {{ getStateIcon(getStepState(step)) }}
        </span>

        <!-- Step icon & label -->
        <span class="text-sm">{{ step.icon }}</span>
        <span
          class="text-sm"
          :class="{
            'font-medium': getStepState(step) === 'loading',
            'text-muted-foreground': getStepState(step) === 'pending',
            'text-destructive': getStepState(step) === 'error',
          }"
        >
          {{ step.label }}
        </span>
      </div>

      <!-- Download button for steps that produce downloadable output -->
      <button
        v-if="canDownload(step)"
        class="text-xs text-primary hover:text-primary/80 underline underline-offset-2 cursor-pointer"
        @click="handleDownload(step)"
      >
        ⬇️ Download
      </button>
    </div>

    <!-- Error details -->
    <div v-if="errorMessage && currentStatus === 'failed'" class="mt-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
      <p class="font-medium">Error: {{ errorMessage }}</p>
    </div>
  </div>
</template>
