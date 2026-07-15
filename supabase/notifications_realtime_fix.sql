-- Fix: employees not receiving live notifications (chat / call / broadcast / project assign)
-- Run in Supabase SQL Editor on project jgbkpbafgwxlkudwqvdb
--
-- Filtered postgres_changes (recipient_id=eq.xxx) requires REPLICA IDENTITY FULL.

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

create index if not exists notifications_recipient_idx
  on public.notifications(recipient_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select" on public.notifications;
drop policy if exists "notifications_insert" on public.notifications;
drop policy if exists "notifications_update" on public.notifications;
drop policy if exists "b2b_notifications_select" on public.notifications;
drop policy if exists "b2b_notifications_insert" on public.notifications;
drop policy if exists "b2b_notifications_update" on public.notifications;
drop policy if exists "b2b_notifications_delete" on public.notifications;

create policy "notifications_select" on public.notifications for select using (true);
create policy "notifications_insert" on public.notifications for insert with check (true);
create policy "notifications_update" on public.notifications for update using (true);

grant select, insert, update, delete on public.notifications to anon, authenticated;

-- REQUIRED for filtered Realtime (useNotifications filter: recipient_id=eq.<id>)
alter table public.notifications replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';

-- Verify (optional):
-- SELECT relname, relreplident FROM pg_class WHERE relname = 'notifications';
-- relreplident = 'f' → FULL (correct)
