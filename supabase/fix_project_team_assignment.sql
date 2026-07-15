-- =============================================================================
-- Fix project team assignments after DB migration
-- =============================================================================
-- Problem: projects.team may have OLD employee IDs from previous database.
--          Employees can't see their projects because team_ids don't match.
--
-- Run in Supabase SQL Editor (safe to re-run)
-- Requires: employee_profiles + projects tables
-- =============================================================================

-- Ensure relational columns/tables exist
alter table public.projects add column if not exists lead_id text references public.employee_profiles(id) on delete set null;
alter table public.projects add column if not exists team_ids jsonb not null default '[]'::jsonb;

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  employee_id text not null references public.employee_profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (project_id, employee_id)
);

-- ── 1) Backfill project_members from team names (exact + first-name match) ───
insert into public.project_members (project_id, employee_id, role)
select distinct p.id, ep.id, 'member'
from public.projects p
cross join lateral (
  select
    case
      when jsonb_typeof(elem) = 'string' then trim(both '"' from elem::text)
      when jsonb_typeof(elem) = 'object' then coalesce(elem->>'name', '')
      else ''
    end as member_name
  from jsonb_array_elements(
    case
      when p.team is null then '[]'::jsonb
      when jsonb_typeof(p.team) = 'array' then p.team
      else '[]'::jsonb
    end
  ) as elem
) names
join public.employee_profiles ep on (
  lower(trim(ep.name)) = lower(trim(names.member_name))
  or lower(split_part(trim(ep.name), ' ', 1)) = lower(trim(names.member_name))
  or lower(trim(names.member_name)) = lower(split_part(trim(ep.name), ' ', 1))
)
where trim(names.member_name) <> ''
  and names.member_name <> '—'
on conflict (project_id, employee_id) do nothing;

-- ── 2) Set project lead from projects.lead name ─────────────────────────────
update public.projects p
set lead_id = ep.id
from public.employee_profiles ep
where p.lead is not null
  and trim(p.lead) <> ''
  and p.lead <> '—'
  and (
    lower(trim(ep.name)) = lower(trim(p.lead))
    or lower(split_part(trim(ep.name), ' ', 1)) = lower(trim(p.lead))
    or lower(trim(p.lead)) = lower(split_part(trim(ep.name), ' ', 1))
  );

insert into public.project_members (project_id, employee_id, role)
select p.id, p.lead_id, 'lead'
from public.projects p
where p.lead_id is not null
on conflict (project_id, employee_id) do update set role = 'lead';

-- ── 3) Sync team_ids from project_members ─────────────────────────────────────
update public.projects p
set team_ids = sub.ids
from (
  select
    pm.project_id,
    coalesce(jsonb_agg(distinct pm.employee_id), '[]'::jsonb) as ids
  from public.project_members pm
  group by pm.project_id
) sub
where p.id = sub.project_id;

-- ── 4) Fix team JSON → store correct {id, name} objects ───────────────────────
update public.projects p
set team = sub.new_team
from (
  select
    p2.id as project_id,
    coalesce(
      jsonb_agg(
        jsonb_build_object('id', ep.id, 'name', ep.name)
        order by pm.created_at
      ),
      '[]'::jsonb
    ) as new_team
  from public.projects p2
  join public.project_members pm on pm.project_id = p2.id
  join public.employee_profiles ep on ep.id = pm.employee_id
  group by p2.id
) sub
where p.id = sub.project_id;

-- ── 5) Update employee_profiles.projects count ────────────────────────────────
update public.employee_profiles ep
set projects = coalesce(cnt.n, 0)
from (
  select employee_id, count(distinct project_id)::int as n
  from public.project_members
  group by employee_id
) cnt
where ep.id = cnt.employee_id;

-- ── 6) Verify: each employee's assigned projects ─────────────────────────────
select
  ep.name,
  ep.email,
  ep.projects as project_count,
  string_agg(p.name, ', ' order by p.name) as project_names
from public.employee_profiles ep
left join public.project_members pm on pm.employee_id = ep.id
left join public.projects p on p.id = pm.project_id
group by ep.id, ep.name, ep.email, ep.projects
order by ep.name;
