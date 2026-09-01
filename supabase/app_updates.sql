-- Company-wide "new ERP version available" announcements.
-- CEO/superadmin publishes a version + download link from the Broadcast
-- screen; every employee gets a notification and a persistent dashboard
-- banner with a Download & Install link until they dismiss it.

create table if not exists public.app_updates (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  download_link text not null,
  notes text,
  created_by text,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists app_updates_created_at_idx
  on public.app_updates (created_at desc);

alter table public.app_updates enable row level security;

drop policy if exists "app_updates_select" on public.app_updates;
drop policy if exists "app_updates_insert" on public.app_updates;
create policy "app_updates_select" on public.app_updates for select to anon, authenticated using (true);
create policy "app_updates_insert" on public.app_updates for insert to anon, authenticated with check (true);
