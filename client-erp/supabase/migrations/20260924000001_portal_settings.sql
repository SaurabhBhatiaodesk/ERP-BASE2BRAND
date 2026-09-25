-- Global "what does the client portal show" control, set from the main ERP's
-- admin-only Client Portal Control module (CEO/Superadmin) via a server-side
-- Edge Function (manage-portal-settings, deployed on the MAIN ERP project) —
-- never written to directly from either app's frontend.
create table if not exists public.portal_settings (
  id text primary key default 'global',
  visible_modules jsonb not null default '["analytics","projects","deliverables","activity","documents","meetings","team","support","invoices","knowledge","ai","notifications"]'::jsonb,
  show_financials boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.portal_settings (id) values ('global')
on conflict (id) do nothing;

alter table public.portal_settings enable row level security;

-- Every signed-in person (client or admin) needs to read this to know what
-- to render — it's global, not per-tenant, so no org scoping. Writes only
-- ever come from the Edge Function's service-role connection, which bypasses
-- RLS entirely, so there is deliberately no insert/update/delete policy here.
drop policy if exists "portal_settings_select" on public.portal_settings;
create policy "portal_settings_select" on public.portal_settings
  for select to authenticated using (true);
