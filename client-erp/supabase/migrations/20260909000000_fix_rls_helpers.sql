-- Run this in your Supabase SQL Editor (CLIENT-ERP project)
-- Fixes a circular-RLS bootstrap bug in 20260831171007_rls.sql.
--
-- current_person_id()/current_org_id()/project_in_scope() were declared as
-- plain SECURITY INVOKER functions. Every RLS policy on `people` calls
-- current_org_id() to check "is this row in my org" — but current_org_id()
-- itself queries `people`, and that inner query is ALSO subject to
-- `people`'s own RLS policy, which needs current_org_id() to evaluate. A
-- client user can never resolve their own org: finding "my own row"
-- requires already knowing my org. Marking these three helpers SECURITY
-- DEFINER (Supabase's own recommended pattern for tenant-resolution
-- helpers) lets them look past RLS internally while every other query in
-- the app still goes through the normal policies unchanged.

create or replace function current_person_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from people where auth_user_id = auth.uid()
$$;

create or replace function current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from people where auth_user_id = auth.uid()
$$;

create or replace function project_in_scope(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from projects pr
    where pr.id = p_project_id
      and pr.organization_id = current_org_id()
  )
$$;
