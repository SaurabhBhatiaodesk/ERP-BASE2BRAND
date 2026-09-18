-- Client login: lets an external client log into the main ERP and, if added
-- to a project, assign tasks to that project's team members — scoped so a
-- client's session can only ever see/touch their own project(s), enforced by
-- the database (RLS + SECURITY DEFINER RPCs), not just hidden in the UI.
--
-- Context: every table in this app currently has wide-open RLS
-- (`using (true)` for both anon and authenticated — see b2b_projects_select,
-- b2b_project_tasks_select, etc.). That's fine when every login is a
-- trusted employee. A client login uses the same anon key baked into the
-- app, so without real restriction here a client could query any table
-- directly. This migration is additive and narrow: it only tightens
-- `projects` and `project_tasks`, and only for the new client identity —
-- every existing employee policy keeps working exactly as before.

-- ─── client_users: the client identity, deliberately separate from
--     employee_profiles (which carries salary/HR fields that make no sense,
--     and shouldn't be visible, for an external login) ─────────────────────
create table if not exists public.client_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  company text,
  created_at timestamptz not null default now()
);

-- ─── project_client_members: which project(s) a client can see/act on ─────
create table if not exists public.project_client_members (
  project_id text not null references public.projects(id) on delete cascade,
  client_user_id uuid not null references public.client_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, client_user_id)
);

create index if not exists project_client_members_client_idx
  on public.project_client_members (client_user_id);

alter table public.client_users enable row level security;
alter table public.project_client_members enable row level security;

drop policy if exists "client_users_self_select" on public.client_users;
create policy "client_users_self_select" on public.client_users
  for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists "project_client_members_self_select" on public.project_client_members;
create policy "project_client_members_self_select" on public.project_client_members
  for select to authenticated
  using (client_user_id in (select id from public.client_users where auth_user_id = auth.uid()));

-- ─── RLS helpers (SECURITY DEFINER — same shape used in client-erp to avoid
--     the RLS self-reference bootstrap trap) ────────────────────────────────
create or replace function public.is_client_user()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.client_users where auth_user_id = auth.uid())
$$;

create or replace function public.current_client_user_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.client_users where auth_user_id = auth.uid()
$$;

create or replace function public.client_has_project(p_project_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.project_client_members
    where project_id = p_project_id
      and client_user_id = public.current_client_user_id()
  )
$$;

-- ─── Tighten `projects` and `project_tasks`: existing employee policies now
--     explicitly exclude client_users (so they can't be combined into "open
--     to everyone" — RLS policies are OR'd together), and a new read-only
--     policy scopes clients to their own project(s). No employee-visible
--     behavior changes: any non-client login evaluates these exactly as the
--     old `using (true)` did. ───────────────────────────────────────────────
alter policy "b2b_projects_select" on public.projects
  using (not public.is_client_user());
alter policy "b2b_projects_insert" on public.projects
  with check (not public.is_client_user());
alter policy "b2b_projects_update" on public.projects
  using (not public.is_client_user()) with check (not public.is_client_user());
alter policy "b2b_projects_delete" on public.projects
  using (not public.is_client_user());

drop policy if exists "client_projects_select" on public.projects;
create policy "client_projects_select" on public.projects
  for select to authenticated
  using (public.is_client_user() and public.client_has_project(id));

alter policy "b2b_project_tasks_select" on public.project_tasks
  using (not public.is_client_user());
alter policy "b2b_project_tasks_insert" on public.project_tasks
  with check (not public.is_client_user());
alter policy "b2b_project_tasks_update" on public.project_tasks
  using (not public.is_client_user()) with check (not public.is_client_user());
alter policy "b2b_project_tasks_delete" on public.project_tasks
  using (not public.is_client_user());

drop policy if exists "client_project_tasks_select" on public.project_tasks;
create policy "client_project_tasks_select" on public.project_tasks
  for select to authenticated
  using (public.is_client_user() and public.client_has_project(project_id));

-- No direct client insert/update policy on project_tasks — task creation for
-- a client goes through create_client_task() below, so "must be their
-- project" and "assignee must be on that project's team" are each enforced
-- once, in one place, instead of split across RLS + app code.

-- ─── employee_profiles: a client's own session must never be able to query
--     this table directly (it holds salary/HR fields RLS can't hide at the
--     column level) — all client access to team-member info goes through
--     list_project_team_for_client() below instead, which is SECURITY
--     DEFINER and returns only id/name/avatar. ─────────────────────────────
alter policy "b2b_employee_profiles_select" on public.employee_profiles
  using (not public.is_client_user());
alter policy "b2b_employee_profiles_insert" on public.employee_profiles
  with check (not public.is_client_user());
alter policy "b2b_employee_profiles_update" on public.employee_profiles
  using (not public.is_client_user()) with check (not public.is_client_user());
alter policy "b2b_employee_profiles_delete" on public.employee_profiles
  using (not public.is_client_user());

-- ─── RPCs: the only way a client session reads team members or creates a
--     task. Deliberately returns only id/name/avatar — never grants a
--     client any direct SELECT on employee_profiles (which holds
--     salary/HR fields RLS can't hide at the column level). ────────────────
create or replace function public.list_project_team_for_client(p_project_id text)
returns table(id text, name text, avatar text)
language sql stable security definer set search_path = public
as $$
  select ep.id, ep.name, ep.avatar
  from public.employee_profiles ep
  join public.project_members pm on pm.employee_id = ep.id
  where public.client_has_project(p_project_id)
    and pm.project_id = p_project_id
$$;

create or replace function public.create_client_task(
  p_project_id text,
  p_title text,
  p_assignee_id text,
  p_priority text default 'medium',
  p_due text default null
)
returns public.project_tasks
language plpgsql security definer set search_path = public
as $$
declare
  v_task public.project_tasks;
begin
  if not public.client_has_project(p_project_id) then
    raise exception 'Not a member of this project';
  end if;

  if trim(coalesce(p_title, '')) = '' then
    raise exception 'Title is required';
  end if;

  if not exists (
    select 1 from public.project_members
    where project_id = p_project_id and employee_id = p_assignee_id
  ) then
    raise exception 'Assignee is not on this project''s team';
  end if;

  insert into public.project_tasks (id, project_id, assignee_id, title, status, priority, due, work_notes, status_entered_at)
  values (
    'task-client-' || (extract(epoch from clock_timestamp()) * 1000)::bigint::text,
    p_project_id,
    p_assignee_id,
    trim(p_title),
    'todo',
    coalesce(nullif(trim(p_priority), ''), 'medium'),
    nullif(trim(coalesce(p_due, '')), ''),
    '',
    now()
  )
  returning * into v_task;

  return v_task;
end;
$$;

-- ─── Client drag-and-drop: move one of their tasks between To Do / In
--     Progress / Complete. Deliberately a narrower status set than the
--     internal employee Kanban (which also has Review / Ready for QA) —
--     the client board only has 3 columns. Mirrors the stage-history
--     bookkeeping the employee-side updateProjectTask() does (closes the
--     open task_status_history row, opens a new one) so "time in stage"
--     reporting stays accurate no matter which side moved the card.
create or replace function public.update_client_task_status(p_task_id text, p_status text)
returns public.project_tasks
language plpgsql security definer set search_path = public
as $$
declare
  v_task public.project_tasks;
  v_now timestamptz := now();
begin
  if p_status not in ('todo', 'in-progress', 'done') then
    raise exception 'Invalid status for client board';
  end if;

  select * into v_task from public.project_tasks where id = p_task_id;
  if v_task.id is null then
    raise exception 'Task not found';
  end if;
  if not public.client_has_project(v_task.project_id) then
    raise exception 'Not a member of this project';
  end if;

  if v_task.status is distinct from p_status then
    update public.task_status_history
    set exited_at = v_now,
        duration_seconds = greatest(0, extract(epoch from (v_now - entered_at))::int)
    where task_id = p_task_id and exited_at is null;

    insert into public.task_status_history (id, task_id, project_id, from_status, to_status, entered_at)
    values (
      'tsh-client-' || (extract(epoch from clock_timestamp()) * 1000)::bigint::text,
      p_task_id, v_task.project_id, v_task.status, p_status, v_now
    );
  end if;

  update public.project_tasks
  set status = p_status,
      status_entered_at = case when v_task.status is distinct from p_status then v_now else status_entered_at end,
      updated_at = v_now
  where id = p_task_id
  returning * into v_task;

  return v_task;
end;
$$;
