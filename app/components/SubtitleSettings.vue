<script setup lang="ts">
import type { SubtitleSettings } from '~/types/database'

const props = defineProps<{
  modelValue: SubtitleSettings
  sampleText?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: SubtitleSettings]
}>()

const settings = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

function update<K extends keyof SubtitleSettings>(key: K, value: SubtitleSettings[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

const fontOptions = [
  'Arial',
  'Helvetica',
  'Impact',
  'Georgia',
  'Verdana',
  'Courier New',
  'Comic Sans MS',
  'Trebuchet MS',
]

const positionOptions = [
  { label: 'Bottom Center', alignment: 2, marginV: 60 },
  { label: 'Top Center', alignment: 8, marginV: 40 },
  { label: 'Middle Center', alignment: 5, marginV: 0 },
]

const activePosition = computed(() => {
  return positionOptions.find(
    (p) => p.alignment === settings.value.alignment,
  ) ?? positionOptions[0]
})

function setPosition(option: typeof positionOptions[number]) {
  emit('update:modelValue', {
    ...props.modelValue,
    alignment: option.alignment,
    marginV: option.marginV,
  })
}

const previewSample = computed(() => props.sampleText || 'This is how your subtitles will look')

// Live preview styles computed from current settings
const previewContainerStyle = computed(() => {
  const s = settings.value
  const justify =
    s.alignment >= 7 ? 'flex-start' :
    s.alignment >= 4 ? 'center' :
    'flex-end'
  return {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: justify,
    alignItems: 'center',
    paddingTop: s.alignment >= 7 ? `${Math.max(s.marginV / 3, 8)}px` : '0',
    paddingBottom: s.alignment <= 3 ? `${Math.max(s.marginV / 3, 8)}px` : '0',
  }
})

const previewTextStyle = computed(() => {
  const s = settings.value
  return {
    fontFamily: s.fontName,
    fontSize: `${Math.max(12, Math.min(s.fontSize, 40))}px`,
    fontWeight: s.bold ? '700' : '400',
    color: s.primaryColor,
    textShadow: `
      -${s.outline}px -${s.outline}px 0 ${s.outlineColor},
       ${s.outline}px -${s.outline}px 0 ${s.outlineColor},
      -${s.outline}px  ${s.outline}px 0 ${s.outlineColor},
       ${s.outline}px  ${s.outline}px 0 ${s.outlineColor}
    `,
    textAlign: 'center' as const,
    padding: '4px 12px',
    borderRadius: '4px',
    maxWidth: '90%',
    lineHeight: '1.4',
    animation: s.animated ? 'subtitle-pop 0.3s ease-out' : 'none',
  }
})
</script>

<template>
  <div class="space-y-5">
    <!-- Live Preview -->
    <div class="space-y-2">
      <div class="text-sm font-medium">Live Preview</div>
      <div
        class="relative aspect-[9/16] max-h-[280px] w-full rounded-lg bg-gradient-to-b from-slate-800 to-slate-900 overflow-hidden border border-border"
        :style="previewContainerStyle"
      >
        <!-- Simulated video frame lines -->
        <div class="absolute inset-0 flex items-center justify-center opacity-10">
          <div class="w-24 h-24 border-4 border-white rounded-full flex items-center justify-center">
            <div class="w-0 h-0 border-l-[16px] border-l-white border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent ml-1" />
          </div>
        </div>

        <!-- Subtitle text preview -->
        <div :style="previewTextStyle" :class="{ 'animate-bounce-once': settings.animated }">
          {{ previewSample }}
        </div>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <!-- Font Family -->
      <div class="space-y-2">
        <Label class="text-sm font-medium">Font</Label>
        <select
          :value="settings.fontName"
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @change="update('fontName', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="font in fontOptions" :key="font" :value="font" :style="{ fontFamily: font }">
            {{ font }}
          </option>
        </select>
      </div>

      <!-- Font Size -->
      <div class="space-y-2">
        <Label class="text-sm font-medium">Size: {{ settings.fontSize }}px</Label>
        <input
          type="range"
          :value="settings.fontSize"
          min="14"
          max="40"
          step="1"
          class="w-full accent-primary"
          @input="update('fontSize', Number(($event.target as HTMLInputElement).value))"
        />
      </div>

      <!-- Text Color -->
      <div class="space-y-2">
        <Label class="text-sm font-medium">Text Color</Label>
        <div class="flex items-center gap-2">
          <input
            type="color"
            :value="settings.primaryColor"
            class="h-10 w-14 rounded-md border border-input cursor-pointer"
            @input="update('primaryColor', ($event.target as HTMLInputElement).value)"
          />
          <Input
            :model-value="settings.primaryColor"
            class="flex-1 font-mono text-xs"
            @update:model-value="(v: string | number) => update('primaryColor', String(v))"
          />
        </div>
      </div>

      <!-- Outline Color -->
      <div class="space-y-2">
        <Label class="text-sm font-medium">Outline Color</Label>
        <div class="flex items-center gap-2">
          <input
            type="color"
            :value="settings.outlineColor"
            class="h-10 w-14 rounded-md border border-input cursor-pointer"
            @input="update('outlineColor', ($event.target as HTMLInputElement).value)"
          />
          <Input
            :model-value="settings.outlineColor"
            class="flex-1 font-mono text-xs"
            @update:model-value="(v: string | number) => update('outlineColor', String(v))"
          />
        </div>
      </div>
    </div>

    <!-- Position -->
    <div class="space-y-2">
      <Label class="text-sm font-medium">Position</Label>
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="option in positionOptions"
          :key="option.alignment"
          class="rounded-lg border-2 p-2 text-center text-sm transition-colors cursor-pointer"
          :class="activePosition.alignment === option.alignment ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'"
          @click="setPosition(option)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <!-- Bold toggle -->
      <div class="flex items-center justify-between rounded-lg border p-3">
        <Label class="text-sm font-medium">Bold Text</Label>
        <button
          class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer"
          :class="settings.bold ? 'bg-primary' : 'bg-muted'"
          @click="update('bold', !settings.bold)"
        >
          <span
            class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
            :class="settings.bold ? 'translate-x-6' : 'translate-x-1'"
          />
        </button>
      </div>

      <!-- Animation toggle -->
      <div class="flex items-center justify-between rounded-lg border p-3">
        <Label class="text-sm font-medium">Text Animation</Label>
        <button
          class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer"
          :class="settings.animated ? 'bg-primary' : 'bg-muted'"
          @click="update('animated', !settings.animated)"
        >
          <span
            class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
            :class="settings.animated ? 'translate-x-6' : 'translate-x-1'"
          />
        </button>
      </div>
    </div>

    <!-- Margin V (advanced) -->
    <div class="space-y-2">
      <Label class="text-sm font-medium">Bottom Margin: {{ settings.marginV }}px</Label>
      <input
        type="range"
        :value="settings.marginV"
        min="0"
        max="200"
        step="5"
        class="w-full accent-primary"
        @input="update('marginV', Number(($event.target as HTMLInputElement).value))"
      />
    </div>
  </div>
</template>

<style scoped>
@keyframes subtitle-pop {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.animate-bounce-once {
  animation: subtitle-pop 0.4s ease-out;
}
</style>
