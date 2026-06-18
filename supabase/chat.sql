-- Team chat: channels, messages, read receipts.
-- Run in Supabase SQL Editor, then reload the app.

create table if not exists public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  is_announcements boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  sender_id text,
  sender_name text not null,
  content text not null,
  is_broadcast boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_channel_created_idx
  on public.chat_messages (channel_id, created_at desc);

create table if not exists public.chat_channel_reads (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  user_id text not null,
  last_read_at timestamptz not null default now(),
  unique (channel_id, user_id)
);

-- Default team channels
insert into public.chat_channels (slug, name, description, is_announcements) values
  ('general', 'General', 'Company-wide discussion', false),
  ('dev-team', 'Dev Team', 'Development team channel', false),
  ('design', 'Design', 'Design team channel', false),
  ('marketing', 'Marketing', 'Marketing team channel', false),
  ('hr-team', 'HR Team', 'HR and people ops', false),
  ('announcements', 'Announcements', 'Company announcements', true)
on conflict (slug) do nothing;

alter table public.chat_channels enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_channel_reads enable row level security;

create policy "chat_channels_select"
  on public.chat_channels for select
  to anon, authenticated
  using (true);

create policy "chat_messages_select"
  on public.chat_messages for select
  to anon, authenticated
  using (true);

create policy "chat_messages_insert"
  on public.chat_messages for insert
  to anon, authenticated
  with check (true);

create policy "chat_reads_select"
  on public.chat_channel_reads for select
  to anon, authenticated
  using (true);

create policy "chat_reads_insert"
  on public.chat_channel_reads for insert
  to anon, authenticated
  with check (true);

create policy "chat_reads_update"
  on public.chat_channel_reads for update
  to anon, authenticated
  using (true);

-- Realtime for live message updates
alter publication supabase_realtime add table public.chat_messages;
