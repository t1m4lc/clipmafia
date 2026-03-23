<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

const user = useSupabaseUser()

// Redirect authenticated users away from the landing page
watch(
  user,
  (u) => {
    if (u) navigateTo('/dashboard')
  },
  { immediate: true },
)
</script>

<template>
  <div>
    <!-- Hero Section -->
    <section class="relative overflow-hidden">
      <!-- Navbar -->
      <nav class="container mx-auto flex h-16 items-center justify-between px-4">
        <div class="flex items-center gap-2 font-bold text-xl">
          <span class="text-2xl">🎬</span>
          <span class="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">ClipMafia</span>
        </div>
        <div class="flex items-center gap-4">
          <NuxtLink to="/login">
            <Button variant="ghost">Sign in</Button>
          </NuxtLink>
          <NuxtLink to="/register">
            <Button>Get Started</Button>
          </NuxtLink>
        </div>
      </nav>

      <!-- Hero Content -->
      <div class="container mx-auto px-4 py-24 text-center">
        <div class="mx-auto max-w-3xl space-y-6">
          <div class="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium">
            ✨ AI-Powered Video Processing
          </div>

          <h1 class="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Turn your videos into
            <span class="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              viral Shorts
            </span>
            in 1 click
          </h1>

          <p class="mx-auto max-w-2xl text-lg text-muted-foreground">
            Upload a horizontal video. Get vertical shorts with subtitles and smart framing.
            Perfect for YouTube Shorts, Instagram Reels, and TikTok.
          </p>

          <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
            <NuxtLink to="/register">
              <Button size="lg" class="text-lg px-8 py-6">
                🚀 Upload Your First Video
              </Button>
            </NuxtLink>
            <a href="#how-it-works">
              <Button variant="outline" size="lg" class="text-lg px-8 py-6">
                See How It Works
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section id="how-it-works" class="border-t bg-muted/50 py-24">
      <div class="container mx-auto px-4">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">How It Works</h2>
          <p class="mt-4 text-lg text-muted-foreground">Three simple steps to viral content</p>
        </div>

        <div class="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
          <div class="text-center space-y-4">
            <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
              📤
            </div>
            <h3 class="text-xl font-semibold">1. Upload</h3>
            <p class="text-muted-foreground">
              Upload your horizontal video. We support all major formats (MP4, MOV, AVI, etc.)
            </p>
          </div>

          <div class="text-center space-y-4">
            <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
              🤖
            </div>
            <h3 class="text-xl font-semibold">2. AI Processing</h3>
            <p class="text-muted-foreground">
              Our AI detects the best moments, crops to vertical format with smart framing, and adds subtitles.
            </p>
          </div>

          <div class="text-center space-y-4">
            <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
              📲
            </div>
            <h3 class="text-xl font-semibold">3. Download</h3>
            <p class="text-muted-foreground">
              Download your perfectly formatted shorts ready for YouTube, Instagram, and TikTok.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Demo Preview -->
    <section class="py-24">
      <div class="container mx-auto px-4">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">See It In Action</h2>
          <p class="mt-4 text-lg text-muted-foreground">From horizontal to vertical in seconds</p>
        </div>

        <div class="flex flex-col md:flex-row items-center justify-center gap-8 max-w-4xl mx-auto">
          <!-- Before -->
          <div class="space-y-3 text-center">
            <p class="text-sm font-medium text-muted-foreground">BEFORE</p>
            <div class="relative aspect-video w-80 rounded-lg bg-muted border-2 border-dashed flex items-center justify-center">
              <div class="text-center space-y-2">
                <span class="text-4xl">🎥</span>
                <p class="text-sm text-muted-foreground">16:9 Horizontal Video</p>
              </div>
            </div>
          </div>

          <!-- Arrow -->
          <div class="text-4xl">→</div>

          <!-- After -->
          <div class="space-y-3 text-center">
            <p class="text-sm font-medium text-muted-foreground">AFTER</p>
            <div class="relative w-44 aspect-[9/16] rounded-lg bg-gradient-to-b from-primary/20 to-primary/5 border-2 border-primary flex flex-col items-center justify-between p-4">
              <div class="text-center space-y-1">
                <span class="text-2xl">📱</span>
                <p class="text-xs text-muted-foreground">9:16 Vertical Short</p>
              </div>
              <div class="w-full rounded bg-black/50 px-2 py-1 text-center">
                <p class="text-xs text-white font-medium">Smart subtitles here</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section id="pricing" class="border-t bg-muted/50 py-24">
      <div class="container mx-auto px-4">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">Simple Pricing</h2>
          <p class="mt-4 text-lg text-muted-foreground">Start free, upgrade when you need more</p>
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
              <ul class="space-y-2 text-sm">
                <li class="flex items-center gap-2">✅ 3 videos/month</li>
                <li class="flex items-center gap-2">✅ Auto subtitles</li>
                <li class="flex items-center gap-2">✅ Center crop</li>
                <li class="flex items-center gap-2 text-muted-foreground">❌ Smart framing</li>
              </ul>
            </CardContent>
            <CardFooter>
              <NuxtLink to="/register" class="w-full">
                <Button variant="outline" class="w-full">Get Started</Button>
              </NuxtLink>
            </CardFooter>
          </Card>

          <!-- Basic -->
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
              <ul class="space-y-2 text-sm">
                <li class="flex items-center gap-2">✅ 20 videos/month</li>
                <li class="flex items-center gap-2">✅ Auto subtitles</li>
                <li class="flex items-center gap-2">✅ Smart framing</li>
                <li class="flex items-center gap-2">✅ Priority processing</li>
              </ul>
            </CardContent>
            <CardFooter>
              <NuxtLink to="/register" class="w-full">
                <Button class="w-full">Subscribe</Button>
              </NuxtLink>
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
              <ul class="space-y-2 text-sm">
                <li class="flex items-center gap-2">✅ 100 videos/month</li>
                <li class="flex items-center gap-2">✅ Auto subtitles</li>
                <li class="flex items-center gap-2">✅ Smart framing</li>
                <li class="flex items-center gap-2">✅ Priority processing</li>
                <li class="flex items-center gap-2">✅ API access</li>
              </ul>
            </CardContent>
            <CardFooter>
              <NuxtLink to="/register" class="w-full">
                <Button variant="outline" class="w-full">Subscribe</Button>
              </NuxtLink>
            </CardFooter>
          </Card>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t py-12">
      <div class="container mx-auto px-4 text-center text-sm text-muted-foreground">
        <p>© {{ new Date().getFullYear() }} ClipMafia. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>
