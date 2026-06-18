-- Break / lunch support for office clock
-- Run in Supabase SQL Editor

alter table public.clock_sessions drop constraint if exists clock_sessions_status_check;

alter table public.clock_sessions
  add constraint clock_sessions_status_check
  check (status in ('active', 'paused', 'completed'));

notify pgrst, 'reload schema';
