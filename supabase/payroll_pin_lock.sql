-- ============================================================
-- My Payroll — per-employee PIN gate
-- Run this in your Supabase SQL Editor
-- New table only — does not touch any existing table.
-- One row per employee (unlike invoicing_module_lock, which is a single
-- shared row) — each employee sets and owns their own PIN. Access is
-- enforced client-side (see src/app/components/views/MyPayrollView.tsx),
-- same wide-open RLS convention as every other table in this app.
-- ============================================================

create table if not exists public.payroll_pin_lock (
  employee_id    text primary key references public.employee_profiles(id) on delete cascade,
  password_hash  text not null,
  updated_at     timestamptz not null default now()
);

-- ---- RLS ----
alter table public.payroll_pin_lock enable row level security;

drop policy if exists "payroll_pin_lock_select" on public.payroll_pin_lock;
drop policy if exists "payroll_pin_lock_insert" on public.payroll_pin_lock;
drop policy if exists "payroll_pin_lock_update" on public.payroll_pin_lock;
drop policy if exists "payroll_pin_lock_delete" on public.payroll_pin_lock;

create policy "payroll_pin_lock_select" on public.payroll_pin_lock for select using (true);
create policy "payroll_pin_lock_insert" on public.payroll_pin_lock for insert with check (true);
create policy "payroll_pin_lock_update" on public.payroll_pin_lock for update using (true);
create policy "payroll_pin_lock_delete" on public.payroll_pin_lock for delete using (true);
