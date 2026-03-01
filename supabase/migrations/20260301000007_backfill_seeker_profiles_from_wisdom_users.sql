-- Backfill seeker profile rows for seekers who already have requests/bookings.
insert into public.seeker_profiles (user_id, name, onboarding_done)
select
  source.user_id,
  wu.name,
  false
from (
  select distinct seeker_id as user_id
  from public.bookings
  union
  select distinct seeker_id as user_id
  from public.elder_requests
) source
left join public.wisdom_users wu on wu.user_id = source.user_id
left join public.seeker_profiles sp on sp.user_id = source.user_id
where sp.user_id is null
  and wu.name is not null;
