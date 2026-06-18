-- Per-column time tracking for Kanban tasks.
-- Run in Supabase SQL Editor after project_relations.sql

alter table public.project_tasks
  add column if not exists status_entered_at timestamptz;

create table if not exists public.task_status_history (
  id text primary key,
  task_id text not null references public.project_tasks(id) on delete cascade,
  project_id text not null,
  from_status text,
  to_status text not null,
  entered_at timestamptz not null default now(),
  exited_at timestamptz,
  duration_seconds integer,
  moved_by text references public.employee_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists task_status_history_task_idx on public.task_status_history (task_id);
create index if not exists task_status_history_project_idx on public.task_status_history (project_id);

-- Backfill: current stage started when task was created/updated
update public.project_tasks
set status_entered_at = coalesce(status_entered_at, updated_at, created_at, now())
where status_entered_at is null;

-- One open history row per existing task (so first move closes this segment)
insert into public.task_status_history (id, task_id, project_id, from_status, to_status, entered_at)
select
  'tsh-backfill-' || pt.id,
  pt.id,
  pt.project_id,
  null,
  pt.status,
  coalesce(pt.status_entered_at, pt.created_at, now())
from public.project_tasks pt
where not exists (
  select 1 from public.task_status_history h
  where h.task_id = pt.id and h.exited_at is null
);

alter table public.task_status_history enable row level security;

drop policy if exists "task_status_history_select" on public.task_status_history;
drop policy if exists "task_status_history_insert" on public.task_status_history;
drop policy if exists "task_status_history_update" on public.task_status_history;
drop policy if exists "task_status_history_delete" on public.task_status_history;
create policy "task_status_history_select" on public.task_status_history for select to anon, authenticated using (true);
create policy "task_status_history_insert" on public.task_status_history for insert to anon, authenticated with check (true);
create policy "task_status_history_update" on public.task_status_history for update to anon, authenticated using (true);
create policy "task_status_history_delete" on public.task_status_history for delete to anon, authenticated using (true);

do $$
begin
  alter publication supabase_realtime add table public.task_status_history;
exception
  when duplicate_object then null;
end $$;
