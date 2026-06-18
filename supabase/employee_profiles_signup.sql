-- Employee profiles: app_role + signup insert access
-- Run in Supabase SQL Editor (safe to re-run)

alter table public.employee_profiles
  add column if not exists app_role text not null default 'employee';

alter table public.employee_profiles
  add column if not exists shift_start text not null default '10:00';

-- Backfill team leaders from designation
update public.employee_profiles
set app_role = 'teamlead'
where app_role = 'employee'
  and (role ilike '%team lead%' or role ilike '%teamlead%');

-- Allow app signup/login to read & write profiles
alter table public.employee_profiles enable row level security;

drop policy if exists "employee_profiles_select_all" on public.employee_profiles;
create policy "employee_profiles_select_all"
  on public.employee_profiles for select
  using (true);

drop policy if exists "employee_profiles_insert_signup" on public.employee_profiles;
create policy "employee_profiles_insert_signup"
  on public.employee_profiles for insert
  with check (true);

drop policy if exists "employee_profiles_update_signup" on public.employee_profiles;
create policy "employee_profiles_update_signup"
  on public.employee_profiles for update
  using (true);

notify pgrst, 'reload schema';
