-- Run this in your Supabase SQL Editor (CLIENT-ERP project)
-- Adds a new people.kind = 'admin' — a Base2Brand-internal login that can see
-- EVERY client organization and project, unlike 'client' (own org only) and
-- 'team' (staff directory entry, no login at all).
--
-- Most tables' select policies gate through project_in_scope(project_id)
-- (see 20260831171007_rls.sql) — updating that one SECURITY DEFINER helper
-- to bypass for admins fixes all of them at once. Only organizations_select
-- and people_select check organization_id directly and need their own edit.
-- client_settings/notifications/ai_conversations/ai_messages stay scoped to
-- current_person_id() — personal data, correctly untouched by this change.

alter table public.people drop constraint people_kind_check;
alter table public.people add constraint people_kind_check check (kind in ('client', 'team', 'admin'));

create or replace function is_admin_person()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from people where auth_user_id = auth.uid() and kind = 'admin')
$$;

create or replace function project_in_scope(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_admin_person() or exists (
    select 1 from projects pr
    where pr.id = p_project_id
      and pr.organization_id = current_org_id()
  )
$$;

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (id = current_org_id() or is_admin_person());

drop policy if exists people_select on public.people;
create policy people_select on public.people
  for select to authenticated
  using (kind = 'team' or organization_id = current_org_id() or is_admin_person());

-- projects_select also checks organization_id directly rather than routing
-- through project_in_scope() — missed on the first pass of this migration,
-- caught by testing the admin login against live data (it returned zero
-- projects despite organizations/people correctly bypassing).
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (organization_id = current_org_id() or is_admin_person());

notify pgrst, 'reload schema';
