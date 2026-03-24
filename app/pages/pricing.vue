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
const limits = computed(() => ({
  free: SUBSCRIPTION_LIMITS.FREE,
  pro: SUBSCRIPTION_LIMITS.PRO,
  business: SUBSCRIPTION_LIMITS.BUSINESS,
}))

function formatSize(mb: number): string {
  if (mb < 1024) return `${mb} MB`
  return `${mb / 1024} GB`
}

async function subscribe(plan: 'pro' | 'business') {
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
      <div class="text-center mb-16">
        <h1 class="text-4xl font-bold tracking-tight">Simple, transparent pricing</h1>
        <p class="mt-4 text-lg text-muted-foreground">Choose the plan that fits your content creation needs</p>
      </div>

      <div class="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
        <!-- Free -->
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <CardDescription>Get started for free</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="text-4xl font-bold">€0<span class="text-lg font-normal text-muted-foreground">/mo</span></div>
            <ul class="space-y-3 text-sm">
              <li class="flex items-center gap-2">✅ {{ limits.free.videoUploadsPerMonth }} video uploads / month</li>
              <li class="flex items-center gap-2">✅ {{ limits.free.shortsGenerationsPerMonth }} shorts generations / month</li>
              <li class="flex items-center gap-2">✅ Auto subtitles</li>
              <li class="flex items-center gap-2">✅ Center crop framing</li>
              <li class="flex items-center gap-2 text-muted-foreground">⚠️ Max {{ formatSize(limits.free.maxFileSizeMb) }} per file</li>
              <li class="flex items-center gap-2 text-muted-foreground">⚠️ Watermark on shorts</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              class="w-full"
              disabled
            >
              {{ currentPlan === 'free' ? 'Current Plan' : 'Free Plan' }}
            </Button>
          </CardFooter>
        </Card>

        <!-- Pro (highlighted) -->
        <Card class="border-primary shadow-lg relative">
          <div class="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge>Most Popular</Badge>
          </div>
          <CardHeader>
            <CardTitle>Pro</CardTitle>
            <CardDescription>For content creators</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="text-4xl font-bold">€9<span class="text-lg font-normal text-muted-foreground">/mo</span></div>
            <ul class="space-y-3 text-sm">
              <li class="flex items-center gap-2">✅ {{ limits.pro.videoUploadsPerMonth }} video uploads / month</li>
              <li class="flex items-center gap-2">✅ {{ limits.pro.shortsGenerationsPerMonth }} shorts generations / month</li>
              <li class="flex items-center gap-2">✅ Auto subtitles</li>
              <li class="flex items-center gap-2">✅ Center crop framing</li>
              <li class="flex items-center gap-2">✅ Up to {{ formatSize(limits.pro.maxFileSizeMb) }} per file</li>
              <li class="flex items-center gap-2">✅ No watermark</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              class="w-full"
              :disabled="loading || currentPlan === 'pro'"
              @click="subscribe('pro')"
            >
              {{ currentPlan === 'pro' ? 'Current Plan' : loading ? 'Loading...' : 'Subscribe' }}
            </Button>
          </CardFooter>
        </Card>

        <!-- Business -->
        <Card>
          <CardHeader>
            <CardTitle>Business</CardTitle>
            <CardDescription>For agencies & teams</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="text-4xl font-bold">€45<span class="text-lg font-normal text-muted-foreground">/mo</span></div>
            <ul class="space-y-3 text-sm">
              <li class="flex items-center gap-2">✅ <b>{{ limits.business.videoUploadsPerMonth }}</b> video uploads / month</li>
              <li class="flex items-center gap-2">✅ <b>Unlimited</b> shorts generations</li>
              <li class="flex items-center gap-2">✅ Auto subtitles</li>
              <li class="flex items-center gap-2">✅ Center crop framing</li>
              <li class="flex items-center gap-2">✅ Up to {{ formatSize(limits.business.maxFileSizeMb) }} per file</li>
              <li class="flex items-center gap-2">✅ No watermark</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              class="w-full"
              :disabled="loading || currentPlan === 'business'"
              @click="subscribe('business')"
            >
              {{ currentPlan === 'business' ? 'Current Plan' : loading ? 'Loading...' : 'Subscribe' }}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div class="text-center mt-16">
<p class="mt-3 text-base font-medium text-primary">
  ⚡ Upload once, generate dozens of ready-to-post shorts in one click : <b>save hours of editing every week</b>.
</p>
</div>

      <!-- FAQ / Transparency Note -->
      <div class="mt-16 max-w-2xl mx-auto text-center text-xs text-muted-foreground space-y-2">
        <p>All plans include AI-powered segment detection and customizable subtitle styles.</p>
        <p>Usage counters reset automatically on the 1st of each month.</p>
        <p>Regenerating shorts counts toward your monthly generation limit.</p>
      </div>
    </div>
  </div>
</template>
