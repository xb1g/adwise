-- Allow elders to read seeker profiles for seekers who booked them.
create policy "seeker_profiles: elder can read requesting seekers" on public.seeker_profiles
  for select using (
    exists (
      select 1
      from public.bookings b
      where b.seeker_id = user_id
        and auth.uid() = (
          select user_id
          from public.elder_profiles
          where id = b.elder_id
        )
    )
  );
