<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

const user = useSupabaseUser()
const { profile, fetchProfile, effectivePlan } = useProfile()
const loading = ref(false)

onMounted(() => {
  if (user.value) {
    fetchProfile()
  }
})

const currentPlan = computed(() => effectivePlan())

async function subscribe(plan: 'starter' | 'pro') {
  if (!user.value) {
    await navigateTo('/register')
    return
  }

  loading.value = true
  try {
    const { url } = await $fetch('/api/stripe/checkout', {
      method: 'POST',
      body: { plan },
    })

    if (url) {
      window.location.href = url
    }
  } catch (e) {
    console.error('Failed to create checkout session:', e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <!-- Navbar -->
    <nav class="container mx-auto flex h-16 items-center justify-between px-4">
      <NuxtLink to="/" class="flex items-center gap-2 font-bold text-xl">
        <span class="text-2xl">🎬</span>
        <span class="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">ClipMafia</span>
      </NuxtLink>
      <div class="flex items-center gap-4">
        <NuxtLink v-if="user" to="/dashboard">
          <Button variant="ghost">Dashboard</Button>
        </NuxtLink>
        <NuxtLink v-else to="/login">
          <Button variant="ghost">Sign in</Button>
        </NuxtLink>
      </div>
    </nav>

    <!-- Pricing Section -->
    <div class="container mx-auto px-4 py-16">
      <PricingCards
        heading-tag="h1"
        :current-plan="currentPlan"
        :loading="loading"
        :hasFeatures="true"
        @subscribe="subscribe"
      />
    </div>
  </div>
</template>
