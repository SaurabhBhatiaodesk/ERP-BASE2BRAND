-- =============================================================================
-- BASE2BRAND ERP — track each employee's installed app version
-- =============================================================================
-- Run this in your Supabase SQL Editor (or `supabase db query --linked -f
-- supabase/employee_app_version.sql`). Safe to re-run.
--
-- The desktop app reports its own build version (__APP_VERSION__) here once
-- per login/session start (src/app/App.tsx), so CEO/Superadmin can see who's
-- still on an old version after a new release is published (app_updates
-- table / "Publish App Update" in Broadcast) — see the new "Employee App
-- Versions" panel in src/app/components/views/SettingsViews.tsx.
-- =============================================================================

alter table public.employee_profiles
  add column if not exists installed_app_version text,
  add column if not exists installed_app_version_at timestamptz;

notify pgrst, 'reload schema';
