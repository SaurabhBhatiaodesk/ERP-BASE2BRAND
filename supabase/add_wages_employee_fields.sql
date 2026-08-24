-- ============================================================
-- Invoicing Module — Phase 2 (Wages)
-- Additive-only: two nullable columns on the existing employee_profiles
-- table, needed for salary slips. No existing column/RLS/data touched.
-- Run this in your Supabase SQL Editor.
-- ============================================================

alter table public.employee_profiles
  add column if not exists family_member text,
  add column if not exists employee_code text;
