<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
})

const { videos, loading, fetchVideos } = useVideos()
const { profile, fetchProfile } = useProfile()

onMounted(async () => {
  await Promise.all([fetchVideos(), fetchProfile()])
})

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
        <NuxtLink to="/dashboard/settings">
          <Button variant="outline">
            ⚙️ Settings
          </Button>
        </NuxtLink>
        <NuxtLink to="/dashboard/upload">
          <Button >
            📤 Upload Video
          </Button>
        </NuxtLink>
      </div>
    </div>

    <!-- Stats -->
    <div v-if="profile" class="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardContent class="pt-6">
          <div class="text-2xl font-bold">{{ videos.length }}</div>
          <p class="text-sm text-muted-foreground">Total Videos</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="pt-6">
          <div class="text-2xl font-bold">{{ profile.videos_processed_this_month }}/{{ profile.monthly_video_limit }}</div>
          <p class="text-sm text-muted-foreground">Videos This Month</p>
          <Progress :model-value="profile.videos_processed_this_month" :max="profile.monthly_video_limit" class="mt-2" />
        </CardContent>
      </Card>
      <Card>
        <CardContent class="pt-6">
          <div class="text-2xl font-bold capitalize">{{ profile.subscription_plan }}</div>
          <p class="text-sm text-muted-foreground">Current Plan</p>
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
        <NuxtLink to="/dashboard/upload" class="mt-4 inline-block">
          <Button>Upload Video</Button>
        </NuxtLink>
        <NuxtLink to="/dashboard/settings" class="mt-4 inline-block">
          <Button>Settings</Button>
        </NuxtLink>

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
