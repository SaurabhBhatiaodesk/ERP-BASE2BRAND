-- =============================================================================
-- BASE2BRAND ERP — RLS policies for ALL app tables (new Supabase project setup)
-- =============================================================================
-- Run ONCE in Supabase SQL Editor after you import/migrate your data.
-- Safe to re-run: drops old policies on listed tables, applies open anon+auth access.
--
-- Why: Imported databases often have RLS enabled but missing INSERT/UPDATE policies
--      → error 42501 "violates row-level security policy"
-- =============================================================================

-- Schema columns used by signup/login (safe if already present)
alter table public.employee_profiles
  add column if not exists app_role text not null default 'employee';

alter table public.employee_profiles
  add column if not exists shift_start text not null default '10:00';

alter table public.employee_profiles
  add column if not exists avatar text,
  add column if not exists trend text default 'up',
  add column if not exists profile_image_url text,
  add column if not exists fcm_token text,
  add column if not exists web_fcm_token text,
  add column if not exists last_active_at timestamptz;

-- Table grants (imported DBs often miss these — RLS policies alone are not enough)
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;

do $$
declare
  tbl text;
  tables text[] := array[
    'employee_profiles',
    'projects',
    'project_members',
    'project_tasks',
    'timesheet_entries',
    'task_status_history',
    'clock_sessions',
    'clock_session_segments',
    'employee_screenshots',
    'notifications',
    'chat_channels',
    'chat_messages',
    'chat_channel_reads',
    'chat_channel_members',
    'chat_message_reactions',
    'activity_logs',
    'ats_vacancies',
    'ats_interviews',
    'leads',
    'leave_requests',
    'profiles'
  ];
  pol record;
begin
  foreach tbl in array tables loop
    if not exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = tbl
    ) then
      raise notice 'SKIP (table missing): public.%', tbl;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', tbl);

    -- Remove every existing policy on this table (avoids conflicts after DB import)
    for pol in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = tbl
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
    end loop;

    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      'b2b_' || tbl || '_select',
      tbl
    );

    execute format(
      'create policy %I on public.%I for insert to anon, authenticated with check (true)',
      'b2b_' || tbl || '_insert',
      tbl
    );

    execute format(
      'create policy %I on public.%I for update to anon, authenticated using (true) with check (true)',
      'b2b_' || tbl || '_update',
      tbl
    );

    execute format(
      'create policy %I on public.%I for delete to anon, authenticated using (true)',
      'b2b_' || tbl || '_delete',
      tbl
    );

    raise notice 'OK: public.% — select/insert/update/delete for anon + authenticated', tbl;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Verify (optional — run separately):
-- select tablename, policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;
