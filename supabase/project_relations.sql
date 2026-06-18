-- ID-based project team members, tasks, and timesheet entries.
-- Run in Supabase SQL Editor after employee_profiles + projects exist.

-- ─── projects: store employee IDs on the project row ───────────────────────────
alter table public.projects add column if not exists lead_id text references public.employee_profiles(id) on delete set null;
alter table public.projects add column if not exists team_ids jsonb not null default '[]'::jsonb;

-- ─── project_members ─────────────────────────────────────────────────────────
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  employee_id text not null references public.employee_profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (project_id, employee_id)
);

create index if not exists project_members_project_idx on public.project_members (project_id);
create index if not exists project_members_employee_idx on public.project_members (employee_id);

-- ─── project_tasks (work tasks only) ─────────────────────────────────────────
create table if not exists public.project_tasks (
  id text primary key,
  project_id text not null,
  assignee_id text references public.employee_profiles(id) on delete set null,
  title text not null,
  status text not null default 'todo',
  priority text not null default 'medium',
  due text,
  est text,
  work_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_tasks_project_idx on public.project_tasks (project_id);
create index if not exists project_tasks_assignee_idx on public.project_tasks (assignee_id);

-- ─── timesheet_entries ───────────────────────────────────────────────────────
create table if not exists public.timesheet_entries (
  id text primary key,
  project_id text not null,
  employee_id text references public.employee_profiles(id) on delete set null,
  linked_task_id text,
  date text not null,
  hours numeric not null default 0,
  description text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists timesheet_entries_project_idx on public.timesheet_entries (project_id);
create index if not exists timesheet_entries_employee_idx on public.timesheet_entries (employee_id);
create index if not exists timesheet_entries_task_idx on public.timesheet_entries (linked_task_id);

-- ─── RLS (same pattern as chat / activity_logs) ──────────────────────────────
alter table public.project_members enable row level security;
alter table public.project_tasks enable row level security;
alter table public.timesheet_entries enable row level security;

drop policy if exists "project_members_select" on public.project_members;
drop policy if exists "project_members_insert" on public.project_members;
drop policy if exists "project_members_update" on public.project_members;
drop policy if exists "project_members_delete" on public.project_members;
create policy "project_members_select" on public.project_members for select to anon, authenticated using (true);
create policy "project_members_insert" on public.project_members for insert to anon, authenticated with check (true);
create policy "project_members_update" on public.project_members for update to anon, authenticated using (true);
create policy "project_members_delete" on public.project_members for delete to anon, authenticated using (true);

drop policy if exists "project_tasks_select" on public.project_tasks;
drop policy if exists "project_tasks_insert" on public.project_tasks;
drop policy if exists "project_tasks_update" on public.project_tasks;
drop policy if exists "project_tasks_delete" on public.project_tasks;
create policy "project_tasks_select" on public.project_tasks for select to anon, authenticated using (true);
create policy "project_tasks_insert" on public.project_tasks for insert to anon, authenticated with check (true);
create policy "project_tasks_update" on public.project_tasks for update to anon, authenticated using (true);
create policy "project_tasks_delete" on public.project_tasks for delete to anon, authenticated using (true);

drop policy if exists "timesheet_entries_select" on public.timesheet_entries;
drop policy if exists "timesheet_entries_insert" on public.timesheet_entries;
drop policy if exists "timesheet_entries_update" on public.timesheet_entries;
drop policy if exists "timesheet_entries_delete" on public.timesheet_entries;
create policy "timesheet_entries_select" on public.timesheet_entries for select to anon, authenticated using (true);
create policy "timesheet_entries_insert" on public.timesheet_entries for insert to anon, authenticated with check (true);
create policy "timesheet_entries_update" on public.timesheet_entries for update to anon, authenticated using (true);
create policy "timesheet_entries_delete" on public.timesheet_entries for delete to anon, authenticated using (true);

-- Backfill lead_id + team_ids on projects from names / members
update public.projects p
set lead_id = ep.id
from public.employee_profiles ep
where p.lead_id is null
  and p.lead is not null
  and trim(p.lead) <> ''
  and lower(trim(ep.name)) = lower(trim(p.lead));

update public.projects p
set team_ids = sub.ids
from (
  select
    p2.id as project_id,
    coalesce(jsonb_agg(distinct ep.id) filter (where ep.id is not null), '[]'::jsonb) as ids
  from public.projects p2
  cross join lateral jsonb_array_elements_text(
    case
      when p2.team is null then '[]'::jsonb
      when jsonb_typeof(p2.team) = 'array' then p2.team
      else '[]'::jsonb
    end
  ) as member_name
  left join public.employee_profiles ep
    on lower(trim(ep.name)) = lower(trim(member_name))
  group by p2.id
) sub
where p.id = sub.project_id
  and (p.team_ids is null or p.team_ids = '[]'::jsonb);

-- ─── Migrate existing JSONB data (safe to re-run) ────────────────────────────

-- Team → project_members (projects.team is JSONB array of names)
insert into public.project_members (project_id, employee_id, role)
select distinct p.id, ep.id, 'member'
from public.projects p
cross join lateral jsonb_array_elements_text(
  case
    when p.team is null then '[]'::jsonb
    when jsonb_typeof(p.team) = 'array' then p.team
    else '[]'::jsonb
  end
) as member_name
join public.employee_profiles ep on lower(trim(ep.name)) = lower(trim(member_name))
on conflict (project_id, employee_id) do nothing;

update public.project_members pm
set role = 'lead'
from public.projects p,
     public.employee_profiles ep
where pm.project_id = p.id
  and pm.employee_id = ep.id
  and lower(trim(ep.name)) = lower(trim(p.lead));

-- Sync projects.lead_id + team_ids from project_members
update public.projects p
set lead_id = pm.employee_id
from public.project_members pm
where pm.project_id = p.id and pm.role = 'lead';

update public.projects p
set team_ids = sub.ids
from (
  select
    pm.project_id,
    coalesce(jsonb_agg(pm.employee_id order by pm.created_at), '[]'::jsonb) as ids
  from public.project_members pm
  group by pm.project_id
) sub
where p.id = sub.project_id;

-- Work tasks → project_tasks
insert into public.project_tasks (id, project_id, assignee_id, title, status, priority, due, est, work_notes)
select
  coalesce(t->>'id', 'task-mig-' || p.id || '-' || row_number() over ()),
  p.id,
  ep.id,
  t->>'title',
  coalesce(t->>'status', 'todo'),
  coalesce(t->>'priority', 'medium'),
  nullif(t->>'due', ''),
  nullif(t->>'est', ''),
  coalesce(t->>'workNotes', '')
from public.projects p
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(p.tasks::jsonb) = 'array' then p.tasks::jsonb
    else '[]'::jsonb
  end
) as t
left join public.employee_profiles ep
  on lower(trim(ep.name)) = lower(trim(coalesce(t->>'assignee', '')))
where coalesce(t->>'entryType', 'task') = 'task'
  and nullif(trim(t->>'title'), '') is not null
on conflict (id) do nothing;

-- Timesheet rows → timesheet_entries
insert into public.timesheet_entries (id, project_id, employee_id, linked_task_id, date, hours, description)
select
  coalesce(t->>'id', 'ts-mig-' || p.id || '-' || row_number() over ()),
  p.id,
  coalesce(ep.id, ep2.id),
  nullif(t->>'linkedTaskId', ''),
  coalesce(nullif(t->>'date', ''), to_char(now(), 'YYYY-MM-DD')),
  coalesce((t->>'hours')::numeric, 0),
  coalesce(nullif(t->>'description', ''), nullif(t->>'title', ''), '')
from public.projects p
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(p.tasks::jsonb) = 'array' then p.tasks::jsonb
    else '[]'::jsonb
  end
) as t
left join public.employee_profiles ep on ep.id = nullif(t->>'employeeId', '')
left join public.employee_profiles ep2
  on lower(trim(ep2.name)) = lower(trim(coalesce(t->>'employee', t->>'assignee', '')))
where t->>'entryType' = 'timesheet'
  and lower(coalesce(t->>'title', '') || ' ' || coalesce(t->>'description', '')) not like '%clock in%'
on conflict (id) do nothing;

-- team column: convert ["name"] → [{"id":"uuid","name":"name"}]
update public.projects p
set team = sub.new_team
from (
  select
    p2.id as project_id,
    coalesce(
      jsonb_agg(
        jsonb_build_object('id', ep.id, 'name', ep.name)
        order by t.ord
      ) filter (where ep.id is not null),
      '[]'::jsonb
    ) as new_team
  from public.projects p2
  cross join lateral jsonb_array_elements(
    case
      when p2.team is null then '[]'::jsonb
      when jsonb_typeof(p2.team) = 'array' then p2.team
      else '[]'::jsonb
    end
  ) with ordinality as t(elem, ord)
  left join public.employee_profiles ep
    on jsonb_typeof(t.elem) = 'string'
   and lower(trim(ep.name)) = lower(trim(t.elem #>> '{}'))
  where jsonb_typeof(p2.team) = 'array'
    and (
      jsonb_array_length(p2.team) = 0
      or jsonb_typeof(p2.team -> 0) = 'string'
    )
  group by p2.id
) sub
where p.id = sub.project_id;

-- Normalize due dates to ISO (2026-06-11) for reliable "today" filtering
update public.project_tasks
set due = to_char(
  to_date(due || ' ' || extract(year from now())::text, 'Mon DD YYYY'),
  'YYYY-MM-DD'
)
where due is not null
  and due !~ '^\d{4}-\d{2}-\d{2}'
  and due ~ '^[A-Za-z]{3}\s+\d{1,2}$';

-- Status: Ready for QA column → ready-for-testing (not "review")
update public.project_tasks
set status = 'ready-for-testing'
where lower(trim(status)) in ('review', 'in review', 'ready for qa', 'ready-for-qa');

-- Realtime: live Kanban / task updates without page refresh
do $$
begin
  alter publication supabase_realtime add table public.project_tasks;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.projects;
exception
  when duplicate_object then null;
end $$;
