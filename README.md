# 🎬 ClipMafia

> Turn your videos into viral Shorts in 1 click

A full-stack SaaS web application built with Nuxt 4 (Vue 3) as a PWA. Upload horizontal videos and automatically generate vertical short videos (YouTube Shorts / Instagram Reels / TikTok) with AI-powered smart framing and burned-in subtitles.

## ✨ Features

- **AI-Powered Processing** — Deepgram speech-to-text + Mistral AI segment detection
- **Smart Framing** — Automatic vertical 9:16 crop with subject detection
- **Auto Subtitles** — Burned-in, mobile-optimized subtitles
- **Subscription System** — Stripe-powered plans with usage quotas
- **PWA** — Installable on mobile, offline fallback
- **Queue System** — Async background processing with status tracking

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Nuxt 4, Vue 3 (Composition API), shadcn/ui |
| Backend | Nitro server (Nuxt), API routes |
| Auth | Supabase Auth |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage |
| Payments | Stripe (subscriptions) |
| Video | FFmpeg (processing, subtitles) |
| Speech-to-Text | Deepgram API |
| AI/LLM | Mistral AI |
| PWA | @vite-pwa/nuxt |

## 📁 Project Structure

```
clipmafia/
├── nuxt.config.ts          # Nuxt configuration
├── app/                    # Frontend (Nuxt 4 app directory)
│   ├── app.vue             # Root component
│   ├── app.config.ts       # App configuration
│   ├── assets/css/         # Tailwind CSS + shadcn theme
│   ├── components/ui/      # shadcn/ui components
│   ├── composables/        # Vue composables (useAuth, useVideos, etc.)
│   ├── layouts/            # Page layouts (default, auth, dashboard)
│   ├── middleware/          # Route middleware (auth guard)
│   ├── pages/              # File-based routing
│   │   ├── index.vue       # Landing page
│   │   ├── login.vue       # Sign in
│   │   ├── register.vue    # Sign up
│   │   ├── pricing.vue     # Pricing page
│   │   └── dashboard/      # Protected dashboard
│   │       ├── index.vue   # Video list
│   │       ├── upload.vue  # Upload page
│   │       └── videos/[id].vue  # Video detail + shorts
│   ├── lib/utils.ts        # Utility functions (cn)
│   └── types/database.ts   # TypeScript types
├── server/                 # Backend (Nitro)
│   ├── api/
│   │   ├── process/        # Video processing endpoints
│   │   ├── videos/         # Video CRUD
│   │   ├── shorts/         # Generated shorts
│   │   ├── jobs/           # Job status
│   │   ├── stripe/         # Stripe checkout, webhook, portal
│   │   └── profile/        # User profile
│   ├── utils/              # Server utilities
│   │   ├── ffmpeg.ts       # FFmpeg commands
│   │   ├── deepgram.ts     # Speech-to-text
│   │   ├── mistral.ts      # AI segment detection
│   │   ├── queue.ts        # Job queue system
│   │   ├── stripe.ts       # Stripe client
│   │   └── supabase-admin.ts
│   └── middleware/
├── supabase/
│   └── schema.sql          # Database schema
└── public/                 # Static assets
    ├── offline.html        # PWA offline fallback
    └── icons/              # PWA icons
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- FFmpeg installed (`brew install ffmpeg` / `apt install ffmpeg`)
- Supabase project
- Stripe account
- Deepgram API key
- Mistral AI API key

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env

# 3. Fill in your .env with API keys

# 4. Run the database migration in Supabase SQL editor
# (paste contents of supabase/schema.sql)

# 5. Create Supabase storage buckets:
# videos (private), shorts (private), audio (private), thumbnails (public)

# 6. Start development server
npm run dev
```

### Environment Variables

See `.env.example` for all required variables.

## 🔄 Processing Pipeline

```
Upload Video
    │
    ▼
Step 1: Extract Audio (FFmpeg)
    │
    ▼
Step 2: Transcribe Speech (Deepgram API)
    │  Returns: [{ start, end, text }]
    ▼
Step 3: AI Segment Detection (Mistral AI)
    │  Returns: [{ start, end, title, score }]
    ▼
Step 4: Video Processing (FFmpeg)
    │  - Cut segments
    │  - Convert to vertical 9:16
    │  - Smart framing (center crop / face detection)
    ▼
Step 5: Burn Subtitles (FFmpeg + SRT)
    │  - Large readable text
    │  - Bottom-centered
    │  - Mobile-optimized
    ▼
Output: Downloadable short videos
```

### Key FFmpeg Commands

```bash
# Extract audio
ffmpeg -i input.mp4 -vn -acodec libmp3lame -ab 128k -ar 16000 -ac 1 audio.mp3

# Convert to vertical with center crop
ffmpeg -ss 32.5 -i input.mp4 -t 30 \
  -vf "scale=w='if(gt(iw/ih,1080/1920),1920*iw/ih,1080)':h='if(gt(iw/ih,1080/1920),1920,1080*ih/iw)',crop=1080:1920:(iw-1080)/2:(ih-1920)/2,setsar=1" \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k -movflags +faststart \
  segment.mp4

# Burn subtitles
ffmpeg -i segment.mp4 \
  -vf "subtitles='subtitles.srt':force_style='FontSize=22,Bold=1,Outline=2,Shadow=1,MarginV=60,Alignment=2'" \
  -c:v libx264 -preset medium -crf 23 \
  -c:a copy -movflags +faststart \
  output.mp4
```

## 💳 Subscription Plans

| Plan | Price | Videos/Month | Features |
|------|-------|-------------|----------|
| Free | $0 | 3 | Subtitles, Center crop |
| Basic | $19/mo | 20 | + Smart framing, Priority |
| Pro | $49/mo | 100 | + API access |

## 📱 PWA / Mobile App

The app is a Progressive Web App installable on:
- **iOS**: Add to Home Screen via Safari
- **Android**: Install prompt or Add to Home Screen
- **App Store**: Wrap with Capacitor or PWABuilder

## License

MIT
