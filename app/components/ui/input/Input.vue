<script setup lang="ts">
import { cn } from '~/lib/utils'

interface Props {
  defaultValue?: string
  modelValue?: string
  class?: string
  type?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  id?: string
  name?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <input
    :type="type"
    :value="modelValue || defaultValue"
    :class="cn(
      'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      props.class,
    )"
    :placeholder="placeholder"
    :disabled="disabled"
    :required="required"
    :id="id"
    :name="name"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
