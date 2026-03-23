<script setup lang="ts">
import { cn } from '~/lib/utils'

interface Props {
  class?: string
  modelValue?: number
  max?: number
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 0,
  max: 100,
})

const percentage = computed(() => Math.min(100, Math.max(0, (props.modelValue / props.max) * 100)))
</script>

<template>
  <div
    :class="cn('relative h-4 w-full overflow-hidden rounded-full bg-secondary', props.class)"
    role="progressbar"
    :aria-valuenow="modelValue"
    :aria-valuemax="max"
  >
    <div
      class="h-full bg-primary transition-all duration-300 ease-in-out"
      :style="{ width: `${percentage}%` }"
    />
  </div>
</template>
