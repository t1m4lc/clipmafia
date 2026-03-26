<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import {
  SUBTITLE_RANGES, RENDER, WATERMARK_CONFIG, getWatermarkAlignment,
  KINETIC_PRESETS,
  type SubtitleMode, type KineticAnimation, type UpcomingWordVisibility,
} from '~/lib/overlayConfig'

const props = defineProps<{
  modelValue: SubtitleSettings
  sampleText?: string
  showWatermark?: boolean
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

function applyPreset(presetKey: string) {
  const preset = KINETIC_PRESETS[presetKey]
  if (!preset) return
  emit('update:modelValue', { ...props.modelValue, ...preset.config })
}

const fontOptions = [
  'Arial', 'Helvetica', 'Impact', 'Georgia',
  'Verdana', 'Courier New', 'Comic Sans MS', 'Trebuchet MS',
]

const positionOptions = [
  { label: 'Bottom', alignment: 2, marginV: 50 },
  { label: 'Top', alignment: 8, marginV: 50 },
  { label: 'Middle', alignment: 5, marginV: 0 },
]

const modeOptions: { label: string; value: SubtitleMode; desc: string }[] = [
  { label: '📝 Classic', value: 'classic', desc: 'Block subtitles' },
  { label: '✨ Kinetic', value: 'kinetic', desc: 'Word-by-word highlight' },
]

const animationOptions: { label: string; value: KineticAnimation }[] = [
  { label: 'None', value: 'none' },
  { label: 'Fade in', value: 'fade' },
  { label: 'Pop', value: 'pop' },
  { label: 'Bounce', value: 'bounce' },
]

const upcomingOptions: { label: string; value: UpcomingWordVisibility }[] = [
  { label: 'Hidden', value: 'hidden' },
  { label: 'Faded', value: 'faded' },
]

const isKinetic = computed(() => settings.value.subtitleMode === 'kinetic')

const activeAlignment = computed(() =>
  positionOptions.find(p => p.alignment === settings.value.alignment)?.alignment
  ?? positionOptions[0]!.alignment,
)

function setPosition(option: typeof positionOptions[number]) {
  emit('update:modelValue', { ...props.modelValue, alignment: option.alignment, marginV: option.marginV })
}

// ─── Kinetic preview animation ──────────────────────────────────────────────
const SAMPLE_WORDS = ['Create', 'highly', 'engaging', 'subtitles', 'that', 'boost', 'retention', 'now']
const activeWordIndex = ref(0)
let animInterval: ReturnType<typeof setInterval> | null = null

function startKineticPreview() {
  stopKineticPreview()
  activeWordIndex.value = 0
  // Single-word mode: faster cycling (one word at a time)
  const interval = (settings.value.maxWordsOnScreen ?? 8) <= 2 ? 380 : 480
  animInterval = setInterval(() => {
    activeWordIndex.value = (activeWordIndex.value + 1) % SAMPLE_WORDS.length
  }, interval)
}

function stopKineticPreview() {
  if (animInterval) {
    clearInterval(animInterval)
    animInterval = null
  }
}

watch(isKinetic, (val) => {
  if (val) startKineticPreview()
  else stopKineticPreview()
}, { immediate: true })

onUnmounted(() => stopKineticPreview())

// Preview: split SAMPLE_WORDS into lines respecting maxWordsOnScreen and maxWordsPerLine
const previewLines = computed(() => {
  const maxOnScreen = settings.value.maxWordsOnScreen || 8
  const wpl = maxOnScreen === 1 ? 1 : (settings.value.maxWordsPerLine || 4)
  const maxLines = maxOnScreen === 1 ? 1 : (settings.value.maxLinesPerBlock || 2)
  // How many words to actually show in the preview block
  const totalVisible = Math.min(maxOnScreen, SAMPLE_WORDS.length)
  const words = SAMPLE_WORDS.slice(0, totalVisible)
  const lines: string[][] = []
  for (let i = 0; i < words.length && lines.length < maxLines; i += wpl) {
    lines.push(words.slice(i, i + wpl))
  }
  return lines
})

// How many total words are visible in the preview block
const visibleWordCount = computed(() => previewLines.value.flat().length)

const previewSample = computed(() => {
  if (isKinetic.value) return '' // handled by kinetic word spans
  return props.sampleText || 'Your subtitle text\nwill appear here'
})

// ─── Preview scale math ─────────────────────────────────────────────────────
const DISPLAY_H = 640
const previewScale = DISPLAY_H / RENDER.height
const displayW = Math.round(RENDER.width * previewScale)

// ─── Subtitle text style (in video pixels, scaled down by CSS transform) ──
const subtitleStyle = computed(() => {
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
    padding: '8px 30px',
    lineHeight: '1.4',
    maxWidth: '100%',
    whiteSpace: 'pre-line' as const,
    ...(s.backgroundStyle === 'box' ? {
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: '12px',
      padding: '12px 30px',
    } : {}),
  }
})

// Position in the 1080×1920 container
const subtitlePositionStyle = computed(() => {
  const s = settings.value
  const isBottom = s.alignment <= 3
  const isTop = s.alignment >= 7
  const base = { position: 'absolute' as const, left: '0', right: '0', display: 'flex', justifyContent: 'center', padding: '0 60px' }
  if (isBottom) return { ...base, bottom: `${s.marginV + 40}px` }
  if (isTop)    return { ...base, top: `${s.marginV + 80}px` }
  return { ...base, top: '50%', transform: 'translateY(-50%)' }
})

// Watermark position
const watermarkPositionStyle = computed(() => {
  const al = getWatermarkAlignment(settings.value.alignment)
  const base = {
    position: 'absolute' as const,
    left: '0', right: '0',
    textAlign: 'center' as const,
    fontSize: `${WATERMARK_CONFIG.fontSize}px`,
    fontFamily: 'Arial, sans-serif',
    fontWeight: '400',
    color: '#FFFFFF',
    opacity: WATERMARK_CONFIG.opacity,
    textShadow: '-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, 2px 2px 4px rgba(0,0,0,0.6)',
    pointerEvents: 'none' as const,
    letterSpacing: '0.5px',
  }
  return al === 8
    ? { ...base, top: `${WATERMARK_CONFIG.marginV}px` }
    : { ...base, bottom: `${WATERMARK_CONFIG.marginV}px` }
})

// ─── Kinetic word style helpers ─────────────────────────────────────────────
// We use font-size scaling instead of CSS transform:scale so surrounding
// words naturally reflow around the highlighted word — no overlap.
function getWordStyle(globalIndex: number) {
  const s = settings.value
  const isActive = globalIndex === activeWordIndex.value % visibleWordCount.value
  const isPast = globalIndex < activeWordIndex.value % visibleWordCount.value

  const baseSize = s.fontSize
  const activeSize = Math.round(baseSize * s.highlightScale)

  if (isActive) {
    const transitionStyle =
      s.animationStyle === 'pop'
        ? 'font-size 0.12s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.1s ease, opacity 0.1s ease'
        : s.animationStyle === 'bounce'
          ? 'font-size 0.18s cubic-bezier(0.36, 0.07, 0.19, 0.97), color 0.1s ease, opacity 0.1s ease'
          : 'font-size 0.15s ease, color 0.15s ease, opacity 0.15s ease'
    return {
      color: s.highlightColor,
      fontWeight: '900' as const,
      display: 'inline-block',
      fontSize: `${activeSize}px`,
      lineHeight: '1.2',
      verticalAlign: 'middle',
      opacity: '1',
      transition: transitionStyle,
    }
  }

  if (isPast) {
    return {
      color: s.primaryColor,
      fontWeight: s.bold ? '700' as const : '400' as const,
      display: 'inline-block',
      fontSize: `${baseSize}px`,
      lineHeight: '1.2',
      verticalAlign: 'middle',
      opacity: '1',
      transition: 'font-size 0.1s ease, color 0.1s ease, opacity 0.1s ease',
    }
  }

  // Upcoming word
  if (s.upcomingWordVisibility === 'hidden') {
    return {
      color: 'transparent',
      fontWeight: s.bold ? '700' as const : '400' as const,
      display: 'inline-block',
      fontSize: `${baseSize}px`,
      lineHeight: '1.2',
      verticalAlign: 'middle',
      opacity: '0',
      transition: 'font-size 0.1s ease, color 0.1s ease, opacity 0.12s ease',
    }
  }
  // faded
  return {
    color: (s as any).fadeColor ?? s.primaryColor,
    fontWeight: s.bold ? '700' as const : '400' as const,
    display: 'inline-block',
    fontSize: `${baseSize}px`,
    lineHeight: '1.2',
    verticalAlign: 'middle',
    opacity: '1',
    transition: 'font-size 0.1s ease, color 0.1s ease, opacity 0.12s ease',
  }
}
</script>

<template>
  <!-- 2-column on desktop: settings left · phone mockup right (sticky) -->
  <div class="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">

    <!-- ───────────────────────────── LEFT: Settings (2/3) ────────────────── -->
    <div class="w-full lg:w-2/3 min-w-0 space-y-5">

      <!-- ── Caption Mode Selector ── -->
      <div class="space-y-2">
        <Label class="text-sm font-medium">Caption Style</Label>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="mode in modeOptions"
            :key="mode.value"
            class="rounded-lg border-2 p-3 text-center transition-colors cursor-pointer"
            :class="settings.subtitleMode === mode.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'"
            @click="update('subtitleMode', mode.value)"
          >
            <div class="text-sm font-medium">{{ mode.label }}</div>
            <div class="text-xs text-muted-foreground">{{ mode.desc }}</div>
          </button>
        </div>
      </div>

      <!-- ── Kinetic Presets (only in kinetic mode) ── -->
      <div v-if="isKinetic" class="space-y-2">
        <Label class="text-sm font-medium">Quick Presets</Label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(preset, key) in KINETIC_PRESETS"
            :key="key"
            class="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer hover:bg-primary/10 hover:border-primary/50"
            :title="preset.description"
            @click="applyPreset(key as string)"
          >
            {{ preset.label }}
          </button>
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
            :min="SUBTITLE_RANGES.fontSize.min" :max="SUBTITLE_RANGES.fontSize.max" :step="SUBTITLE_RANGES.fontSize.step"
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

      <!-- ── Kinetic-specific settings ── -->
      <template v-if="isKinetic">
        <div class="grid gap-4 sm:grid-cols-2">
          <!-- Highlight Color -->
          <div class="space-y-2">
            <Label class="text-sm font-medium">Highlight Color</Label>
            <div class="flex items-center gap-2">
              <input
                type="color"
                :value="settings.highlightColor"
                class="h-10 w-14 rounded-md border border-input cursor-pointer"
                @input="update('highlightColor', ($event.target as HTMLInputElement).value)"
              />
              <Input
                :model-value="settings.highlightColor"
                class="flex-1 font-mono text-xs"
                @update:model-value="(v: string | number) => update('highlightColor', String(v))"
              />
            </div>
          </div>

          <!-- Fade Color (upcoming words) -->
          <div class="space-y-2">
            <Label class="text-sm font-medium">Fade Color
              <span class="ml-1 text-xs font-normal text-muted-foreground">(upcoming words)</span>
            </Label>
            <div class="flex items-center gap-2">
              <input
                type="color"
                :value="(settings as any).fadeColor ?? '#888888'"
                class="h-10 w-14 rounded-md border border-input cursor-pointer"
                @input="update('fadeColor' as any, ($event.target as HTMLInputElement).value)"
              />
              <Input
                :model-value="(settings as any).fadeColor ?? '#888888'"
                class="flex-1 font-mono text-xs"
                @update:model-value="(v: string | number) => update('fadeColor' as any, String(v))"
              />
            </div>
          </div>

          <!-- Animation Style -->
          <div class="space-y-2">
            <Label class="text-sm font-medium">Animation</Label>
            <select
              :value="settings.animationStyle"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              @change="update('animationStyle', ($event.target as HTMLSelectElement).value as KineticAnimation)"
            >
              <option v-for="opt in animationOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <!-- Highlight Scale -->
          <div class="space-y-2">
            <Label class="text-sm font-medium">Highlight Scale: {{ (settings.highlightScale * 100).toFixed(0) }}%</Label>
            <input
              type="range"
              :value="settings.highlightScale"
              :min="SUBTITLE_RANGES.highlightScale.min"
              :max="SUBTITLE_RANGES.highlightScale.max"
              :step="SUBTITLE_RANGES.highlightScale.step"
              class="w-full accent-primary"
              @input="update('highlightScale', Number(($event.target as HTMLInputElement).value))"
            />
          </div>

          <!-- Upcoming Word Visibility -->
          <div class="space-y-2">
            <Label class="text-sm font-medium">Upcoming Words</Label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="opt in upcomingOptions"
                :key="opt.value"
                class="rounded-lg border-2 p-2 text-center text-sm transition-colors cursor-pointer"
                :class="settings.upcomingWordVisibility === opt.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'"
                @click="update('upcomingWordVisibility', opt.value)"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- Max Words Per Line -->
          <div class="space-y-2">
            <Label class="text-sm font-medium">Words per line: {{ settings.maxWordsPerLine }}</Label>
            <input
              type="range"
              :value="settings.maxWordsPerLine"
              :min="SUBTITLE_RANGES.maxWordsPerLine.min"
              :max="SUBTITLE_RANGES.maxWordsPerLine.max"
              :step="SUBTITLE_RANGES.maxWordsPerLine.step"
              class="w-full accent-primary"
              @input="update('maxWordsPerLine', Number(($event.target as HTMLInputElement).value))"
            />
          </div>

          <!-- Max Lines Per Block -->
          <div class="space-y-2">
            <Label class="text-sm font-medium">Max lines: {{ settings.maxLinesPerBlock }}</Label>
            <input
              type="range"
              :value="settings.maxLinesPerBlock"
              :min="SUBTITLE_RANGES.maxLinesPerBlock.min"
              :max="SUBTITLE_RANGES.maxLinesPerBlock.max"
              :step="SUBTITLE_RANGES.maxLinesPerBlock.step"
              class="w-full accent-primary"
              @input="update('maxLinesPerBlock', Number(($event.target as HTMLInputElement).value))"
            />
          </div>

          <!-- Max Words On Screen -->
          <div class="space-y-2 sm:col-span-2">
            <Label class="text-sm font-medium">
              Words on screen: <span class="font-bold">{{ settings.maxWordsOnScreen }}</span>
              <span class="ml-2 text-xs text-muted-foreground font-normal">
                {{ settings.maxWordsOnScreen === 1 ? '— TikTok style (1 word at a time)' : settings.maxWordsOnScreen <= 3 ? '— Reels style' : '— Phrase style' }}
              </span>
            </Label>
            <input
              type="range"
              :value="settings.maxWordsOnScreen"
              :min="SUBTITLE_RANGES.maxWordsOnScreen.min"
              :max="SUBTITLE_RANGES.maxWordsOnScreen.max"
              :step="SUBTITLE_RANGES.maxWordsOnScreen.step"
              class="w-full accent-primary"
              @input="update('maxWordsOnScreen', Number(($event.target as HTMLInputElement).value))"
            />
            <div class="flex justify-between text-xs text-muted-foreground">
              <span>1 word</span>
              <span>12 words</span>
            </div>
          </div>
        </div>

        <!-- Background Style -->
        <div class="space-y-2">
          <Label class="text-sm font-medium">Background</Label>
          <div class="grid grid-cols-2 gap-2">
            <button
              class="rounded-lg border-2 p-2 text-center text-sm transition-colors cursor-pointer"
              :class="settings.backgroundStyle === 'none' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'"
              @click="update('backgroundStyle', 'none')"
            >
              None
            </button>
            <button
              class="rounded-lg border-2 p-2 text-center text-sm transition-colors cursor-pointer"
              :class="settings.backgroundStyle === 'box' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'"
              @click="update('backgroundStyle', 'box')"
            >
              Box
            </button>
          </div>
        </div>
      </template>

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
        <span class="text-xs text-muted-foreground">{{ RENDER.width }}&times;{{ RENDER.height }}</span>
      </div>

      <!-- Outer wrapper -->
      <div
        class="relative overflow-hidden"
        :style="{ width: displayW + 'px', height: DISPLAY_H + 'px' }"
      >
        <div
          class="absolute top-0 left-0 overflow-hidden"
          :style="{
            width: RENDER.width + 'px',
            height: RENDER.height + 'px',
            transform: `scale(${previewScale})`,
            transformOrigin: 'top left',
            borderRadius: '120px',
            border: '8px solid rgb(71 85 105)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.55)',
            background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 50%, #000 100%)',
          }"
        >
          <!-- Abstract video background -->
          <div class="absolute inset-0 overflow-hidden">
            <div class="absolute rounded-full opacity-30" style="top: 55px; left: 22px; width: 430px; height: 430px; background: radial-gradient(circle, #6366f1, transparent); filter: blur(110px);" />
            <div class="absolute rounded-full opacity-25" style="top: 300px; right: 22px; width: 370px; height: 370px; background: radial-gradient(circle, #ec4899, transparent); filter: blur(95px);" />
            <div class="absolute rounded-full opacity-20" style="bottom: 200px; left: 80px; width: 310px; height: 310px; background: radial-gradient(circle, #06b6d4, transparent); filter: blur(80px);" />
            <div class="absolute left-1/2 -translate-x-1/2 opacity-[0.07]" style="bottom: 120px; width: 330px; height: 770px; background: linear-gradient(180deg, white 0%, rgba(255,255,255,0.4) 100%); border-radius: 165px 165px 80px 80px;" />
          </div>

          <!-- Subtitle layer -->
          <div :style="subtitlePositionStyle">
            <!-- Classic mode: static text block -->
            <div v-if="!isKinetic" :style="subtitleStyle">
              {{ previewSample }}
            </div>

            <!-- Kinetic mode: animated word-by-word -->
            <div v-else :style="subtitleStyle" class="kinetic-preview">
              <div v-for="(line, lineIdx) in previewLines" :key="lineIdx" style="display: block;">
                <span
                  v-for="(word, wordIdx) in line"
                  :key="`${lineIdx}-${wordIdx}`"
                  :style="getWordStyle(lineIdx * (settings.maxWordsPerLine || 4) + wordIdx)"
                  class="kinetic-word"
                >
                  {{ word }}{{ wordIdx < line.length - 1 ? '\u00A0' : '' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Watermark layer -->
          <div v-if="showWatermark" :style="watermarkPositionStyle">
            {{ WATERMARK_CONFIG.text }}
          </div>

          <!-- Home indicator -->
          <div class="absolute left-1/2 -translate-x-1/2 bg-white/40 rounded-full" style="bottom: 22px; width: 370px; height: 14px;" />
        </div>
      </div>

      <!-- Scale info -->
      <p class="text-xs text-muted-foreground tabular-nums">
        {{ Math.round(previewScale * 100) }}% scale &middot; {{ RENDER.width }}&times;{{ RENDER.height }}px
      </p>
    </div>

  </div>
</template>

<style scoped>
.kinetic-word {
  will-change: transform, opacity, color;
}
</style>
