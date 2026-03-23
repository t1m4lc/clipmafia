<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
})

const { settings, save, reset, isCustomized, DEFAULT_SUBTITLE_SETTINGS } = useSubtitleSettings()
const saved = ref(false)
const localSettings = ref({ ...settings.value })

watch(settings, (v) => {
  localSettings.value = { ...v }
}, { immediate: true })

function handleSave() {
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
    <div>
      <h1 class="text-3xl font-bold">Settings</h1>
      <p class="text-muted-foreground mt-1">
        Customize video text style.
      </p>
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
        <SubtitleSettings v-model="localSettings" />
      </CardContent>
    </Card>

    <!-- Actions -->
    <div class="flex items-center gap-3">
      <Button size="lg" @click="handleSave" class="flex-1 sm:flex-none">
        {{ saved ? '✅ Saved!' : '💾 Save Settings' }}
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
          <p>Animated: {{ DEFAULT_SUBTITLE_SETTINGS.animated ? 'Yes' : 'No' }}</p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
