-- Add scheduling columns to bookings
alter table public.bookings
  add column if not exists scheduled_date date,
  add column if not exists scheduled_time text;
