<script setup lang="ts">

const props = defineProps<{
  segments: Segment[]
  videoTitle?: string
}>()

const emit = defineEmits<{
  selectSegments: [selected: Segment[]]
}>()

const selectedIndexes = ref<Set<number>>(new Set(props.segments.map((_, i) => i)))

function toggleSegment(index: number) {
  const newSet = new Set(selectedIndexes.value)
  if (newSet.has(index)) {
    newSet.delete(index)
  } else {
    newSet.add(index)
  }
  selectedIndexes.value = newSet
}

function selectAll() {
  selectedIndexes.value = new Set(props.segments.map((_, i) => i))
}

function selectNone() {
  selectedIndexes.value = new Set()
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function downloadSegmentsJson() {
  const json = JSON.stringify(props.segments, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.videoTitle || 'segments'}_segments.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const selectedSegments = computed(() =>
  props.segments.filter((_, i) => selectedIndexes.value.has(i)),
)

watch(selectedSegments, (val) => {
  emit('selectSegments', val)
}, { immediate: true })
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        🔬 Segment Review
        <Badge variant="warning" class="text-xs">Dev Mode</Badge>
      </CardTitle>
      <CardDescription>
        Review AI-detected segments. Select which ones to convert into shorts.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- Controls -->
      <div class="flex items-center gap-3">
        <Button variant="outline" size="sm" @click="selectAll">Select All</Button>
        <Button variant="outline" size="sm" @click="selectNone">Select None</Button>
        <Button variant="outline" size="sm" @click="downloadSegmentsJson">
          📄 Download JSON
        </Button>
        <span class="text-xs text-muted-foreground ml-auto">
          {{ selectedIndexes.size }}/{{ segments.length }} selected
        </span>
      </div>

      <!-- Segment Cards -->
      <div class="space-y-2">
        <div
          v-for="(segment, i) in segments"
          :key="i"
          class="flex items-start gap-3 rounded-lg border p-3 transition-colors cursor-pointer"
          :class="selectedIndexes.has(i) ? 'border-primary bg-primary/5' : 'border-muted opacity-60'"
          @click="toggleSegment(i)"
        >
          <!-- Checkbox -->
          <div class="mt-0.5">
            <div
              class="h-5 w-5 rounded border-2 flex items-center justify-center transition-colors"
              :class="selectedIndexes.has(i) ? 'border-primary bg-primary' : 'border-muted'"
            >
              <span v-if="selectedIndexes.has(i)" class="text-white text-xs">✓</span>
            </div>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="font-medium text-sm">{{ segment.title }}</h4>
              <Badge variant="secondary" class="text-xs shrink-0">
                {{ Math.round(segment.score * 100) }}% viral
              </Badge>
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              {{ formatTime(segment.start) }} → {{ formatTime(segment.end) }}
              · {{ (segment.end - segment.start).toFixed(1) }}s
            </p>
          </div>

          <!-- Score bar -->
          <div class="w-16 flex-shrink-0">
            <div class="h-2 rounded-full bg-muted overflow-hidden">
              <div
                class="h-full rounded-full transition-all"
                :class="segment.score > 0.8 ? 'bg-green-500' : segment.score > 0.5 ? 'bg-yellow-500' : 'bg-red-500'"
                :style="{ width: `${segment.score * 100}%` }"
              />
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
