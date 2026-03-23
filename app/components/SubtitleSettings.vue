<script setup lang="ts">
import { computed, ref, nextTick, watch } from 'vue'
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
  'Arial', 'Helvetica', 'Impact', 'Georgia',
  'Verdana', 'Courier New', 'Comic Sans MS', 'Trebuchet MS',
]

const positionOptions = [
  { label: 'Bottom', alignment: 2, marginV: 60 },
  { label: 'Top', alignment: 8, marginV: 40 },
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

// ─── Phone mockup scale math (iPhone 14: 390×844 logical px) ─────────────────
const PHONE_W = 390
const PHONE_H = 844
const DISPLAY_H = 420          // rendered CSS px
const phoneScale = DISPLAY_H / PHONE_H   // ≈ 0.498 (~50%)
const displayW = Math.round(PHONE_W * phoneScale) // ≈ 194

// ─── Subtitle text style at full phone logical resolution ─────────────────────
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
    padding: '8px 20px',
    lineHeight: '1.5',
    maxWidth: '100%',
    whiteSpace: 'pre-line' as const,
  }
})

// marginV is in ASS units measured against 1080-tall video → remap to 844 phone height
const phoneSubtitlePositionStyle = computed(() => {
  const s = settings.value
  const mappedMargin = Math.round(s.marginV * (PHONE_H / 1080))
  const isBottom = s.alignment <= 3
  const isTop = s.alignment >= 7
  const base = { position: 'absolute' as const, left: '0', right: '0', display: 'flex', justifyContent: 'center', padding: '0 24px' }
  if (isBottom) return { ...base, bottom: `${Math.max(mappedMargin + 34, 44)}px` }
  if (isTop)    return { ...base, top: `${Math.max(mappedMargin + 54, 62)}px` }
  return { ...base, top: '50%', transform: 'translateY(-50%)' }
})

// ─── Animation control ────────────────────────────────────────────────────────
const animationKey = ref(0)
const isAnimatingPreview = ref(false)
let animTimer: ReturnType<typeof setTimeout> | null = null

function playAnimation() {
  if (animTimer) clearTimeout(animTimer)
  isAnimatingPreview.value = false
  nextTick(() => {
    animationKey.value++
    isAnimatingPreview.value = true
    animTimer = setTimeout(() => { isAnimatingPreview.value = false }, 700)
  })
}

// Auto-play preview when animation is toggled on
watch(() => settings.value.animated, (val) => {
  if (val) playAnimation()
  else animationKey.value++
})

// Reset animation key on any style change
watch(
  () => [
    settings.value.fontName, settings.value.fontSize, settings.value.primaryColor,
    settings.value.outlineColor, settings.value.bold, settings.value.alignment, settings.value.marginV,
  ],
  () => { animationKey.value++ },
)
</script>

<template>
  <!-- 2-column on desktop: settings left · phone mockup right (sticky) -->
  <div class="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">

    <!-- ───────────────────────────── LEFT: Settings ──────────────────────── -->
    <div class="flex-1 min-w-0 space-y-5">
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
          min="0" max="200" step="5"
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

        <!-- Animation toggle -->
        <div class="flex items-center justify-between rounded-lg border p-3">
          <Label class="text-sm font-medium">Text Animation</Label>
          <button
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer"
            :class="settings.animated ? 'bg-primary' : 'bg-muted'"
            @click="update('animated', !settings.animated)"
          >
            <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" :class="settings.animated ? 'translate-x-6' : 'translate-x-1'" />
          </button>
        </div>
      </div>
    </div>

    <!-- ───────────────────────── RIGHT: Phone mockup (sticky) ────────────── -->
    <div class="flex-shrink-0 flex flex-col items-center gap-3 lg:sticky lg:top-4">

      <!-- Header: label + play button -->
      <div class="flex w-full items-center justify-between" :style="{ width: displayW + 'px' }">
        <span class="text-sm font-medium">Live Preview</span>
        <button
          class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border bg-primary/5 border-primary/30 hover:bg-primary/15 text-primary font-medium transition-colors cursor-pointer select-none"
          @click="playAnimation"
        >
          &#9654; Play
        </button>
      </div>

      <!-- Outer wrapper: reserves the final CSS footprint -->
      <div
        class="relative"
        :style="{ width: displayW + 'px', height: DISPLAY_H + 'px' }"
      >
        <!-- Full-size logical phone, scaled down via CSS transform -->
        <div
          class="absolute top-0 left-0 overflow-hidden"
          :style="{
            width: PHONE_W + 'px',
            height: PHONE_H + 'px',
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

          <!-- Status bar -->
          <div class="absolute top-0 left-0 right-0 z-20" style="height: 54px;">
            <!-- Dynamic Island -->
            <div class="absolute top-3 left-1/2 -translate-x-1/2 bg-black rounded-full z-30" style="width: 126px; height: 36px;" />
            <!-- Time -->
            <div class="absolute text-white font-semibold" style="bottom: 8px; left: 26px; font-size: 15px; letter-spacing: -0.3px;">9:41</div>
            <!-- Signal / wifi / battery -->
            <div class="absolute flex items-center gap-2" style="bottom: 10px; right: 24px;">
              <div class="flex items-end gap-px" style="height: 13px;">
                <div v-for="h in [5, 7, 9, 12]" :key="h" class="w-1 bg-white rounded-sm" :style="{ height: h + 'px' }" />
              </div>
              <svg width="16" height="12" viewBox="0 0 16 12" fill="white">
                <circle cx="8" cy="10.5" r="1.2" />
                <path d="M5.2 7.8A4 4 0 0 1 8 6.5a4 4 0 0 1 2.8 1.3" stroke="white" stroke-width="1.3" fill="none" stroke-linecap="round" />
                <path d="M2.5 5A7.5 7.5 0 0 1 8 3a7.5 7.5 0 0 1 5.5 2" stroke="white" stroke-width="1.3" fill="none" stroke-linecap="round" />
              </svg>
              <div class="flex items-center">
                <div class="rounded-sm" style="width: 24px; height: 12px; border: 1.5px solid rgba(255,255,255,0.8); padding: 2px;">
                  <div class="bg-white rounded-sm h-full" style="width: 72%;" />
                </div>
                <div class="bg-white/50 rounded-r" style="width: 2px; height: 6px; margin-left: 1px;" />
              </div>
            </div>
          </div>

          <!-- Subtitle layer (positioned at full logical resolution) -->
          <div :style="phoneSubtitlePositionStyle">
            <div
              :key="animationKey"
              :style="phoneSubtitleStyle"
              :class="{ 'animate-subtitle-pop': isAnimatingPreview || settings.animated }"
            >
              {{ previewSample }}
            </div>
          </div>

          <!-- Home indicator -->
          <div class="absolute left-1/2 -translate-x-1/2 bg-white/40 rounded-full" style="bottom: 8px; width: 134px; height: 5px;" />
        </div>
      </div>

      <!-- Scale info -->
      <p class="text-xs text-muted-foreground tabular-nums">
        {{ Math.round(phoneScale * 100) }}% scale &middot; 390&times;844pt
      </p>
    </div>

  </div>
</template>

<style scoped>
@keyframes subtitle-pop {
  0%   { transform: scale(0.65) translateY(6px); opacity: 0; }
  55%  { transform: scale(1.07) translateY(0);   opacity: 1; }
  100% { transform: scale(1)    translateY(0);   opacity: 1; }
}
.animate-subtitle-pop {
  animation: subtitle-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
</style>
