-- ============================================================
-- Invoicing Module — Phase 2 (Wages / Salary Slips)
-- Run this in your Supabase SQL Editor
-- New table only — does not touch any existing table.
-- ============================================================

create table if not exists public.invoicing_wages (
  id             uuid primary key default gen_random_uuid(),
  legacy_id      text,
  employee_id    text references public.employee_profiles(id) on delete set null,
  -- Per-record employee-info snapshot, matching the legacy wages_detail pattern (it
  -- stored department/designation/joinDate/familyMember/empCode directly on each row,
  -- not looked up live from an employee table) — a payslip should reflect what was
  -- true at the time, and this is the only data available at all for employees no
  -- longer in employee_profiles (most migrated records: 76 of 92 have no current match).
  legacy_employee_name text,
  legacy_department text,
  legacy_designation text,
  legacy_join_date text,
  legacy_family_member text,
  legacy_employee_code text,
  company_id     uuid references public.invoicing_companies(id) on delete set null,

  -- Earnings
  basic          numeric not null default 0,
  med            numeric not null default 0,
  children       numeric not null default 0,
  house          numeric not null default 0,
  conveyance     numeric not null default 0,
  earning        numeric not null default 0,
  arrear         numeric not null default 0,
  reimbursement  numeric not null default 0,

  -- Deductions
  health         numeric not null default 0,
  proftax        numeric not null default 0,
  epf            numeric not null default 0,
  tds            numeric not null default 0,

  -- Attendance / leave
  days_in_month  int,
  working_days   int,
  casual_leave   numeric not null default 0,
  medical_leave  numeric not null default 0,
  absent         numeric not null default 0,

  salary_period  date not null default current_date,
  net_salary     numeric not null default 0,
  -- Per-record logo snapshot, matching invoicing_invoices' own company_logo_url pattern
  -- (each document keeps its own snapshot rather than always reflecting the current
  -- company record, so a later logo change doesn't retroactively alter old documents).
  company_logo_url text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Indexes
create index if not exists invoicing_wages_employee_idx on public.invoicing_wages(employee_id);
create index if not exists invoicing_wages_company_idx  on public.invoicing_wages(company_id);
create index if not exists invoicing_wages_period_idx   on public.invoicing_wages(salary_period);

-- ---- RLS ----
alter table public.invoicing_wages enable row level security;

drop policy if exists "invoicing_wages_select" on public.invoicing_wages;
drop policy if exists "invoicing_wages_insert" on public.invoicing_wages;
drop policy if exists "invoicing_wages_update" on public.invoicing_wages;
drop policy if exists "invoicing_wages_delete" on public.invoicing_wages;

-- Access enforced client-side (CEO/HR only, see src/lib/auth.ts isPayrollRole), same
-- wide-open convention as every other table in this app (e.g. meetings.sql, invoicing.sql).
create policy "invoicing_wages_select" on public.invoicing_wages for select using (true);
create policy "invoicing_wages_insert" on public.invoicing_wages for insert with check (true);
create policy "invoicing_wages_update" on public.invoicing_wages for update using (true);
create policy "invoicing_wages_delete" on public.invoicing_wages for delete using (true);

-- ---- Realtime ----
alter table public.invoicing_wages replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.invoicing_wages;
exception when duplicate_object then null; end $$;
