<script setup lang="ts">
import { computed } from 'vue'
import type { SubtitleSettings } from '~/types/database'
import { SUBTITLE_RANGES, PHONE_PREVIEW } from '~/lib/overlayConfig'

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
  'Arial', 'Helvetica', 'Impact', 'Georgia',
  'Verdana', 'Courier New', 'Comic Sans MS', 'Trebuchet MS',
]

const positionOptions = [
  { label: 'Bottom', alignment: 2, marginV: 12 },
  { label: 'Top', alignment: 8, marginV: 12 },
  { label: 'Middle', alignment: 5, marginV: 0 },
]

const activeAlignment = computed(() =>
  positionOptions.find(p => p.alignment === settings.value.alignment)?.alignment
  ?? positionOptions[0]!.alignment,
)

function setPosition(option: typeof positionOptions[number]) {
  emit('update:modelValue', { ...props.modelValue, alignment: option.alignment, marginV: option.marginV })
}

const previewSample = computed(() => props.sampleText || 'Your subtitle text\nwill appear here')

// ─── Phone mockup scale math ─────────────────────────────────────────────────
// fontSize and marginV are stored as "phone screen pixels" (390px-wide reference).
// We render the mockup at phone dimensions and CSS-scale down to DISPLAY_H.
// This gives accurate 1:1 preview — what you set is what you see on a real phone.
const DISPLAY_H = 640
const phoneScale = DISPLAY_H / PHONE_PREVIEW.height   // 640/844 ≈ 0.758
const displayW = Math.round(PHONE_PREVIEW.width * phoneScale) // ≈ 296

// ─── Subtitle text style in phone screen-pixel space ─────────────────────────
const phoneSubtitleStyle = computed(() => {
  const s = settings.value
  return {
    fontFamily: s.fontName,
    fontSize: `${s.fontSize}px`,
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
    lineHeight: '1.4',
    maxWidth: '100%',
    whiteSpace: 'pre-line' as const,
  }
})

// Position in the phone-sized container (marginV is in phone screen pixels)
const phoneSubtitlePositionStyle = computed(() => {
  const s = settings.value
  const isBottom = s.alignment <= 3
  const isTop = s.alignment >= 7
  const base = { position: 'absolute' as const, left: '0', right: '0', display: 'flex', justifyContent: 'center', padding: '0 24px' }
  if (isBottom) return { ...base, bottom: `${s.marginV + 20}px` }
  if (isTop)    return { ...base, top: `${s.marginV + 44}px` }
  return { ...base, top: '50%', transform: 'translateY(-50%)' }
})
</script>

<template>
  <!-- 2-column on desktop: settings left · phone mockup right (sticky) -->
  <div class="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">

    <!-- ───────────────────────────── LEFT: Settings (2/3) ────────────────── -->
    <div class="w-full lg:w-2/3 min-w-0 space-y-5">
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
            min="14" max="60" step="1"
            class="w-full accent-primary mt-3"
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
            :class="activeAlignment === option.alignment ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'"
            @click="setPosition(option)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <!-- Margin -->
      <div class="space-y-2">
        <Label class="text-sm font-medium">Margin from edge: {{ settings.marginV }}px</Label>
        <input
          type="range"
          :value="settings.marginV"
          :min="SUBTITLE_RANGES.marginV.min"
          :max="SUBTITLE_RANGES.marginV.max"
          :step="SUBTITLE_RANGES.marginV.step"
          class="w-full accent-primary"
          @input="update('marginV', Number(($event.target as HTMLInputElement).value))"
        />
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
            <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" :class="settings.bold ? 'translate-x-6' : 'translate-x-1'" />
          </button>
        </div>
      </div>
    </div>

    <!-- ───────────────────────── RIGHT: Phone mockup (1/3, sticky) ──────── -->
    <div class="w-full lg:w-1/3 flex flex-col items-center gap-3 lg:sticky lg:top-4">

      <!-- Header -->
      <div class="flex w-full items-center justify-between" :style="{ width: displayW + 'px' }">
        <span class="text-sm font-medium">Live Preview</span>
        <span class="text-xs text-muted-foreground">1080×1920</span>
      </div>

      <!-- Outer wrapper: reserves the final CSS footprint -->
      <div
        class="relative"
        :style="{ width: displayW + 'px', height: DISPLAY_H + 'px' }"
      >
        <!-- Phone-sized container, CSS-scaled to DISPLAY_H —
             fontSize/marginV in the settings are phone screen pixels so they
             render here at exactly the right visual proportion. -->
        <div
          class="absolute top-0 left-0 overflow-hidden"
          :style="{
            width: PHONE_PREVIEW.width + 'px',
            height: PHONE_PREVIEW.height + 'px',
            transform: `scale(${phoneScale})`,
            transformOrigin: 'top left',
            borderRadius: '44px',
            border: '3px solid rgb(71 85 105)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.55)',
            background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 50%, #000 100%)',
          }"
        >
          <!-- Abstract video background: colored blur blobs -->
          <div class="absolute inset-0 overflow-hidden">
            <div class="absolute top-20 left-8 w-56 h-56 rounded-full opacity-30" style="background: radial-gradient(circle, #6366f1, transparent); filter: blur(40px);" />
            <div class="absolute top-40 right-8 w-48 h-48 rounded-full opacity-25" style="background: radial-gradient(circle, #ec4899, transparent); filter: blur(35px);" />
            <div class="absolute bottom-48 left-16 w-40 h-40 rounded-full opacity-20" style="background: radial-gradient(circle, #06b6d4, transparent); filter: blur(30px);" />
            <!-- Faint person silhouette -->
            <div class="absolute bottom-24 left-1/2 -translate-x-1/2 opacity-[0.07]" style="width: 120px; height: 280px; background: linear-gradient(180deg, white 0%, rgba(255,255,255,0.4) 100%); border-radius: 60px 60px 30px 30px;" />
          </div>

          <!-- Subtitle layer (positioned at full render resolution) -->
          <div :style="phoneSubtitlePositionStyle">
            <div :style="phoneSubtitleStyle">
              {{ previewSample }}
            </div>
          </div>

          <!-- Home indicator -->
          <div class="absolute left-1/2 -translate-x-1/2 bg-white/40 rounded-full" style="bottom: 8px; width: 134px; height: 5px;" />
        </div>
      </div>

      <!-- Scale info -->
      <p class="text-xs text-muted-foreground tabular-nums">
        {{ Math.round(phoneScale * 100) }}% scale &middot; {{ PHONE_PREVIEW.width }}&times;{{ PHONE_PREVIEW.height }}pt
      </p>
    </div>

  </div>
</template>
