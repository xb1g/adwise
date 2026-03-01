-- Allow elders to read seeker profiles for seekers who requested their help.
create policy "seeker_profiles: elder can read requested seekers" on public.seeker_profiles
  for select using (
    exists (
      select 1
      from public.elder_requests er
      where er.seeker_id = user_id
        and auth.uid() = (
          select user_id
          from public.elder_profiles
          where id = er.elder_id
        )
    )
  );
