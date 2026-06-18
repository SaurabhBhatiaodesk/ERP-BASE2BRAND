-- App access role lives on employee_profiles (source of truth for login).
-- Run in Supabase SQL Editor.

alter table public.employee_profiles
  add column if not exists app_role text not null default 'employee';

-- Backfill from existing dept / designation for old rows
update public.employee_profiles
set app_role = 'ceo'
where dept = 'Executive'
   or name = 'CEO Admin'
   or role ilike '%ceo%'
   or role ilike '%admin%';

update public.employee_profiles
set app_role = 'developer'
where app_role = 'employee'
  and (dept ilike '%develop%' or role ilike '%developer%' or role ilike '%dev%');

update public.employee_profiles
set app_role = 'designer'
where app_role = 'employee'
  and (dept ilike '%design%' or role ilike '%design%');

update public.employee_profiles
set app_role = 'marketing'
where app_role = 'employee'
  and (dept ilike '%market%' or role ilike '%market%');

update public.employee_profiles
set app_role = 'hr'
where app_role = 'employee'
  and (dept ilike '%hr%' or dept ilike '%people%' or role ilike '%hr%');

update public.employee_profiles
set app_role = 'teamlead'
where app_role = 'employee'
  and (role ilike '%team lead%' or role ilike '%teamlead%' or (role ilike '%lead%' and role not ilike '%developer%'));

-- Refresh PostgREST schema cache immediately
notify pgrst, 'reload schema';
