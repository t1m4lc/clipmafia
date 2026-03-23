-- Migration: Add transcript to videos and failed_at_step to jobs
-- Run this in the Supabase SQL Editor

-- Add transcript column to videos table (caches extracted subtitles)
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS transcript JSONB;

-- Add failed_at_step column to jobs table (tracks which step failed for resume)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS failed_at_step TEXT;

-- Add steps column to jobs table (per-step status: pending/loading/done/error)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '{}';

-- Add saved_segments column to videos table (dev mode: user-selected valuable segments)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS subtitle_settings JSONB;
