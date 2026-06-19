-- Notifications table for in-app and browser notifications
-- Run this in your Supabase SQL Editor

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id text not null references public.employee_profiles(id) on delete cascade,
  sender_id text references public.employee_profiles(id) on delete set null,
  title text not null,
  message text not null,
  type text not null,
  reference_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Index for quick fetching of user's notifications
create index if not exists notifications_recipient_idx on public.notifications(recipient_id, created_at desc);

-- Enable RLS
alter table public.notifications enable row level security;

-- Policies
drop policy if exists "notifications_select" on public.notifications;
drop policy if exists "notifications_insert" on public.notifications;
drop policy if exists "notifications_update" on public.notifications;

create policy "notifications_select" on public.notifications for select using (true);
create policy "notifications_insert" on public.notifications for insert with check (true);
create policy "notifications_update" on public.notifications for update using (true);

-- Enable Realtime
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;
