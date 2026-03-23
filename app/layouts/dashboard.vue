<script setup lang="ts">
const user = useSupabaseUser()
const { signOut } = useAuth()
const { profile, fetchProfile } = useProfile()

const mobileMenuOpen = ref(false)

onMounted(() => {
  fetchProfile()
})
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

          <div class="hidden md:flex items-center gap-4">
            <NuxtLink to="/dashboard" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </NuxtLink>
            <NuxtLink to="/dashboard/upload" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Upload
            </NuxtLink>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <!-- Quota indicator -->
          <div v-if="profile" class="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <span>{{ profile.videos_processed_this_month }}/{{ profile.monthly_video_limit }} videos</span>
          </div>

          <div class="hidden md:flex items-center gap-2">
            <NuxtLink to="/pricing">
              <Button variant="outline" size="sm">
                {{ profile?.subscription_plan === 'free' ? 'Upgrade' : profile?.subscription_plan }}
              </Button>
            </NuxtLink>
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
        <NuxtLink to="/dashboard" class="block text-sm font-medium" @click="mobileMenuOpen = false">
          Dashboard
        </NuxtLink>
        <NuxtLink to="/dashboard/upload" class="block text-sm font-medium" @click="mobileMenuOpen = false">
          Upload
        </NuxtLink>
        <NuxtLink to="/pricing" class="block text-sm font-medium" @click="mobileMenuOpen = false">
          Pricing
        </NuxtLink>
        <div v-if="profile" class="text-sm text-muted-foreground">
          {{ profile.videos_processed_this_month }}/{{ profile.monthly_video_limit }} videos this month
        </div>
        <button class="text-sm text-destructive" @click="signOut">Sign out</button>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="container mx-auto px-4 py-8">
      <slot />
    </main>
  </div>
</template>
