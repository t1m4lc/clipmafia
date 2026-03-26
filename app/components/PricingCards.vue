<script setup lang="ts">

/**
 * Shared pricing grid used on both the landing page and the /pricing page.
 *
 * - When `currentPlan` is null (unauthenticated / landing page), all CTA
 *   buttons are plain links to /register.
 * - When `currentPlan` is provided (authenticated / pricing page), buttons
 *   reflect the user's active plan and emit `subscribe` so the parent can
 *   trigger the Stripe checkout flow.
 */

const props = withDefaults(defineProps<{
  /** Active plan of the logged-in user. Pass null when the user is not authenticated. */
  currentPlan?: string | null
  /** Whether a Stripe checkout request is in flight. */
  loading?: boolean
  /** Heading level — h1 on the standalone /pricing page, h2 everywhere else. */
  headingTag?: 'h1' | 'h2'
  hasFeatures: boolean
}>(), {
  currentPlan: null,
  loading: false,
  headingTag: 'h2',
  hasFeatures: false
})

const emit = defineEmits<{
  subscribe: [plan: 'starter' | 'pro']
}>()

const limits = {
  free: SUBSCRIPTION_CONFIG.FREE,
  starter: SUBSCRIPTION_CONFIG.STARTER,
  pro: SUBSCRIPTION_CONFIG.PRO,
}

function formatSize(mb: number): string {
  if (mb < 1024) return `${mb} MB`
  return `${mb / 1024} GB`
}

/** True when we are in a context where the user is authenticated. */
const isAuthenticated = computed(() => props.currentPlan !== null)
</script>

<template>
  <!-- ─── Heading ─────────────────────────────────────────────────────── -->
  <div class="text-center mb-12">
    <component
      :is="headingTag"
      class="font-bold tracking-tight"
      :class="headingTag === 'h1' ? 'text-4xl' : 'text-3xl sm:text-4xl'"
    >
      Simple, transparent pricing
    </component>
    <p class="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
      Upload once. Let AI find the best moments and generate ready-to-post vertical shorts — automatically.
    </p>
  </div>

  <!-- ─── Pricing cards ────────────────────────────────────────────────── -->
  <div class="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto items-start">

    <!-- Free ─────────────────────── -->
    <Card class="flex flex-col">
      <CardHeader class="pb-4">
        <CardTitle class="text-xl">Free</CardTitle>
        <CardDescription>Try it out, no credit card needed</CardDescription>
      </CardHeader>
      <CardContent class="flex-1 space-y-5">
        <div class="text-4xl font-bold">
          €0<span class="text-lg font-normal text-muted-foreground">/mo</span>
        </div>

        <!-- Limits table -->
        <div class="rounded-xl bg-muted/50 divide-y divide-border text-sm overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">Uploads / month</span>
            <span class="font-semibold">{{ limits.free.videoUploadsPerMonth }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">Max video length</span>
            <span class="font-semibold">{{ limits.free.maxDurationMinutes }} min</span>
          </div>
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">Max file size</span>
            <span class="font-semibold">{{ formatSize(limits.free.maxFileSizeMb) }}</span>
          </div>
        </div>

        <!-- Differentiators -->
        <ul class="space-y-2.5 text-sm">
          <li class="flex items-start gap-2.5 text-muted-foreground">
            <span class="mt-0.5 text-amber-500 shrink-0">⚠</span>
            <span>Shorts include a watermark</span>
          </li>
          <li class="flex items-start gap-2.5 text-muted-foreground">
            <span class="mt-0.5 text-amber-500 shrink-0">⚠</span>
            <span>Default subtitle style only</span>
          </li>
        </ul>
      </CardContent>
      <CardFooter class="pt-2">
        <template v-if="isAuthenticated">
          <Button variant="outline" class="w-full" disabled>
            {{ currentPlan === 'free' ? 'Current Plan' : 'Free Plan' }}
          </Button>
        </template>
        <template v-else>
          <NuxtLink to="/register" class="w-full">
            <Button variant="outline" class="w-full">Get Started Free</Button>
          </NuxtLink>
        </template>
      </CardFooter>
    </Card>

    <!-- Starter ─────────────────── -->
    <Card class="border-primary shadow-xl relative flex flex-col">
      <div class="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
        <Badge class="px-3 py-1 text-xs">⭐ Most Popular</Badge>
      </div>
      <CardHeader class="pb-4">
        <CardTitle class="text-xl">Starter</CardTitle>
        <CardDescription>For solo creators who ship every week</CardDescription>
      </CardHeader>
      <CardContent class="flex-1 space-y-5">
        <div class="text-4xl font-bold">
          €{{ limits.starter.price }}<span class="text-lg font-normal text-muted-foreground">/mo</span>
        </div>

        <!-- Limits table -->
        <div class="rounded-xl bg-primary/5 border border-primary/20 divide-y divide-primary/10 text-sm overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">Uploads / month</span>
            <span class="font-semibold">{{ limits.starter.videoUploadsPerMonth }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">Max video length</span>
            <span class="font-semibold">{{ limits.starter.maxDurationMinutes }} min</span>
          </div>
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">Max file size</span>
            <span class="font-semibold">{{ formatSize(limits.starter.maxFileSizeMb) }}</span>
          </div>
        </div>

        <!-- Differentiators -->
        <ul class="space-y-2.5 text-sm">
          <li class="flex items-center gap-2.5">
            <span class="text-green-500 shrink-0 font-bold">✓</span>
            <span>No watermark on shorts</span>
          </li>
          <li class="flex items-center gap-2.5">
            <span class="text-green-500 shrink-0 font-bold">✓</span>
            <span>Priority processing queue</span>
          </li>
          <li class="flex items-start gap-2.5">
            <span class="text-green-500 shrink-0 font-bold mt-0.5">✓</span>
            <span>
              <span class="font-semibold">Custom subtitle styles</span>
              <span class="ml-1.5 text-[10px] bg-primary/15 text-primary font-semibold px-1.5 py-0.5 rounded-full align-middle">🎨 New</span>
              <br><span class="text-xs text-muted-foreground">Font, color, size, shadow &amp; position</span>
            </span>
          </li>
        </ul>
      </CardContent>
      <CardFooter class="pt-2">
        <template v-if="isAuthenticated">
          <Button
            class="w-full"
            :disabled="loading || currentPlan === 'starter'"
            @click="emit('subscribe', 'starter')"
          >
            {{ currentPlan === 'starter' ? 'Current Plan' : loading ? 'Loading…' : 'Subscribe' }}
          </Button>
        </template>
        <template v-else>
          <NuxtLink to="/register" class="w-full">
            <Button class="w-full">Get Started</Button>
          </NuxtLink>
        </template>
      </CardFooter>
    </Card>

    <!-- Pro ─────────────────── -->
    <Card class="flex flex-col">
      <CardHeader class="pb-4">
        <CardTitle class="text-xl">Pro</CardTitle>
        <CardDescription>For agencies &amp; high-volume creators</CardDescription>
      </CardHeader>
      <CardContent class="flex-1 space-y-5">
        <div class="text-4xl font-bold">
          €{{ limits.pro.price }}<span class="text-lg font-normal text-muted-foreground">/mo</span>
        </div>

        <!-- Limits table -->
        <div class="rounded-xl bg-muted/50 divide-y divide-border text-sm overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">Uploads / month</span>
            <span class="font-semibold">{{ limits.pro.videoUploadsPerMonth }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">Max video length</span>
            <span class="font-semibold">{{ limits.pro.maxDurationMinutes }} min</span>
          </div>
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">Max file size</span>
            <span class="font-semibold">{{ formatSize(limits.pro.maxFileSizeMb) }}</span>
          </div>
        </div>

        <!-- Differentiators -->
        <ul class="space-y-2.5 text-sm">
          <li class="flex items-center gap-2.5">
            <span class="text-green-500 shrink-0 font-bold">✓</span>
            <span>No watermark on shorts</span>
          </li>
          <li class="flex items-center gap-2.5">
            <span class="text-green-500 shrink-0 font-bold">✓</span>
            <span>Priority processing queue</span>
          </li>
          <li class="flex items-start gap-2.5">
            <span class="text-green-500 shrink-0 font-bold mt-0.5">✓</span>
            <span>
              <span class="font-semibold">Custom subtitle styles 🎨</span>
              <br><span class="text-xs text-muted-foreground">Font, color, size, shadow &amp; position</span>
            </span>
          </li>
          <li class="flex items-center gap-2.5">
            <span class="text-green-500 shrink-0 font-bold">✓</span>
            <span>Dedicated onboarding &amp; support</span>
          </li>
          <li class="flex items-center gap-2.5 text-muted-foreground">
            <span class="shrink-0">🔜</span>
            <span>Team seats (coming soon)</span>
          </li>
        </ul>
      </CardContent>
      <CardFooter class="pt-2">
        <template v-if="isAuthenticated">
          <Button
            variant="outline"
            class="w-full"
            :disabled="loading || currentPlan === 'pro'"
            @click="emit('subscribe', 'pro')"
          >
            {{ currentPlan === 'pro' ? 'Current Plan' : loading ? 'Loading…' : 'Subscribe' }}
          </Button>
        </template>
        <template v-else>
          <NuxtLink to="/register" class="w-full">
            <Button variant="outline" class="w-full">Get Started</Button>
          </NuxtLink>
        </template>
      </CardFooter>
    </Card>
  </div>



  <!-- ─── Included in every plan ──────────────────────────────────────── -->
  <div v-if="props.hasFeatures" class="mt-16 max-w-5xl mx-auto">
    <p class="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-7">
      ✦ Included in every plan ✦
    </p>
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div class="flex flex-col items-center text-center gap-2 rounded-xl bg-muted/40 border border-border/50 px-3 py-4 hover:bg-muted/60 transition-colors">
        <span class="text-2xl">🧠</span>
        <div>
          <p class="text-xs font-semibold leading-tight">AI Viral Detection</p>
          <p class="text-[10px] text-muted-foreground mt-0.5 leading-snug">Scores every moment for engagement</p>
        </div>
      </div>
      <div class="flex flex-col items-center text-center gap-2 rounded-xl bg-muted/40 border border-border/50 px-3 py-4 hover:bg-muted/60 transition-colors">
        <span class="text-2xl">📐</span>
        <div>
          <p class="text-xs font-semibold leading-tight">Smart 9:16 Crop</p>
          <p class="text-[10px] text-muted-foreground mt-0.5 leading-snug">Auto vertical framing for Reels &amp; TikTok</p>
        </div>
      </div>
      <div class="flex flex-col items-center text-center gap-2 rounded-xl bg-muted/40 border border-border/50 px-3 py-4 hover:bg-muted/60 transition-colors">
        <span class="text-2xl">✍️</span>
        <div>
          <p class="text-xs font-semibold leading-tight">Auto Subtitles</p>
          <p class="text-[10px] text-muted-foreground mt-0.5 leading-snug">Burned-in captions on every short</p>
        </div>
      </div>
      <div class="flex flex-col items-center text-center gap-2 rounded-xl bg-muted/40 border border-border/50 px-3 py-4 hover:bg-muted/60 transition-colors">
        <span class="text-2xl">📄</span>
        <div>
          <p class="text-xs font-semibold leading-tight">Full Transcription</p>
          <p class="text-[10px] text-muted-foreground mt-0.5 leading-snug">SRT · VTT · JSON export</p>
        </div>
      </div>
      <div class="flex flex-col items-center text-center gap-2 rounded-xl bg-muted/40 border border-border/50 px-3 py-4 hover:bg-muted/60 transition-colors">
        <span class="text-2xl">🔁</span>
        <div>
          <p class="text-xs font-semibold leading-tight">Reusable Uploads</p>
          <p class="text-[10px] text-muted-foreground mt-0.5 leading-snug">Re-process or re-download any time</p>
        </div>
      </div>
      <div class="flex flex-col items-center text-center gap-2 rounded-xl bg-muted/40 border border-border/50 px-3 py-4 hover:bg-muted/60 transition-colors">
        <span class="text-2xl">⚡</span>
        <div>
          <p class="text-xs font-semibold leading-tight">Fast Processing</p>
          <p class="text-[10px] text-muted-foreground mt-0.5 leading-snug">Queue-based parallel rendering</p>
        </div>
      </div>
    </div>
  </div>
</template>
