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
}>(), {
  currentPlan: null,
  loading: false,
  headingTag: 'h2',
})

const emit = defineEmits<{
  subscribe: [plan: 'pro' | 'business']
}>()

const limits = {
  free: SUBSCRIPTION_CONFIG.FREE,
  pro: SUBSCRIPTION_CONFIG.PRO,
  business: SUBSCRIPTION_CONFIG.BUSINESS,
}


function formatSize(mb: number): string {
  if (mb < 1024) return `${mb} MB`
  return `${mb / 1024} GB`
}

/** True when we are in a context where the user is authenticated. */
const isAuthenticated = computed(() => props.currentPlan !== null)

/** Early-bird discount: show €9 instead of the config price when ?code=earlybid is in the URL. */
const route = useRoute()
const isEarlyBird = computed(() => route.query.code === 'earlybid')
const proPrice = computed(() => isEarlyBird.value ? '€9' : `€${limits.pro.price}`)
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
      Paste a YouTube link for free. Upload your own videos for the full rendering pipeline.
    </p>

    <!-- Early-bird banner -->
    <div
      v-if="isEarlyBird"
      class="mt-5 inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/30 px-4 py-1.5 text-sm font-medium text-primary"
    >
      🎉 Early-bird deal applied — <b>€9/mo</b> instead of €15
    </div>
  </div>

  <!-- ─── Pricing cards ────────────────────────────────────────────────── -->
  <div class="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto items-start">

    <!-- Free ─────────────────────── -->
    <Card class="flex flex-col">
      <CardHeader class="pb-4">
        <CardTitle class="text-xl">Free</CardTitle>
        <CardDescription>Paste YouTube links and discover viral moments — no card needed</CardDescription>
      </CardHeader>
      <CardContent class="flex-1 space-y-5">
        <div class="text-4xl font-bold">
          €0<span class="text-lg font-normal text-muted-foreground">/mo</span>
        </div>

        <!-- Limits table -->
        <div class="rounded-xl bg-muted/50 divide-y divide-border text-sm overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">YouTube links / month</span>
            <span class="font-semibold text-green-600 dark:text-green-400">{{ limits.free.youtubeLinksPerMonth }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">File uploads / month</span>
            <span class="font-semibold text-muted-foreground">{{ limits.free.videoUploadsPerMonth }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">Max video length</span>
            <span class="font-semibold">{{ limits.free.maxDurationMinutes }} min</span>
          </div>
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">Clips per generation</span>
            <span class="font-semibold">{{ limits.free.maxClipsPerGeneration }}</span>
          </div>
        </div>

        <!-- Differentiators -->
        <ul class="space-y-2.5 text-sm">
          <li class="flex items-center gap-2.5">
            <span class="text-green-500 shrink-0 font-bold">✓</span>
            <span>AI viral moment detection</span>
          </li>
          <li class="flex items-center gap-2.5">
            <span class="text-green-500 shrink-0 font-bold">✓</span>
            <span>Timestamped clip highlights</span>
          </li>
          <li class="flex items-start gap-2.5 text-muted-foreground">
            <span class="mt-0.5 text-amber-500 shrink-0">⚠</span>
            <span>No video rendering (timestamps only)</span>
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

    <!-- Pro ─────────────────────── -->
    <Card class="border-primary shadow-xl relative flex flex-col">
      <div class="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
        <Badge class="px-3 py-1 text-xs">⭐ Most Popular</Badge>
      </div>
      <CardHeader class="pb-4">
        <CardTitle class="text-xl">Pro</CardTitle>
        <CardDescription>For solo creators who ship every week</CardDescription>
      </CardHeader>
      <CardContent class="flex-1 space-y-5">
        <div class="flex items-end gap-2">
          <div class="text-4xl font-bold">
            {{ proPrice }}<span class="text-lg font-normal text-muted-foreground">/mo</span>
          </div>
          <div v-if="isEarlyBird" class="mb-1 text-sm text-muted-foreground line-through">€{{ limits.pro.price }}</div>
        </div>

        <!-- Limits table -->
        <div class="rounded-xl bg-primary/5 border border-primary/20 divide-y divide-primary/10 text-sm overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">YouTube links / month</span>
            <span class="font-semibold">{{ limits.pro.youtubeLinksPerMonth }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">File uploads / month</span>
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
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">Clips per generation</span>
            <span class="font-semibold">{{ limits.pro.maxClipsPerGeneration }}</span>
          </div>
        </div>

        <!-- Differentiators -->
        <ul class="space-y-2.5 text-sm">
          <li class="flex items-center gap-2.5">
            <span class="text-green-500 shrink-0 font-bold">✓</span>
            <span>Full video rendering &amp; download</span>
          </li>
          <li class="flex items-center gap-2.5">
            <span class="text-green-500 shrink-0 font-bold">✓</span>
            <span>Burned-in subtitles &amp; smart crop</span>
          </li>
          <li class="flex items-center gap-2.5">
            <span class="text-green-500 shrink-0 font-bold">✓</span>
            <span>No watermark on shorts</span>
          </li>
          <li class="flex items-center gap-2.5">
            <span class="text-green-500 shrink-0 font-bold">✓</span>
            <span>Priority processing queue</span>
          </li>
        </ul>
      </CardContent>
      <CardFooter class="pt-2">
        <template v-if="isAuthenticated">
          <Button
            class="w-full"
            :disabled="loading || currentPlan === 'pro'"
            @click="emit('subscribe', 'pro')"
          >
            {{ currentPlan === 'pro' ? 'Current Plan' : loading ? 'Loading…' : 'Subscribe' }}
          </Button>
        </template>
        <template v-else>
          <NuxtLink to="/register" class="w-full">
            <Button class="w-full">Get Started</Button>
          </NuxtLink>
        </template>
      </CardFooter>
    </Card>

    <!-- Business ─────────────────── -->
    <Card class="flex flex-col">
      <CardHeader class="pb-4">
        <CardTitle class="text-xl">Business</CardTitle>
        <CardDescription>For agencies &amp; high-volume teams</CardDescription>
      </CardHeader>
      <CardContent class="flex-1 space-y-5">
        <div class="text-4xl font-bold">
          €{{ limits.business.price }}<span class="text-lg font-normal text-muted-foreground">/mo</span>
        </div>

        <!-- Limits table -->
        <div class="rounded-xl bg-muted/50 divide-y divide-border text-sm overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">YouTube links / month</span>
            <span class="font-semibold">{{ limits.business.youtubeLinksPerMonth === 999 ? 'Unlimited' : limits.business.youtubeLinksPerMonth }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">File uploads / month</span>
            <span class="font-semibold">{{ limits.business.videoUploadsPerMonth }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">Max video length</span>
            <span class="font-semibold">{{ limits.business.maxDurationMinutes }} min</span>
          </div>
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">Max file size</span>
            <span class="font-semibold">{{ formatSize(limits.business.maxFileSizeMb) }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-2.5">
            <span class="text-muted-foreground">Clips per generation</span>
            <span class="font-semibold">{{ limits.business.maxClipsPerGeneration }}</span>
          </div>
        </div>

        <!-- Differentiators -->
        <ul class="space-y-2.5 text-sm">
          <li class="flex items-center gap-2.5">
            <span class="text-green-500 shrink-0 font-bold">✓</span>
            <span>Full video rendering &amp; download</span>
          </li>
          <li class="flex items-center gap-2.5">
            <span class="text-green-500 shrink-0 font-bold">✓</span>
            <span>Burned-in subtitles &amp; smart crop</span>
          </li>
          <li class="flex items-center gap-2.5">
            <span class="text-green-500 shrink-0 font-bold">✓</span>
            <span>No watermark on shorts</span>
          </li>
          <li class="flex items-center gap-2.5">
            <span class="text-green-500 shrink-0 font-bold">✓</span>
            <span>Priority processing queue</span>
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
            :disabled="loading || currentPlan === 'business'"
            @click="emit('subscribe', 'business')"
          >
            {{ currentPlan === 'business' ? 'Current Plan' : loading ? 'Loading…' : 'Subscribe' }}
          </Button>
        </template>
        <template v-else>
          <NuxtLink to="/register" class="w-full">
            <Button variant="outline" class="w-full">Contact Sales</Button>
          </NuxtLink>
        </template>
      </CardFooter>
    </Card>
  </div>

  <!-- ─── Tagline ──────────────────────────────────────────────────────── -->
  <div class="text-center mt-14">
    <p class="text-base font-medium text-primary">
      ⚡ Paste a YouTube link → get viral clip timestamps in seconds. Upload your own videos for the full rendering pipeline.
    </p>
  </div>

  <!-- ─── Transparency note ────────────────────────────────────────────── -->
  <div class="mt-10 max-w-2xl mx-auto text-center text-xs text-muted-foreground space-y-1.5">
    <p>All plans include AI-powered segment detection and fully customisable subtitle styles.</p>
    <p>YouTube link and upload counters reset automatically on the 1st of each month.</p>
  </div>
</template>
