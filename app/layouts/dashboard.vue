<script setup lang="ts">
const user = useSupabaseUser()
const { signOut } = useAuth()
const { profile, fetchProfile, effectivePlan, usageStats } = useProfile()

const mobileMenuOpen = ref(false)
const managingSubscription = ref(false)

onMounted(async () => {
  await fetchProfile()
})

const stats = computed(() => usageStats())

async function manageSubscription() {
  managingSubscription.value = true
  try {
    const { url } = await $fetch<{ url: string }>('/api/stripe/portal', { method: 'POST' })
    if (url) window.location.href = url
  } catch (e) {
    console.error('Failed to open Stripe portal:', e)
  } finally {
    managingSubscription.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Top Navigation -->
    <nav class="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="container mx-auto flex h-16 items-center justify-between px-4">
        <div class="flex items-center gap-6">
          <NuxtLink to="/dashboard" class="flex items-center gap-2 font-bold text-xl">
            <span class="text-2xl">🎬</span>
            <span class="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">ClipMafia</span>
          </NuxtLink>
        </div>

        <div class="flex items-center gap-4">
          <div class="hidden md:flex items-center gap-2">
            <!-- Upgrade (free plan) -->
            <NuxtLink v-if="effectivePlan() === 'free'" to="/pricing">
              <Button
                variant="outline"
                size="sm"
                class="relative"
                :class="stats.atLimit ? 'border-destructive text-destructive' : ''"
              >
                Upgrade
                <span v-if="stats.atLimit" class="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                  <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
                </span>
              </Button>
            </NuxtLink>
            <!-- Manage subscription (paid plan) -->
            <Button
              v-else
              variant="outline"
              size="sm"
              :disabled="managingSubscription"
              @click="manageSubscription"
            >
              {{ managingSubscription ? '...' : 'Manage subscription' }}
            </Button>
            <Button variant="ghost" size="sm" @click="signOut">
              Sign out
            </Button>
          </div>

          <!-- Mobile menu button -->
          <button class="md:hidden" @click="mobileMenuOpen = !mobileMenuOpen">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path v-if="!mobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile menu -->
      <div v-if="mobileMenuOpen" class="md:hidden border-t p-4 space-y-3">
        <NuxtLink to="/dashboard/upload" class="block text-sm font-medium" @click="mobileMenuOpen = false">
          Upload
        </NuxtLink>
        <NuxtLink to="/dashboard/settings" class="block text-sm font-medium" @click="mobileMenuOpen = false">
          ⚙️ Settings
        </NuxtLink>
        <NuxtLink v-if="effectivePlan() === 'free'" to="/pricing" class="block text-sm font-medium" @click="mobileMenuOpen = false">
          ⬆️ Upgrade
        </NuxtLink>
        <button v-else class="block text-sm font-medium text-left" :disabled="managingSubscription" @click="manageSubscription; mobileMenuOpen = false">
          {{ managingSubscription ? '...' : '⚙️ Manage subscription' }}
        </button>
        <button class="text-sm text-destructive" @click="signOut">Sign out</button>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="container mx-auto px-4 py-8">
      <slot />
    </main>
  </div>
</template>
