<script setup lang="ts">
/**
 * /admin — Internal monitoring dashboard.
 * Not indexed by search engines. Protected by ADMIN_SECRET.
 */
definePageMeta({
  layout: 'default',
})

useHead({
  title: 'Admin — ClipMafia',
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})

// ── State ────────────────────────────────────────────────────────────────────
const secret = ref('')
const authenticated = ref(false)
const loading = ref(false)
const error = ref('')
const stats = ref<any>(null)

// Filters
const dateFrom = ref(formatDate(daysAgo(30)))
const dateTo = ref(formatDate(new Date()))
const filterUserId = ref('')

// ── Helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]!
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const mb = bytes
  if (mb < 1024) return `${mb} MB`
  return `${(mb / 1024).toFixed(1)} GB`
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}m`
}

// ── Data fetching ────────────────────────────────────────────────────────────
async function fetchStats() {
  loading.value = true
  error.value = ''

  try {
    const params = new URLSearchParams({
      secret: secret.value,
      from: new Date(dateFrom.value).toISOString(),
      to: new Date(dateTo.value + 'T23:59:59').toISOString(),
    })
    if (filterUserId.value) {
      params.set('user_id', filterUserId.value)
    }

    const data = await $fetch(`/api/admin/stats?${params}`)
    stats.value = data
    authenticated.value = true
  } catch (e: any) {
    if (e?.statusCode === 403) {
      error.value = 'Invalid admin secret'
      authenticated.value = false
    } else {
      error.value = e?.message ?? 'Failed to fetch stats'
    }
  } finally {
    loading.value = false
  }
}

// Quick presets
function setRange(days: number) {
  dateFrom.value = formatDate(daysAgo(days))
  dateTo.value = formatDate(new Date())
  fetchStats()
}

function clearUserFilter() {
  filterUserId.value = ''
  fetchStats()
}

function filterByUser(userId: string) {
  filterUserId.value = userId
  fetchStats()
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Navbar -->
    <nav class="border-b">
      <div class="container mx-auto flex h-14 items-center justify-between px-4">
        <div class="flex items-center gap-2 font-bold text-lg">
          <span class="text-xl">🎬</span>
          <span class="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">ClipMafia</span>
          <span class="text-xs bg-red-500/10 text-red-500 font-semibold px-2 py-0.5 rounded-full ml-2">ADMIN</span>
        </div>
        <NuxtLink to="/dashboard">
          <Button variant="ghost" size="sm">← Dashboard</Button>
        </NuxtLink>
      </div>
    </nav>

    <div class="container mx-auto px-4 py-8 max-w-7xl">

      <!-- Login gate -->
      <div v-if="!authenticated" class="max-w-md mx-auto mt-20">
        <Card>
          <CardHeader>
            <CardTitle>Admin Access</CardTitle>
            <CardDescription>Enter the admin secret to view the dashboard.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div>
              <Label for="secret">Admin Secret</Label>
              <Input
                id="secret"
                v-model="secret"
                type="password"
                placeholder="Enter ADMIN_SECRET..."
                @keyup.enter="fetchStats"
              />
            </div>
            <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
          </CardContent>
          <CardFooter>
            <Button class="w-full" :disabled="loading || !secret" @click="fetchStats">
              {{ loading ? 'Loading…' : 'Access Dashboard' }}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <!-- Dashboard -->
      <template v-if="authenticated && stats">

        <!-- ─── Filters ──────────────────────────────────────────────────── -->
        <div class="flex flex-wrap items-end gap-4 mb-8">
          <div>
            <Label class="text-xs text-muted-foreground">From</Label>
            <Input v-model="dateFrom" type="date" class="w-40" />
          </div>
          <div>
            <Label class="text-xs text-muted-foreground">To</Label>
            <Input v-model="dateTo" type="date" class="w-40" />
          </div>
          <Button size="sm" @click="fetchStats" :disabled="loading">
            {{ loading ? '…' : 'Apply' }}
          </Button>
          <div class="flex gap-1">
            <Button size="sm" variant="ghost" @click="setRange(7)">7d</Button>
            <Button size="sm" variant="ghost" @click="setRange(30)">30d</Button>
            <Button size="sm" variant="ghost" @click="setRange(90)">90d</Button>
            <Button size="sm" variant="ghost" @click="setRange(365)">1y</Button>
          </div>
          <div v-if="filterUserId" class="ml-auto flex items-center gap-2 text-sm">
            <span class="text-muted-foreground">Filtered:</span>
            <code class="text-xs bg-muted px-2 py-0.5 rounded">{{ filterUserId.slice(0, 8) }}…</code>
            <Button size="sm" variant="ghost" @click="clearUserFilter">✕</Button>
          </div>
        </div>

        <!-- ─── KPI Cards ────────────────────────────────────────────────── -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card class="p-4">
            <p class="text-xs text-muted-foreground font-medium">Users</p>
            <p class="text-2xl font-bold mt-1">{{ stats.overview.totalUsers }}</p>
          </Card>
          <Card class="p-4">
            <p class="text-xs text-muted-foreground font-medium">Uploads</p>
            <p class="text-2xl font-bold mt-1">{{ stats.overview.totalUploads }}</p>
          </Card>
          <Card class="p-4">
            <p class="text-xs text-muted-foreground font-medium">Jobs</p>
            <p class="text-2xl font-bold mt-1">
              {{ stats.overview.completedJobs }}
              <span class="text-sm text-muted-foreground font-normal">/ {{ stats.overview.totalJobs }}</span>
            </p>
          </Card>
          <Card class="p-4">
            <p class="text-xs text-muted-foreground font-medium">Shorts</p>
            <p class="text-2xl font-bold mt-1">{{ stats.overview.totalShorts }}</p>
          </Card>
          <Card class="p-4">
            <p class="text-xs text-muted-foreground font-medium">Avg Processing</p>
            <p class="text-2xl font-bold mt-1">{{ stats.overview.avgProcessingTimeSec }}s</p>
          </Card>
          <Card class="p-4">
            <p class="text-xs text-muted-foreground font-medium">Downloads</p>
            <p class="text-2xl font-bold mt-1">{{ stats.overview.totalDownloads }}</p>
          </Card>
        </div>

        <!-- ─── Storage & Costs ──────────────────────────────────────────── -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <!-- Storage -->
          <Card>
            <CardHeader class="pb-3">
              <CardTitle class="text-base">💾 Storage & Duration</CardTitle>
            </CardHeader>
            <CardContent>
              <div class="space-y-3 text-sm">
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Video storage</span>
                  <span class="font-semibold">{{ formatBytes(stats.overview.totalVideoStorageMb) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Shorts storage</span>
                  <span class="font-semibold">{{ formatBytes(stats.overview.totalShortsStorageMb) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Video duration processed</span>
                  <span class="font-semibold">{{ formatDuration(stats.overview.totalVideoDurationMin) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Failed jobs</span>
                  <span class="font-semibold text-red-500">{{ stats.overview.failedJobs }}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Costs -->
          <Card>
            <CardHeader class="pb-3">
              <CardTitle class="text-base">💰 Estimated API & Infra Costs</CardTitle>
              <CardDescription class="text-xs">Variable costs only — Vercel Pro $20/mo not included</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="space-y-3 text-sm">
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Deepgram (transcription)</span>
                  <span class="font-semibold">${{ stats.costs.deepgramEstimate }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">GPT-5.4-mini (segment detection)</span>
                  <span class="font-semibold">${{ stats.costs.aiEstimate }}</span>
                </div>
                <div class="flex justify-between">
                  <div>
                    <span class="text-muted-foreground">Vercel Fluid — Active CPU (FFmpeg)</span>
                    <div class="text-[10px] text-muted-foreground/60 mt-0.5">
                      $0.1386/CPU·hr × ~{{ stats.overview.avgProcessingTimeSec }}s avg × {{ stats.overview.completedJobs }} jobs
                    </div>
                  </div>
                  <span class="font-semibold">${{ stats.costs.vercelCpuEstimate }}</span>
                </div>
                <div class="flex justify-between">
                  <div>
                    <span class="text-muted-foreground">Vercel Fluid — Memory (512 MB)</span>
                    <div class="text-[10px] text-muted-foreground/60 mt-0.5">$0.01057/GB·Hr</div>
                  </div>
                  <span class="font-semibold">${{ stats.costs.vercelMemEstimate }}</span>
                </div>
                <div class="flex justify-between border-t pt-2">
                  <span class="font-medium">Total variable estimate</span>
                  <span class="font-bold text-primary">${{ stats.costs.totalEstimate }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground text-xs">Cost per job (avg)</span>
                  <span class="text-xs font-semibold">${{ stats.costs.perJobEstimate }}</span>
                </div>
              </div>
              <ul class="mt-4 space-y-1">
                <li v-for="note in stats.costs.notes" :key="note" class="text-[10px] text-muted-foreground/70 leading-relaxed">
                  › {{ note }}
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <!-- ─── Plan Breakdown ───────────────────────────────────────────── -->
        <Card class="mb-8">
          <CardHeader class="pb-3">
            <CardTitle class="text-base">📊 Plan Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="flex flex-wrap gap-4">
              <div
                v-for="(count, plan) in stats.overview.planBreakdown"
                :key="plan"
                class="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2"
              >
                <span class="text-sm font-medium capitalize">{{ plan }}</span>
                <span class="text-lg font-bold">{{ count }}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- ─── Daily Activity ───────────────────────────────────────────── -->
        <Card class="mb-8">
          <CardHeader class="pb-3">
            <CardTitle class="text-base">📅 Daily Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b text-left text-muted-foreground">
                    <th class="py-2 pr-4 font-medium">Date</th>
                    <th class="py-2 pr-4 font-medium text-right">Uploads</th>
                    <th class="py-2 pr-4 font-medium text-right">Jobs</th>
                    <th class="py-2 pr-4 font-medium text-right">Shorts</th>
                    <th class="py-2 font-medium text-right">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in stats.daily" :key="row.date" class="border-b border-border/50">
                    <td class="py-2 pr-4 font-mono text-xs">{{ row.date }}</td>
                    <td class="py-2 pr-4 text-right">{{ row.uploads }}</td>
                    <td class="py-2 pr-4 text-right">{{ row.jobs }}</td>
                    <td class="py-2 pr-4 text-right">{{ row.shorts }}</td>
                    <td class="py-2 text-right" :class="row.failedJobs > 0 ? 'text-red-500 font-semibold' : ''">
                      {{ row.failedJobs }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <!-- ─── Monthly Usage ────────────────────────────────────────────── -->
        <Card class="mb-8">
          <CardHeader class="pb-3">
            <CardTitle class="text-base">📆 Monthly Totals</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b text-left text-muted-foreground">
                    <th class="py-2 pr-4 font-medium">Month</th>
                    <th class="py-2 pr-4 font-medium text-right">Uploads</th>
                    <th class="py-2 font-medium text-right">Generations</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in stats.monthly" :key="row.month" class="border-b border-border/50">
                    <td class="py-2 pr-4 font-mono text-xs">{{ row.month }}</td>
                    <td class="py-2 pr-4 text-right">{{ row.uploads }}</td>
                    <td class="py-2 text-right">{{ row.generations }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <!-- ─── Users Table ──────────────────────────────────────────────── -->
        <Card class="mb-8">
          <CardHeader class="pb-3">
            <CardTitle class="text-base">👥 Users ({{ stats.users.length }})</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b text-left text-muted-foreground">
                    <th class="py-2 pr-4 font-medium">Email</th>
                    <th class="py-2 pr-4 font-medium">Plan</th>
                    <th class="py-2 pr-4 font-medium text-right">Uploads</th>
                    <th class="py-2 pr-4 font-medium text-right">Jobs</th>
                    <th class="py-2 pr-4 font-medium text-right">Shorts</th>
                    <th class="py-2 pr-4 font-medium text-right">Failed</th>
                    <th class="py-2 pr-4 font-medium text-right">Storage</th>
                    <th class="py-2 pr-4 font-medium text-right">Duration</th>
                    <th class="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="user in stats.users"
                    :key="user.id"
                    class="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td class="py-2 pr-4 truncate max-w-[200px]">{{ user.email }}</td>
                    <td class="py-2 pr-4">
                      <span
                        class="text-xs font-medium px-2 py-0.5 rounded-full capitalize"
                        :class="{
                          'bg-muted text-muted-foreground': user.plan === 'free',
                          'bg-primary/10 text-primary': user.plan === 'pro',
                          'bg-purple-500/10 text-purple-500': user.plan === 'business',
                        }"
                      >
                        {{ user.plan }}
                      </span>
                    </td>
                    <td class="py-2 pr-4 text-right">{{ user.uploads }}</td>
                    <td class="py-2 pr-4 text-right">{{ user.jobs }}</td>
                    <td class="py-2 pr-4 text-right">{{ user.shorts }}</td>
                    <td
                      class="py-2 pr-4 text-right"
                      :class="user.failedJobs > 0 ? 'text-red-500' : ''"
                    >
                      {{ user.failedJobs }}
                    </td>
                    <td class="py-2 pr-4 text-right text-xs">{{ user.storageMb.toFixed(0) }} MB</td>
                    <td class="py-2 pr-4 text-right text-xs">{{ user.totalDurationMin.toFixed(0) }} min</td>
                    <td class="py-2">
                      <Button size="sm" variant="ghost" class="h-7 px-2 text-xs" @click="filterByUser(user.id)">
                        Filter
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <!-- ─── Failed Jobs Detail ───────────────────────────────────────── -->
        <Card v-if="stats.failedJobs.length > 0" class="mb-8">
          <CardHeader class="pb-3">
            <CardTitle class="text-base text-red-500">❌ Failed Jobs ({{ stats.failedJobs.length }})</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b text-left text-muted-foreground">
                    <th class="py-2 pr-4 font-medium">Job ID</th>
                    <th class="py-2 pr-4 font-medium">Failed at Step</th>
                    <th class="py-2 pr-4 font-medium">User ID</th>
                    <th class="py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="job in stats.failedJobs" :key="job.id" class="border-b border-border/50">
                    <td class="py-2 pr-4 font-mono text-xs truncate max-w-[120px]">{{ job.id.slice(0, 8) }}…</td>
                    <td class="py-2 pr-4">
                      <span class="text-xs bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full">
                        {{ job.failedAtStep || '—' }}
                      </span>
                    </td>
                    <td class="py-2 pr-4 font-mono text-xs">
                      <button class="hover:text-primary underline" @click="filterByUser(job.userId)">
                        {{ job.userId.slice(0, 8) }}…
                      </button>
                    </td>
                    <td class="py-2 text-xs text-muted-foreground">{{ job.createdAt?.split('T')[0] }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </template>
    </div>
  </div>
</template>
