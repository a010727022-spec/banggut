-- supabase/add-taste-preferences.sql
-- Add reading taste preferences to profiles for onboarding personalization

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_genres TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reading_frequency TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discussion_style TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
