create table if not exists seeker_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) unique not null,
  name text,
  age_range text,
  categories text[],
  problem_text text,
  onboarding_done boolean default false,
  created_at timestamptz default now()
);

alter table seeker_profiles enable row level security;

create policy "Users manage own seeker profile"
  on seeker_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
