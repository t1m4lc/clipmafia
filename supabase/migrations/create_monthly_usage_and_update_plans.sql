-- ============================================
-- Migration: Create monthly_usage table & rename plans
-- ============================================

-- 1. Create the monthly_usage table
CREATE TABLE IF NOT EXISTS public.monthly_usage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  uploads_count INTEGER DEFAULT 0 NOT NULL CHECK (uploads_count >= 0),
  generations_count INTEGER DEFAULT 0 NOT NULL CHECK (generations_count >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month)
);

-- 2. Enable RLS (default deny for non-service-role clients)
ALTER TABLE public.monthly_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage (for display)
CREATE POLICY "Users can view own usage"
  ON public.monthly_usage FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT / UPDATE / DELETE policies for regular users.
-- Only the server (service-role / admin client) can write to this table.

-- 3. Auto-update updated_at timestamp
CREATE TRIGGER update_monthly_usage_updated_at
  BEFORE UPDATE ON public.monthly_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. Index for fast lookups by user + month
CREATE INDEX IF NOT EXISTS idx_monthly_usage_user_month
  ON public.monthly_usage (user_id, month);

-- ============================================
-- Rename subscription plans: basic → pro, pro → business
-- ============================================

-- Drop the old CHECK constraint
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_plan_check;

-- Rename existing plans (order matters: rename higher tier first)
UPDATE public.profiles
  SET subscription_plan = 'business'
  WHERE subscription_plan = 'pro';

UPDATE public.profiles
  SET subscription_plan = 'pro'
  WHERE subscription_plan = 'basic';

-- Add new CHECK constraint with updated plan names
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_plan_check
  CHECK (subscription_plan IN ('free', 'pro', 'business'));
