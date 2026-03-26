<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'settings'],
})

const config = useRuntimeConfig()
const { fetchProfile, effectivePlan } = useProfile()

onMounted(() => fetchProfile())

// Show watermark in preview when user is on free plan
const showWatermark = computed(() => effectivePlan() === 'free')
const isFree = computed(() => !config.public.bypassPayment && effectivePlan() === 'free')

const { settings, save, reset, isCustomized, DEFAULT_SUBTITLE_SETTINGS } = useSubtitleSettings()
const saved = ref(false)
const localSettings = ref({ ...settings.value })
const showUpgradeDialog = ref(false)

watch(settings, (v) => {
  localSettings.value = { ...v }
}, { immediate: true })

function handleSave() {
  if (isFree.value) {
    showUpgradeDialog.value = true
    return
  }
  save(localSettings.value)
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}

function handleReset() {
  reset()
  localSettings.value = { ...DEFAULT_SUBTITLE_SETTINGS }
}
</script>

<template>
  <div class="space-y-8">
    <NuxtLink to="/dashboard" class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
      &larr; Back to Dashboard
    </NuxtLink>
    <div>
      <h1 class="text-3xl font-bold">Settings</h1>
      <p class="text-muted-foreground mt-1">
        Customize video text style.
      </p>
    </div>

    <!-- Free plan info banner -->
    <div v-if="isFree" class="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
      <span class="text-xl">🔒</span>
      <div class="space-y-1">
        <p class="text-sm font-medium text-amber-600 dark:text-amber-400">Free plan — preview only</p>
        <p class="text-xs text-muted-foreground">You can explore all settings and preview the result. Upgrade to Starter or Pro to save and apply your custom style to generated videos.</p>
        <NuxtLink to="/pricing" class="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline mt-1">
          View plans &rarr;
        </NuxtLink>
      </div>
    </div>

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          🎨 Subtitle Style
          <Badge v-if="isCustomized()" variant="secondary" class="text-xs">Customized</Badge>
          <Badge v-else variant="outline" class="text-xs">Default</Badge>
        </CardTitle>
        <CardDescription>
          Customize font, size, colors, position and animation. The live preview shows
          how subtitles will render on your shorts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SubtitleSettings v-model="localSettings" :show-watermark="showWatermark" />
      </CardContent>
    </Card>

    <!-- Actions -->
    <div class="flex items-center gap-3">
      <Button size="lg" :variant="isFree ? 'outline' : 'default'" class="flex-1 sm:flex-none" @click="handleSave">
        <template v-if="isFree">🔒 Save Settings (Upgrade)</template>
        <template v-else>{{ saved ? '✅ Saved!' : '💾 Save Settings' }}</template>
      </Button>
      <Button variant="outline" size="lg" @click="handleReset">
        🔄 Reset to Defaults
      </Button>
    </div>

    <!-- Defaults Reference -->
    <Card class="border-dashed">
      <CardContent class="pt-6">
        <div class="text-sm text-muted-foreground space-y-1">
          <p class="font-medium text-foreground mb-2">Default values:</p>
          <p>Font: <span class="font-mono">{{ DEFAULT_SUBTITLE_SETTINGS.fontName }}</span></p>
          <p>Size: {{ DEFAULT_SUBTITLE_SETTINGS.fontSize }}px</p>
          <p>Bottom Margin: {{ DEFAULT_SUBTITLE_SETTINGS.marginV }}px</p>
          <p>Bold: {{ DEFAULT_SUBTITLE_SETTINGS.bold ? 'Yes' : 'No' }}</p>
        </div>
      </CardContent>
    </Card>

    <!-- Upgrade dialog (shown when free user tries to save) -->
    <Dialog :open="showUpgradeDialog" @update:open="showUpgradeDialog = $event">
      <div class="space-y-6 text-center">
        <div class="space-y-2">
          <div class="text-5xl">✨</div>
          <h2 class="text-xl font-bold">Unlock Custom Subtitles</h2>
          <p class="text-muted-foreground text-sm">
            Saving custom subtitle styles is available on <strong>Starter</strong> and <strong>Pro</strong> plans.
            Upgrade to apply your kinetic captions, highlight colors, and animation presets to every video you generate.
          </p>
        </div>
        <div class="rounded-lg border bg-muted/50 p-4 space-y-2 text-left">
          <p class="text-sm font-medium">What you unlock:</p>
          <ul class="text-sm text-muted-foreground space-y-1">
            <li>✅ Save custom subtitle styles</li>
            <li>✅ Kinetic word-by-word captions</li>
            <li>✅ Custom highlight colors & animations</li>
            <li>✅ TikTok / Reels style presets</li>
          </ul>
        </div>
        <div class="flex flex-col gap-2">
          <Button size="lg" class="w-full" @click="showUpgradeDialog = false; navigateTo('/pricing')">
            🚀 View Plans
          </Button>
          <Button variant="ghost" class="w-full" @click="showUpgradeDialog = false">
            Maybe later
          </Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>
