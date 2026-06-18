-- Merge legacy `employees` into `employee_profiles` and remove duplicate table.
-- Run once in Supabase SQL Editor.

alter table public.employee_profiles
  add column if not exists avatar text,
  add column if not exists trend text default 'up';

-- Copy missing avatar/trend/score from old employees table (if it exists)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'employees'
  ) then
    update public.employee_profiles ep
    set
      avatar = coalesce(ep.avatar, e.avatar),
      trend = coalesce(ep.trend, e.trend, 'up'),
      score = coalesce(ep.score, e.score),
      role = coalesce(nullif(ep.role, ''), e.role),
      dept = coalesce(nullif(ep.dept, ''), e.dept),
      status = coalesce(nullif(ep.status, ''), initcap(e.status))
    from public.employees e
    where lower(ep.name) = lower(e.name);

    insert into public.employee_profiles (
      id, name, role, dept, email, phone, location, joined,
      score, status, salary, manager, skills, bio, weekly_hours,
      attendance, leaves, projects, revenue, avatar, trend
    )
    select
      gen_random_uuid()::text,
      e.name,
      e.role,
      e.dept,
      '—',
      '—',
      'Remote',
      to_char(now(), 'Mon YYYY'),
      coalesce(e.score, 85),
      initcap(coalesce(e.status, 'active')),
      '₹0',
      'CEO Admin',
      array[e.role]::text[],
      e.role || ' at Base2Brand.',
      '[{"day":"Mon","h":8},{"day":"Tue","h":8},{"day":"Wed","h":8},{"day":"Thu","h":8},{"day":"Fri","h":8}]'::jsonb,
      100,
      0,
      0,
      '₹0',
      coalesce(e.avatar, upper(left(e.name, 2))),
      coalesce(e.trend, 'up')
    from public.employees e
    where not exists (
      select 1 from public.employee_profiles ep
      where lower(ep.name) = lower(e.name)
    );

    drop table public.employees;
  end if;
end $$;
