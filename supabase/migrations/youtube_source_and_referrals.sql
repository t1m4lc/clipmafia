-- ============================================
-- Migration: YouTube-first ingestion + referral system
-- ============================================

-- ── 1. Videos: add source tracking ─────────────────────────────────────────
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'upload' CHECK (source IN ('youtube', 'upload')),
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS youtube_metadata JSONB;

-- Back-fill existing rows
UPDATE public.videos SET source = 'upload' WHERE source IS NULL;

-- Make storage_path nullable (YouTube videos don't have one)
ALTER TABLE public.videos ALTER COLUMN storage_path DROP NOT NULL;
ALTER TABLE public.videos ALTER COLUMN original_filename DROP NOT NULL;

-- ── 2. Profiles: add upload credits + referral code ────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS upload_credits INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Generate referral codes for existing users (8-char random alphanum)
UPDATE public.profiles
SET referral_code = LOWER(SUBSTR(MD5(RANDOM()::text || id::text), 1, 8))
WHERE referral_code IS NULL;

-- Auto-generate referral code for new users via trigger update
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    LOWER(SUBSTR(MD5(RANDOM()::text || NEW.id::text), 1, 8))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Monthly usage: add YouTube link counter ─────────────────────────────
ALTER TABLE public.monthly_usage
  ADD COLUMN IF NOT EXISTS youtube_links_count INTEGER DEFAULT 0 NOT NULL CHECK (youtube_links_count >= 0);

-- ── 4. Referrals table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'other')),
  credited BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id);

-- ── 5. Jobs: add clip_mode field ───────────────────────────────────────────
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS clip_mode TEXT DEFAULT 'full_render' CHECK (clip_mode IN ('transcript_only', 'full_render'));

-- ── 6. Update video status CHECK to include new states ─────────────────────
ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_status_check;
ALTER TABLE public.videos ADD CONSTRAINT videos_status_check
  CHECK (status IN ('uploaded', 'ready', 'processing', 'completed', 'failed'));

-- ── 7. Update job status CHECK to include new states ───────────────────────
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('queued', 'extracting_audio', 'transcribing', 'detecting_segments', 'processing_video', 'burning_subtitles', 'uploading', 'completed', 'failed'));
