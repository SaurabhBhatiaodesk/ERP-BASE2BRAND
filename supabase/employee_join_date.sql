-- ============================================================
-- Employee Profiles — precise Join Date
-- Run this in your Supabase SQL Editor
-- Additive column only — does not touch any existing data.
--
-- `employee_profiles.joined` is a lossy display string ("Aug 2026", month
-- precision only). `created_at` is when the DB row itself was inserted,
-- which for migrated/admin-created/backfilled profiles can be completely
-- different from the employee's real start date. This adds a real `date`
-- column so day-precise calculations (My Payroll's join-date floor, the
-- payroll engine's pre-joining exclusion) have something trustworthy to
-- read instead of guessing from either of those.
--
-- New employees created via Register/Add already capture this exact date
-- (the "Date of Joining" field) — it just wasn't being persisted before.
-- Existing employees need it set once via the CEO/superadmin-editable
-- "Join Date" field on their Employee Profile.
-- ============================================================

alter table public.employee_profiles
  add column if not exists join_date date;
