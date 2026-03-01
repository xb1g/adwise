-- Add onboarding_done flag to elder_profiles
alter table public.elder_profiles
  add column if not exists onboarding_done boolean not null default false;

-- Add unique constraint on user_id so upsert works
alter table public.elder_profiles
  drop constraint if exists elder_profiles_user_id_key;

alter table public.elder_profiles
  add constraint elder_profiles_user_id_key unique (user_id);

-- Relax age_range check so voice AI can return free-form text
alter table public.elder_profiles
  drop constraint if exists elder_profiles_age_range_check;

-- Allow age_range to be any text (voice transcript may not match exact chip values)
