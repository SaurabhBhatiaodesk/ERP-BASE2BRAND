-- Per-employee shift start time (10:00, 11:00, 12:00, etc.)
-- Run in Supabase SQL Editor

alter table public.employee_profiles
  add column if not exists shift_start text not null default '10:00';

update public.employee_profiles
set shift_start = '10:00'
where shift_start is null or trim(shift_start) = '';

-- Old system default was 11:00 — move to 10:00 AM (9h shift → 7:00 PM end)
update public.employee_profiles
set shift_start = '10:00'
where shift_start = '11:00';

notify pgrst, 'reload schema';
