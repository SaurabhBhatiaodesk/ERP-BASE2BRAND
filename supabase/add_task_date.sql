-- Task Date — controls Today's Tasks on employee dashboard (not created_at).
-- Run in Supabase SQL Editor after project_relations.sql

-- If task_date was created as `date`, convert to text (YYYY-MM-DD) for the app.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_tasks'
      and column_name = 'task_date'
      and data_type = 'date'
  ) then
    alter table public.project_tasks
      alter column task_date type text using to_char(task_date, 'YYYY-MM-DD');
  end if;
end $$;

alter table public.project_tasks
  add column if not exists task_date text;

-- Backfill existing rows from created_at
update public.project_tasks
set task_date = to_char(created_at, 'YYYY-MM-DD')
where task_date is null or task_date = '';

create index if not exists project_tasks_task_date_idx
  on public.project_tasks (task_date);

notify pgrst, 'reload schema';
