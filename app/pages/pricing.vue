<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

const user = useSupabaseUser()
const { profile, fetchProfile } = useProfile()
const loading = ref(false)
const config = useRuntimeConfig()

onMounted(() => {
  if (user.value) {
    fetchProfile()
  }
})

async function subscribe(plan: 'basic' | 'pro') {
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
        <p class="mt-4 text-lg text-muted-foreground">Choose the plan that fits your needs</p>
      </div>

      <div class="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
        <!-- Free -->
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <CardDescription>For trying it out</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="text-4xl font-bold">$0<span class="text-lg font-normal text-muted-foreground">/mo</span></div>
            <ul class="space-y-3 text-sm">
              <li class="flex items-center gap-2">✅ 3 videos per month</li>
              <li class="flex items-center gap-2">✅ Auto subtitles</li>
              <li class="flex items-center gap-2">✅ Center crop framing</li>
              <li class="flex items-center gap-2 text-muted-foreground">❌ Smart AI framing</li>
              <li class="flex items-center gap-2 text-muted-foreground">❌ Priority processing</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              class="w-full"
              :disabled="profile?.subscription_plan === 'free'"
            >
              {{ profile?.subscription_plan === 'free' ? 'Current Plan' : 'Downgrade' }}
            </Button>
          </CardFooter>
        </Card>

        <!-- Basic (highlighted) -->
        <Card class="border-primary shadow-lg relative">
          <div class="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge>Most Popular</Badge>
          </div>
          <CardHeader>
            <CardTitle>Basic</CardTitle>
            <CardDescription>For content creators</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="text-4xl font-bold">$19<span class="text-lg font-normal text-muted-foreground">/mo</span></div>
            <ul class="space-y-3 text-sm">
              <li class="flex items-center gap-2">✅ 20 videos per month</li>
              <li class="flex items-center gap-2">✅ Auto subtitles</li>
              <li class="flex items-center gap-2">✅ Smart AI framing</li>
              <li class="flex items-center gap-2">✅ Priority processing</li>
              <li class="flex items-center gap-2 text-muted-foreground">❌ API access</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              class="w-full"
              :disabled="loading || profile?.subscription_plan === 'basic'"
              @click="subscribe('basic')"
            >
              {{ profile?.subscription_plan === 'basic' ? 'Current Plan' : loading ? 'Loading...' : 'Subscribe' }}
            </Button>
          </CardFooter>
        </Card>

        <!-- Pro -->
        <Card>
          <CardHeader>
            <CardTitle>Pro</CardTitle>
            <CardDescription>For agencies & teams</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="text-4xl font-bold">$49<span class="text-lg font-normal text-muted-foreground">/mo</span></div>
            <ul class="space-y-3 text-sm">
              <li class="flex items-center gap-2">✅ 100 videos per month</li>
              <li class="flex items-center gap-2">✅ Auto subtitles</li>
              <li class="flex items-center gap-2">✅ Smart AI framing</li>
              <li class="flex items-center gap-2">✅ Priority processing</li>
              <li class="flex items-center gap-2">✅ API access</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              class="w-full"
              :disabled="loading || profile?.subscription_plan === 'pro'"
              @click="subscribe('pro')"
            >
              {{ profile?.subscription_plan === 'pro' ? 'Current Plan' : loading ? 'Loading...' : 'Subscribe' }}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  </div>
</template>
