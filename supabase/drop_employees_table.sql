-- Safe delete: removes legacy `employees` table (app now uses only employee_profiles).
-- Run in Supabase → SQL Editor.

alter table public.employee_profiles
  add column if not exists avatar text,
  add column if not exists trend text default 'up';

drop table if exists public.employees cascade;
