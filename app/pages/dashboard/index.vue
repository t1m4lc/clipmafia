<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
})

const { videos, loading, fetchVideos } = useVideos()
const { profile, fetchProfile, effectivePlan, fetchMonthlyUsage, usageStats } = useProfile()

onMounted(async () => {
  await Promise.all([fetchVideos(), fetchProfile()])
  await fetchMonthlyUsage()
})

const stats = computed(() => usageStats())

function handleSettingsClick() {
  navigateTo('/dashboard/settings')
}

function getStatusColor(status: string) {
  switch (status) {
    case 'uploaded': return 'secondary'
    case 'processing': return 'warning'
    case 'completed': return 'success'
    case 'failed': return 'destructive'
    default: return 'secondary'
  }
}
</script>

<template>
  <div class="space-y-8">
    <!-- Welcome Header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold">Dashboard</h1>
        <p class="text-muted-foreground">Manage your videos and shorts</p>
      </div>
      <div class="space-x-2">
        <Button variant="outline" @click="handleSettingsClick">
          ⚙️ Settings
        </Button>
        <NuxtLink to="/dashboard/upload">
          <Button >
            📤 Upload Video
          </Button>
        </NuxtLink>
      </div>
    </div>

    <!-- Stats -->
    <div v-if="profile" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <!-- Total videos -->
      <Card>
        <CardContent class="pt-6">
          <div class="text-2xl font-bold">{{ videos.length }}</div>
          <p class="text-sm text-muted-foreground">Total Videos</p>
        </CardContent>
      </Card>

      <!-- Current plan -->
      <Card>
        <CardContent class="pt-6">
          <div class="text-2xl font-bold capitalize">{{ effectivePlan() }}</div>
          <p class="text-sm text-muted-foreground">Current Plan</p>
          <NuxtLink v-if="effectivePlan() === 'free'" to="/pricing" class="text-xs text-primary underline mt-1 block">Upgrade</NuxtLink>
        </CardContent>
      </Card>

      <!-- Uploads this month -->
      <Card :class="stats.uploadsAtLimit ? 'border-destructive' : ''">
        <CardContent class="pt-6 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-2xl font-bold" :class="stats.uploadsAtLimit ? 'text-destructive' : ''">{{ stats.uploadsUsed }}/{{ stats.uploadsLimit }}</span>
            <span v-if="stats.uploadsAtLimit" class="flex h-2.5 w-2.5">
              <span class="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-destructive opacity-75" />
              <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
            </span>
          </div>
          <p class="text-sm text-muted-foreground">📤 Uploads this month</p>
          <Progress :model-value="stats.uploadsUsed" :max="stats.uploadsLimit" class="h-1.5" />
          <p v-if="stats.uploadsAtLimit" class="text-xs text-destructive font-medium">Limit reached</p>
        </CardContent>
      </Card>


    </div>

    <!-- Videos List -->
    <div>
      <h2 class="text-xl font-semibold mb-4">Your Videos</h2>

      <div v-if="loading" class="text-center py-12 text-muted-foreground">
        Loading videos...
      </div>

      <div v-else-if="videos.length === 0" class="text-center py-12">
        <div class="text-4xl mb-4">🎥</div>
        <h3 class="text-lg font-medium">No videos yet</h3>
        <p class="text-muted-foreground mt-1">Upload your first video to get started</p>
        <NuxtLink to="/dashboard/upload" class="mt-4 mr-2 inline-block">
          <Button>Upload Video</Button>
        </NuxtLink>
        <Button class="mt-4" variant="outline" @click="handleSettingsClick">Settings</Button>

      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="video in videos"
          :key="video.id"
          :to="`/dashboard/videos/${video.id}`"
          class="block"
        >
          <Card class="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent class="pt-6">
              <div class="aspect-video rounded-md bg-muted flex items-center justify-center mb-3">
                <span class="text-3xl">🎬</span>
              </div>
              <div class="space-y-2">
                <h3 class="font-medium truncate">{{ video.title }}</h3>
                <div class="flex items-center justify-between">
                  <Badge :variant="getStatusColor(video.status) as any">
                    {{ video.status }}
                  </Badge>
                  <span class="text-xs text-muted-foreground">
                    {{ new Date(video.created_at).toLocaleDateString() }}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </NuxtLink>
      </div>
    </div>
  </div>


</template>
