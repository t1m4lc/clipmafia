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
          <div class="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-semibold text-primary">
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

        <div class="flex flex-col md:flex-row items-center justify-center gap-12 max-w-4xl mx-auto">
          <!-- Before -->
          <div class="space-y-3 text-center shrink-0">
            <p class="text-sm font-medium text-muted-foreground uppercase tracking-wider">Before</p>
            <div class="relative aspect-video w-72 rounded-xl bg-muted border-2 border-dashed flex items-center justify-center shadow-sm">
              <div class="text-center space-y-2">
                <span class="text-4xl">🎥</span>
                <p class="text-sm text-muted-foreground">1 × Horizontal Video</p>
                <p class="text-xs text-muted-foreground/60">16:9 · MP4 / MOV</p>
              </div>
            </div>
          </div>

          <!-- Arrow -->
          <div class="flex flex-col items-center gap-2 shrink-0">
            <span class="text-3xl text-primary">→</span>
            <span class="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">AI magic</span>
          </div>

          <!-- After — deck of shorts -->
          <div class="space-y-3 text-center shrink-0">
            <p class="text-sm font-medium text-muted-foreground uppercase tracking-wider">After</p>
            <!-- Deck container -->
            <div class="relative mx-auto" style="width: 10rem; height: 17.5rem;">
              <!-- Card 5 (deepest) -->
              <div
                class="absolute inset-0 rounded-xl bg-purple-400/10 border border-purple-300/40 shadow-sm"
                style="transform: translate(26px, 10px) rotate(10deg);"
              />
              <!-- Card 4 -->
              <div
                class="absolute inset-0 rounded-xl bg-purple-300/15 border border-purple-300/50 shadow"
                style="transform: translate(19px, 7px) rotate(7deg);"
              />
              <!-- Card 3 -->
              <div
                class="absolute inset-0 rounded-xl bg-primary/10 border border-primary/30 shadow"
                style="transform: translate(12px, 4px) rotate(4deg);"
              />
              <!-- Card 2 -->
              <div
                class="absolute inset-0 rounded-xl bg-primary/15 border border-primary/45 shadow-md"
                style="transform: translate(6px, 2px) rotate(2deg);"
              />
              <!-- Card 1 (front) -->
              <div
                class="absolute inset-0 rounded-xl bg-gradient-to-b from-primary/30 to-primary/10 border-2 border-primary shadow-xl flex flex-col items-center justify-between p-3"
                style="z-index: 10;"
              >
                <div class="text-center space-y-1 pt-2">
                  <span class="text-3xl">📱</span>
                  <p class="text-xs font-semibold text-primary">Short #1</p>
                  <p class="text-[10px] text-muted-foreground">9:16 · Smart crop</p>
                </div>
                <div class="w-full rounded-md bg-black/10 px-2 py-1.5 text-center">
                  <p class="text-[10px] font-medium">✨ Auto subtitles</p>
                </div>
              </div>
              <!-- Batch badge -->
              <div
                class="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-lg ring-2 ring-background"
                style="z-index: 20;"
              >
                ∞
              </div>
            </div>
            <p class="text-xs text-muted-foreground">Generate multiple shorts from one upload</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="border-t py-24">
      <div class="container mx-auto px-4">
        <div class="text-center mb-16">
          <div class="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary uppercase tracking-wider mb-5">
            ✦ What ClipMafia Offers
          </div>
          <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">Everything included in every plan</h2>
          <p class="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            No hidden add-ons, no locked features. Every AI capability is unlocked from day one.
          </p>
        </div>
        <div class="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <!-- Viral Detection -->
          <div class="rounded-2xl border bg-card p-6 space-y-4 hover:shadow-md transition-shadow">
            <div class="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-2xl">🧠</div>
            <div>
              <h3 class="font-semibold text-base">AI Viral Detection</h3>
              <p class="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Our AI analyzes every second and scores each segment by engagement potential — so only your best moments become Shorts.
              </p>
            </div>
          </div>
          <!-- Auto Subtitles -->
          <div class="rounded-2xl border bg-card p-6 space-y-4 hover:shadow-md transition-shadow">
            <div class="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-2xl">✍️</div>
            <div>
              <h3 class="font-semibold text-base">Auto Subtitles</h3>
              <p class="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Burned-in captions powered by Deepgram AI. High accuracy, multi-language support, always in sync.
              </p>
            </div>
          </div>
          <!-- Smart Crop -->
          <div class="rounded-2xl border bg-card p-6 space-y-4 hover:shadow-md transition-shadow">
            <div class="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-2xl">📐</div>
            <div>
              <h3 class="font-semibold text-base">Smart 9:16 Crop</h3>
              <p class="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Speaker tracking keeps your subject perfectly centered for every cut. Optimised for YouTube Shorts, TikTok &amp; Instagram Reels.
              </p>
            </div>
          </div>
          <!-- Transcription -->
          <div class="rounded-2xl border bg-card p-6 space-y-4 hover:shadow-md transition-shadow">
            <div class="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-2xl">📄</div>
            <div>
              <h3 class="font-semibold text-base">Full Transcription</h3>
              <p class="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Every word of your video as text. Export as SRT, VTT or JSON — perfect for blog posts, newsletters, or repurposing on social.
              </p>
            </div>
          </div>
          <!-- Reusable Files -->
          <div class="rounded-2xl border bg-card p-6 space-y-4 hover:shadow-md transition-shadow">
            <div class="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-2xl">🔁</div>
            <div>
              <h3 class="font-semibold text-base">Reusable Uploads</h3>
              <p class="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Uploaded videos stay in your library permanently. Change subtitle styles, re-run the AI, or re-download any format at any time.
              </p>
            </div>
          </div>
          <!-- Fast Processing -->
          <div class="rounded-2xl border bg-card p-6 space-y-4 hover:shadow-md transition-shadow">
            <div class="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-2xl">⚡</div>
            <div>
              <h3 class="font-semibold text-base">Fast Processing</h3>
              <p class="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Queue-based parallel rendering powered by FFmpeg. Most videos are processed in under 2 minutes — no waiting around.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="border-t bg-muted/50 py-24">
      <div class="container mx-auto px-4 text-center">
        <div class="mx-auto max-w-2xl space-y-6">
          <div class="text-5xl">🎬</div>
          <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to <span class="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">go viral</span>?
          </h2>
          <p class="text-lg text-muted-foreground">
            Join creators who save hours of editing every week. Upload your first video free, no credit card needed.
          </p>
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
            <NuxtLink to="/register">
              <Button size="lg" class="text-lg px-8 py-6">
                🚀 Start for Free
              </Button>
            </NuxtLink>
            <NuxtLink to="/pricing">
              <Button size="lg" variant="outline" class="text-lg px-8 py-6">
                View Pricing
              </Button>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t py-12">
      <div class="container mx-auto px-4">
        <div class="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div class="flex items-center gap-2 font-bold text-xl">
            <span class="text-2xl">🎬</span>
            <span class="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">ClipMafia</span>
          </div>
          <nav class="flex items-center gap-6 text-sm text-muted-foreground">
            <NuxtLink to="/#features" class="hover:text-foreground transition-colors">Features</NuxtLink>
            <NuxtLink to="/pricing" class="hover:text-foreground transition-colors">Pricing</NuxtLink>
            <NuxtLink to="/login" class="hover:text-foreground transition-colors">Sign in</NuxtLink>
            <NuxtLink to="/register" class="hover:text-foreground transition-colors">Get started</NuxtLink>
          </nav>
          <p class="text-sm text-muted-foreground">© {{ new Date().getFullYear() }} ClipMafia. All rights reserved.</p>
        </div>
      </div>
    </footer>
  </div>
</template>
