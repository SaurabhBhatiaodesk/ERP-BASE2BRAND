-- =============================================================================
-- BASE2BRAND ERP — manual sandwich-leave marking (payroll)
-- =============================================================================
-- Run this in your Supabase SQL Editor. Safe to re-run.
--
-- Sandwich leave used to be auto-detected (a weekend/holiday with leave or
-- absence on both sides was automatically billed too). That's been replaced
-- with this: HR explicitly marks a specific date as "sandwich" for a specific
-- employee, and only THAT date gets billed as leave via the sandwich-leave
-- payroll factor (see src/lib/payroll.ts). No automatic detection anymore.
-- =============================================================================

create table if not exists public.manual_sandwich_leaves (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null,
  sandwich_date date not null,
  marked_by text,
  marked_by_name text,
  created_at timestamptz not null default now(),
  unique (employee_id, sandwich_date)
);

create index if not exists manual_sandwich_leaves_employee_idx
  on public.manual_sandwich_leaves (employee_id);

-- Grants + policies mirror every other app table: open to anon/authenticated,
-- with access enforced in the app (payroll screens are gated on isPayrollRole).
grant select, insert, update, delete on public.manual_sandwich_leaves to anon, authenticated;

alter table public.manual_sandwich_leaves enable row level security;

drop policy if exists "manual_sandwich_leaves_all_access" on public.manual_sandwich_leaves;
create policy "manual_sandwich_leaves_all_access"
  on public.manual_sandwich_leaves
  for all
  to anon, authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';
