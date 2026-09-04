-- ============================================================
-- Employee Salaries — ISOLATED PROJECT schema
-- Run this in the Supabase SQL Editor for the SEPARATE Invoicing/
-- Finance Supabase project (VITE_SUPABASE_INVOICE_URL in .env).
--
-- Previously, an employee's monthly salary was just the `salary` column
-- on employee_profiles (main project), read/written by every screen that
-- deals with My Payroll / the Payroll Dashboard / Employee Profile edit.
-- This table is the new source of truth for that value, isolated from
-- the main project. employee_id is plain text (no FK — employee_profiles
-- lives in the other project) and is matched up in application code.
-- ============================================================

create table if not exists public.employee_salaries (
  employee_id    text primary key,
  salary         text not null default '',
  updated_at     timestamptz not null default now()
);

alter table public.employee_salaries enable row level security;

drop policy if exists "employee_salaries_select" on public.employee_salaries;
drop policy if exists "employee_salaries_insert" on public.employee_salaries;
drop policy if exists "employee_salaries_update" on public.employee_salaries;
drop policy if exists "employee_salaries_delete" on public.employee_salaries;

-- Access enforced client-side (same wide-open convention as every other
-- table in this app and in this isolated project).
create policy "employee_salaries_select" on public.employee_salaries for select using (true);
create policy "employee_salaries_insert" on public.employee_salaries for insert with check (true);
create policy "employee_salaries_update" on public.employee_salaries for update using (true);
create policy "employee_salaries_delete" on public.employee_salaries for delete using (true);

alter table public.employee_salaries replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.employee_salaries;
exception when duplicate_object then null; end $$;
