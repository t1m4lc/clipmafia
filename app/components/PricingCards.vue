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
  free: SUBSCRIPTION_LIMITS.FREE,
  pro: SUBSCRIPTION_LIMITS.PRO,
  business: SUBSCRIPTION_LIMITS.BUSINESS,
}

function formatSize(mb: number): string {
  if (mb < 1024) return `${mb} MB`
  return `${mb / 1024} GB`
}

/** True when we are in a context where the user is authenticated. */
const isAuthenticated = computed(() => props.currentPlan !== null)

/** Early-bird discount: show €9 instead of €15 when ?code=earlybid is in the URL. */
const route = useRoute()
const isEarlyBird = computed(() => route.query.code === 'earlybid')
const proPrice = computed(() => isEarlyBird.value ? '€9' : '€15')
</script>

<template>
  <!-- Heading -->
  <div class="text-center mb-16">
    <component :is="headingTag" class="font-bold tracking-tight" :class="headingTag === 'h1' ? 'text-4xl' : 'text-3xl sm:text-4xl'">
      Simple, transparent pricing
    </component>
    <p class="mt-4 text-lg text-muted-foreground">Choose the plan that fits your content creation needs</p>

    <!-- Early-bird banner -->
    <div v-if="isEarlyBird" class="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/30 px-4 py-1.5 text-sm font-medium text-primary">
      🎉 Early-bird deal applied — <b>€9/mo</b> instead of €15
    </div>
  </div>

  <!-- Cards grid -->
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
          <li class="flex items-center gap-2">✅ {{ limits.free.videoUploadsPerMonth }} video upload / month</li>
          <li class="flex items-center gap-2">✅ {{ limits.free.shortsGenerationsPerMonth }} shorts generations / month</li>
          <li class="flex items-center gap-2">✅ Auto subtitles</li>
          <li class="flex items-center gap-2">✅ Center crop framing</li>
          <li class="flex items-center gap-2 text-muted-foreground">⚠️ Max {{ formatSize(limits.free.maxFileSizeMb) }} per file</li>
          <li class="flex items-center gap-2 text-muted-foreground">⚠️ Watermark on shorts</li>
        </ul>
      </CardContent>
      <CardFooter>
        <!-- Authenticated: show plan status (free is always "current" or default) -->
        <template v-if="isAuthenticated">
          <Button variant="outline" class="w-full" disabled>
            {{ currentPlan === 'free' ? 'Current Plan' : 'Free Plan' }}
          </Button>
        </template>
        <!-- Public: link to register -->
        <template v-else>
          <NuxtLink to="/register" class="w-full">
            <Button variant="outline" class="w-full">Get Started</Button>
          </NuxtLink>
        </template>
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
        <div class="flex items-end gap-2">
          <div class="text-4xl font-bold">{{ proPrice }}<span class="text-lg font-normal text-muted-foreground">/mo</span></div>
          <div v-if="isEarlyBird" class="mb-1 text-sm text-muted-foreground line-through">€15</div>
        </div>
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
        <template v-if="isAuthenticated">
          <Button
            class="w-full"
            :disabled="loading || currentPlan === 'pro'"
            @click="emit('subscribe', 'pro')"
          >
            {{ currentPlan === 'pro' ? 'Current Plan' : loading ? 'Loading...' : 'Subscribe' }}
          </Button>
        </template>
        <template v-else>
          <NuxtLink to="/register" class="w-full">
            <Button class="w-full">Get Started</Button>
          </NuxtLink>
        </template>
      </CardFooter>
    </Card>

    <!-- Business -->
    <Card>
      <CardHeader>
        <CardTitle>Business</CardTitle>
        <CardDescription>For agencies &amp; teams</CardDescription>
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
        <template v-if="isAuthenticated">
          <Button
            variant="outline"
            class="w-full"
            :disabled="loading || currentPlan === 'business'"
            @click="emit('subscribe', 'business')"
          >
            {{ currentPlan === 'business' ? 'Current Plan' : loading ? 'Loading...' : 'Subscribe' }}
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

  <!-- Tagline -->
  <div class="text-center mt-16">
    <p class="mt-3 text-base font-medium text-primary">
      ⚡ Upload once, generate dozens of ready-to-post shorts in one click : <b>save hours of editing every week</b>.
    </p>
  </div>

  <!-- Transparency note -->
  <div class="mt-16 max-w-2xl mx-auto text-center text-xs text-muted-foreground space-y-2">
    <p>All plans include AI-powered segment detection and customizable subtitle styles.</p>
    <p>Usage counters reset automatically on the 1st of each month.</p>
    <p>Regenerating shorts counts toward your monthly generation limit.</p>
  </div>
</template>
