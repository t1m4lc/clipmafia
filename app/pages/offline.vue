<script setup lang="ts">
definePageMeta({
  layout: 'default',
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center space-y-4">
      <div class="text-6xl">📡</div>
      <h1 class="text-2xl font-bold">You're offline</h1>
      <p class="text-muted-foreground max-w-md">
        ClipMafia requires an internet connection to process your videos.
        Please check your connection and try again.
      </p>
      <Button @click="window.location.reload()">Try Again</Button>
    </div>
  </div>
</template>
