-- Run this in Supabase SQL Editor so quick-action logs appear in Network tab.
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.activity_logs enable row level security;

create policy "activity_logs_insert_anon"
  on public.activity_logs for insert
  to anon, authenticated
  with check (true);

create policy "activity_logs_select_anon"
  on public.activity_logs for select
  to anon, authenticated
  using (true);
