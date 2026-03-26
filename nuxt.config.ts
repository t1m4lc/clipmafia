// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  future: {
    compatibilityVersion: 4,
  },

  modules: [
    "@nuxtjs/supabase",
    "@nuxtjs/tailwindcss",
    "@vite-pwa/nuxt",
    "shadcn-nuxt",
  ],

  // shadcn-nuxt config
  shadcn: {
    prefix: "",
    componentDir: "./app/components/ui",
  },

  // Runtime config - env variables
  runtimeConfig: {
    // Private keys (server-only)
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    deepgramApiKey: process.env.DEEPGRAM_API_KEY || "",
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    // Bypass — skip all Stripe/quota checks
    bypassPayment: process.env.BYPASS_PAYMENT === "true",
    // Admin dashboard secret (protects /api/admin/* routes)
    adminSecret: process.env.ADMIN_SECRET || "",
    // Internal secret shared between start.post.ts and run.post.ts
    internalSecret: process.env.INTERNAL_SECRET || "",

    // Public keys (available client-side)
    public: {
      appUrl: process.env.APP_URL || "http://localhost:3000",
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
      stripePriceIdStarter: process.env.STRIPE_PRICE_ID_STARTER || "",
      stripePriceIdPro: process.env.STRIPE_PRICE_ID_PRO || "",
      // Exposed to client so the UI can also bypass quota/plan checks
      bypassPayment: process.env.BYPASS_PAYMENT === "true",
      // Dev mode: show segment review panel & debug tools
      devMode: process.env.DEV_MODE === "true",
    },
  },

  // Supabase config
  supabase: {
    types: "./shared/types/database.types.ts",
    redirect: false,
    redirectOptions: {
      login: "/login",
      callback: "/confirm",
      include: ["/dashboard(/*)?"],
      exclude: [],
    },
  },

  // PWA config
  pwa: {
    registerType: "autoUpdate",
    manifest: {
      name: "ClipMafia - Video Shorts Generator",
      short_name: "ClipMafia",
      description: "Turn your videos into viral Shorts in 1 click",
      theme_color: "#0f172a",
      background_color: "#0f172a",
      display: "standalone",
      orientation: "portrait",
      scope: "/",
      start_url: "/",
      icons: [
        {
          src: "/icons/icon-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/icons/icon-512x512.png",
          sizes: "512x512",
          type: "image/png",
        },
        {
          src: "/icons/icon-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    workbox: {
      navigateFallback: null,
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
          handler: "NetworkFirst",
          options: {
            cacheName: "supabase-cache",
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 300,
            },
          },
        },
      ],
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: false,
    },
  },

  // Tailwind CSS config
  tailwindcss: {
    cssPath: "~/assets/css/main.css",
  },

  // App head
  app: {
    head: {
      title: "ClipMafia - Turn Videos into Viral Shorts",
      meta: [
        { charset: "utf-8" },
        {
          name: "viewport",
          content:
            "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
        },
        {
          name: "description",
          content:
            "Turn your long-form videos into viral Shorts, Reels, and TikToks in 1 click. AI-powered smart framing and subtitles.",
        },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        {
          name: "apple-mobile-web-app-status-bar-style",
          content: "black-translucent",
        },
      ],
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        { rel: "apple-touch-icon", href: "/icons/icon-192x192.png" },
      ],
    },
  },

  // Nitro server config
  nitro: {
    experimental: {
      tasks: true,
    },
  },

  compatibilityDate: "2025-03-23",
});
