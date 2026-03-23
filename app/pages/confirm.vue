<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

// Handle email confirmation callback
const supabase = useSupabaseClient()
const route = useRoute()

onMounted(async () => {
  const { error } = await supabase.auth.exchangeCodeForSession(route.query.code as string)
  if (!error) {
    await navigateTo('/dashboard')
  }
})
</script>

<template>
  <div class="text-center space-y-4">
    <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
      ✉️
    </div>
    <h1 class="text-2xl font-bold">Confirming your email...</h1>
    <p class="text-muted-foreground">Please wait while we verify your account.</p>
  </div>
</template>
