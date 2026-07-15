-- =============================================================================
-- Diagnose + fix broken project ↔ employee ID links
-- =============================================================================
-- Data "already exists" in projects.team_ids / lead_id, but IDs may be ORPHAN
-- (old database UUIDs that don't exist in employee_profiles anymore).
--
-- Run in Supabase SQL Editor
-- =============================================================================

-- ── DIAGNOSE: orphaned IDs (don't exist in employee_profiles) ────────────────
select
  p.id,
  p.name as project_name,
  p.lead as lead_name,
  p.lead_id,
  p.team_ids,
  exists (select 1 from public.employee_profiles ep where ep.id = p.lead_id) as lead_id_valid
from public.projects p
where p.lead_id is not null
  and not exists (select 1 from public.employee_profiles ep where ep.id = p.lead_id)
order by p.name;

select
  p.id,
  p.name as project_name,
  tid.value as orphan_team_id
from public.projects p
cross join lateral jsonb_array_elements_text(
  case
    when jsonb_typeof(p.team_ids) = 'array' then p.team_ids
    else '[]'::jsonb
  end
) as tid(value)
where not exists (
  select 1 from public.employee_profiles ep where ep.id = tid.value
)
order by p.name;

-- ── FIX: remap lead_id + team_ids using projects.lead NAME ───────────────────
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
  )
  and (
    p.lead_id is null
    or not exists (select 1 from public.employee_profiles x where x.id = p.lead_id)
  );

-- Rebuild team_ids from valid lead_id + project_members
update public.projects p
set team_ids = coalesce(sub.ids, '[]'::jsonb)
from (
  select
    pm.project_id,
    jsonb_agg(distinct pm.employee_id) as ids
  from public.project_members pm
  join public.employee_profiles ep on ep.id = pm.employee_id
  group by pm.project_id
) sub
where p.id = sub.project_id;

-- Projects with valid lead but empty/wrong team_ids → set team_ids = [lead_id]
update public.projects p
set team_ids = jsonb_build_array(p.lead_id)
where p.lead_id is not null
  and exists (select 1 from public.employee_profiles ep where ep.id = p.lead_id)
  and (
    p.team_ids is null
    or p.team_ids = '[]'::jsonb
    or exists (
      select 1
      from jsonb_array_elements_text(p.team_ids) tid
      where not exists (select 1 from public.employee_profiles ep where ep.id = tid)
    )
  );

-- Fix team JSON → correct {id, name} from employee_profiles
update public.projects p
set team = sub.new_team
from (
  select
    p2.id as project_id,
    coalesce(
      jsonb_agg(
        jsonb_build_object('id', ep.id, 'name', ep.name)
        order by ep.name
      ),
      '[]'::jsonb
    ) as new_team
  from public.projects p2
  cross join lateral jsonb_array_elements_text(
    case
      when jsonb_typeof(p2.team_ids) = 'array' then p2.team_ids
      else '[]'::jsonb
    end
  ) as tid(value)
  join public.employee_profiles ep on ep.id = tid.value
  group by p2.id
) sub
where p.id = sub.project_id;

-- Sync project_members from fixed team_ids
insert into public.project_members (project_id, employee_id, role)
select p.id, ep.id, case when ep.id = p.lead_id then 'lead' else 'member' end
from public.projects p
cross join lateral jsonb_array_elements_text(
  case
    when jsonb_typeof(p.team_ids) = 'array' then p.team_ids
    else '[]'::jsonb
  end
) as tid(value)
join public.employee_profiles ep on ep.id = tid.value
on conflict (project_id, employee_id) do update
  set role = excluded.role;

-- Update employee project counts
update public.employee_profiles ep
set projects = coalesce(cnt.n, 0)
from (
  select employee_id, count(distinct project_id)::int as n
  from public.project_members
  group by employee_id
) cnt
where ep.id = cnt.employee_id;

-- ── VERIFY: employee → projects mapping ───────────────────────────────────────
select
  ep.name,
  ep.id as employee_id,
  ep.email,
  string_agg(p.name, ', ' order by p.name) as visible_projects
from public.employee_profiles ep
left join public.project_members pm on pm.employee_id = ep.id
left join public.projects p on p.id = pm.project_id
where ep.email is not null and ep.email <> '—' and ep.email like '%@%'
group by ep.id, ep.name, ep.email
order by ep.name;
