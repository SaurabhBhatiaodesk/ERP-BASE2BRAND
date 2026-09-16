-- Run this in your Supabase SQL Editor (CLIENT-ERP project)
-- Lets the main ERP's automatic sync (supabase/functions/sync-project-to-client-portal
-- in the main ERP repo) upsert idempotently instead of creating duplicates on
-- every re-sync. source_lead_id is the main ERP's leads.id (the CRM contact
-- matched by company name); source_project_id is the main ERP's projects.id.

alter table public.organizations add column if not exists source_lead_id text unique;
alter table public.projects add column if not exists source_project_id text unique;

notify pgrst, 'reload schema';
