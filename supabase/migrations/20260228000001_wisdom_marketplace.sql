-- supabase/migrations/20260228000001_wisdom_marketplace.sql

-- Role tracking (separate from existing user_profiles to avoid breaking the goals app)
create table if not exists public.wisdom_users (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text,
  role       text check (role in ('elder', 'seeker')),
  avatar_url text,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.wisdom_users enable row level security;
create policy "wisdom_users: own row" on public.wisdom_users
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Elder profiles
create table if not exists public.elder_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  age_range   text check (age_range in ('50s', '60s', '70s', '80s+')),
  life_areas  text[] not null default '{}',
  bio         text not null default '',
  is_seeded   boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.elder_profiles enable row level security;
create policy "elder_profiles: read all published" on public.elder_profiles
  for select using (true);
create policy "elder_profiles: own insert" on public.elder_profiles
  for insert with check (auth.uid() = user_id);
create policy "elder_profiles: own update" on public.elder_profiles
  for update using (auth.uid() = user_id);

-- Stories
create table if not exists public.stories (
  id               uuid primary key default gen_random_uuid(),
  elder_id         uuid not null references public.elder_profiles(id) on delete cascade,
  audio_url        text,
  transcript       text not null default '',
  life_areas       text[] not null default '{}',
  key_topics       text[] not null default '{}',
  wisdom_snippets  text[] not null default '{}',
  preview_text     text not null default '',
  tags             text[] not null default '{}',
  status           text not null default 'processing' check (status in ('processing', 'published')),
  created_at       timestamptz not null default now()
);

alter table public.stories enable row level security;
create policy "stories: read all published" on public.stories
  for select using (status = 'published' or auth.uid() = (
    select user_id from public.elder_profiles where id = elder_id
  ));
create policy "stories: own insert" on public.stories
  for insert with check (
    auth.uid() = (select user_id from public.elder_profiles where id = elder_id)
  );
create policy "stories: service update" on public.stories
  for update using (true);

-- Match results
create table if not exists public.matches (
  id           uuid primary key default gen_random_uuid(),
  seeker_id    uuid not null references auth.users(id) on delete cascade,
  problem_text text not null,
  result       jsonb not null default '[]',
  created_at   timestamptz not null default now()
);

alter table public.matches enable row level security;
create policy "matches: own rows" on public.matches
  using (auth.uid() = seeker_id) with check (auth.uid() = seeker_id);

-- Storage bucket for audio files
insert into storage.buckets (id, name, public)
values ('story-audio', 'story-audio', false)
on conflict do nothing;

create policy "story-audio: authenticated upload" on storage.objects
  for insert with check (bucket_id = 'story-audio' and auth.role() = 'authenticated');
create policy "story-audio: authenticated read" on storage.objects
  for select using (bucket_id = 'story-audio' and auth.role() = 'authenticated');
