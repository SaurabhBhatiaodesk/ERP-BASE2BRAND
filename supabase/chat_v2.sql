-- Chat v2: group chats, DMs, media (Cloudinary URLs in messages)
-- Run AFTER supabase/chat.sql in Supabase SQL Editor

alter table public.chat_channels
  add column if not exists channel_type text not null default 'team',
  add column if not exists created_by text;

alter table public.chat_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists media_url text,
  add column if not exists media_type text,
  add column if not exists file_name text,
  add column if not exists file_size integer;

create table if not exists public.chat_channel_members (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  user_id text not null,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  unique (channel_id, user_id)
);

create index if not exists chat_channel_members_user_idx
  on public.chat_channel_members (user_id);

create index if not exists chat_channel_members_channel_idx
  on public.chat_channel_members (channel_id);

alter table public.chat_channel_members enable row level security;

drop policy if exists "chat_channel_members_select" on public.chat_channel_members;
drop policy if exists "chat_channel_members_insert" on public.chat_channel_members;
drop policy if exists "chat_channel_members_delete" on public.chat_channel_members;

create policy "chat_channel_members_select"
  on public.chat_channel_members for select
  to anon, authenticated
  using (true);

create policy "chat_channel_members_insert"
  on public.chat_channel_members for insert
  to anon, authenticated
  with check (true);

create policy "chat_channel_members_delete"
  on public.chat_channel_members for delete
  to anon, authenticated
  using (true);

drop policy if exists "chat_channels_insert" on public.chat_channels;
create policy "chat_channels_insert"
  on public.chat_channels for insert
  to anon, authenticated
  with check (true);

do $$
begin
  alter publication supabase_realtime add table public.chat_channel_members;
exception
  when duplicate_object then null;
end $$;
