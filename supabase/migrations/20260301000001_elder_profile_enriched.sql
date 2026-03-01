-- Add enriched profile columns to elder_profiles
alter table public.elder_profiles
  add column if not exists raw_transcript jsonb,
  add column if not exists key_topics text[] not null default '{}',
  add column if not exists wisdom_summary text not null default '';
