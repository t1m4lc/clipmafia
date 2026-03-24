<script setup lang="ts">
/**
 * UpgradeDialog — shown when a backend action is denied due to LIMIT_REACHED.
 *
 * Props:
 *   open      – visibility toggle (v-model)
 *   type      – "UPLOAD" | "GENERATION"
 *   used      – how many the user has consumed
 *   limit     – plan cap
 *   resetDate – YYYY-MM-DD when counters reset
 */

interface Props {
  open: boolean
  type: 'UPLOAD' | 'GENERATION'
  used: number
  limit: number
  resetDate: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const typeLabel = computed(() => (props.type === 'UPLOAD' ? 'uploads' : 'generations'))

const formattedResetDate = computed(() => {
  try {
    return new Date(props.resetDate + 'T00:00:00Z').toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return props.resetDate
  }
})

function close() {
  emit('update:open', false)
}

async function goToPricing() {
  close()
  await navigateTo('/pricing')
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <div class="space-y-6">
      <!-- Header -->
      <div class="space-y-2 text-center">
        <div class="text-5xl">🚫</div>
        <h2 class="text-xl font-bold">You've reached your monthly limit</h2>
        <p class="text-muted-foreground text-sm">
          Upgrade your plan to continue creating amazing shorts.
        </p>
      </div>

      <!-- Usage details -->
      <div class="rounded-lg border bg-muted/50 p-4 space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">{{ type === 'UPLOAD' ? 'Video uploads' : 'Shorts generations' }}</span>
          <Badge variant="destructive">Limit reached</Badge>
        </div>
        <div class="space-y-1.5">
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">Used this month</span>
            <span class="font-bold">{{ used }} / {{ limit }} {{ typeLabel }}</span>
          </div>
          <Progress :model-value="used" :max="limit" class="h-2" />
        </div>
        <p class="text-xs text-muted-foreground">
          Resets on: <strong>{{ formattedResetDate }}</strong>
        </p>
      </div>

      <!-- Actions -->
      <div class="flex flex-col gap-2">
        <Button size="lg" class="w-full" @click="goToPricing">
          🚀 Upgrade Plan
        </Button>
        <Button variant="ghost" class="w-full" @click="close">
          Maybe later
        </Button>
      </div>
    </div>
  </Dialog>
</template>
