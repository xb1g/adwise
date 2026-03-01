-- Add name column to elder_profiles
ALTER TABLE public.elder_profiles ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';
