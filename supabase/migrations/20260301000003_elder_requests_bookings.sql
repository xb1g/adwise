-- elder_requests: records which elders appeared in a seeker's match results
create table if not exists public.elder_requests (
  id           uuid primary key default gen_random_uuid(),
  elder_id     uuid not null references public.elder_profiles(id) on delete cascade,
  seeker_id    uuid not null references auth.users(id) on delete cascade,
  problem_text text not null,
  match_reason text not null default '',
  rank         integer not null default 1,
  created_at   timestamptz not null default now()
);

alter table public.elder_requests enable row level security;

-- Elder can read requests where they are the matched elder
create policy "elder_requests: elder can read own" on public.elder_requests
  for select using (
    auth.uid() = (select user_id from public.elder_profiles where id = elder_id)
  );

-- Seeker can insert after getting match results
create policy "elder_requests: seeker can insert" on public.elder_requests
  for insert with check (auth.uid() = seeker_id);

-- bookings: when a seeker books a conversation with an elder
create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  elder_id     uuid not null references public.elder_profiles(id) on delete cascade,
  seeker_id    uuid not null references auth.users(id) on delete cascade,
  problem_text text not null default '',
  match_reason text not null default '',
  status       text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at   timestamptz not null default now()
);

alter table public.bookings enable row level security;

-- Elder can read their own bookings
create policy "bookings: elder can read own" on public.bookings
  for select using (
    auth.uid() = (select user_id from public.elder_profiles where id = elder_id)
  );

-- Seeker can insert and read their own bookings
create policy "bookings: seeker can insert" on public.bookings
  for insert with check (auth.uid() = seeker_id);

create policy "bookings: seeker can read own" on public.bookings
  for select using (auth.uid() = seeker_id);
