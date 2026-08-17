-- =============================================================================
-- BASE2BRAND ERP — public holiday calendar (payroll)
-- =============================================================================
-- Run this in your Supabase SQL Editor. Safe to re-run: the table is created
-- only if missing and the seed rows are ON CONFLICT DO NOTHING, so edits made
-- in the dashboard survive a re-run.
--
-- Payroll reads this table to decide which weekdays are paid non-working days.
-- A weekday that is NOT listed here counts as "Absent" for everyone who did
-- not clock in, so keep it current — add next year's dates each December.
-- =============================================================================

create table if not exists public.public_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists public_holidays_date_idx
  on public.public_holidays (holiday_date);

-- Grants + policies mirror every other app table: open to anon/authenticated,
-- with access enforced in the app (payroll screens are gated on isPayrollRole).
grant select, insert, update, delete on public.public_holidays to anon, authenticated;

alter table public.public_holidays enable row level security;

drop policy if exists "public_holidays_all_access" on public.public_holidays;
create policy "public_holidays_all_access"
  on public.public_holidays
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Seed: 2026 calendar as confirmed with HR.
insert into public.public_holidays (holiday_date, name) values
  ('2026-01-26', 'Republic Day'),
  ('2026-03-04', 'Holi'),
  ('2026-08-15', 'Independence Day'),
  ('2026-10-02', 'Gandhi Jayanti'),
  ('2026-10-20', 'Dussehra'),
  ('2026-11-08', 'Diwali'),
  ('2026-11-09', 'Diwali'),
  ('2026-11-24', 'Guru Nanak Jayanti'),
  ('2026-12-25', 'Christmas')
on conflict (holiday_date) do nothing;

-- Refresh schema cache so APIs can see the new table
notify pgrst, 'reload schema';
