-- =============================================================================
-- Verify projects are readable by the app (anon key / REST API)
-- =============================================================================
-- Table Editor uses postgres role → sees all rows.
-- The React app uses anon key → needs RLS policies + GRANT.
-- =============================================================================

-- 1) How many projects exist in DB (postgres view)
select count(*)::int as projects_in_database from public.projects;

-- 2) RLS policies on projects (should list b2b_projects_select etc.)
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'projects'
order by policyname;

-- 3) If policies missing or empty → run full fix:
--    supabase/rls_all_tables.sql

-- 4) Quick one-table fix for projects only:
alter table public.projects enable row level security;

grant select, insert, update, delete on public.projects to anon, authenticated;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'projects'
  loop
    execute format('drop policy if exists %I on public.projects', pol.policyname);
  end loop;

  create policy b2b_projects_select on public.projects
    for select to anon, authenticated using (true);
  create policy b2b_projects_insert on public.projects
    for insert to anon, authenticated with check (true);
  create policy b2b_projects_update on public.projects
    for update to anon, authenticated using (true) with check (true);
  create policy b2b_projects_delete on public.projects
    for delete to anon, authenticated using (true);
end $$;

notify pgrst, 'reload schema';

-- 5) Re-check count
select count(*)::int as projects_after_fix from public.projects;
