-- Full chat setup (team channels + groups + DMs + media)
-- Run this ONCE in Supabase → SQL Editor → New query → Run

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  is_announcements boolean not null default false,
  channel_type text not null default 'team',
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  sender_id text,
  sender_name text not null,
  content text not null,
  is_broadcast boolean not null default false,
  message_type text not null default 'text',
  media_url text,
  media_type text,
  file_name text,
  file_size integer,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_channel_reads (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  user_id text not null,
  last_read_at timestamptz not null default now(),
  unique (channel_id, user_id)
);

create table if not exists public.chat_channel_members (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  user_id text not null,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  unique (channel_id, user_id)
);

-- Add v2 columns if tables already existed from chat.sql only
alter table public.chat_channels
  add column if not exists channel_type text not null default 'team',
  add column if not exists created_by text;

alter table public.chat_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists media_url text,
  add column if not exists media_type text,
  add column if not exists file_name text,
  add column if not exists file_size integer;

-- ── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists chat_messages_channel_created_idx
  on public.chat_messages (channel_id, created_at desc);

create index if not exists chat_channel_members_user_idx
  on public.chat_channel_members (user_id);

create index if not exists chat_channel_members_channel_idx
  on public.chat_channel_members (channel_id);

-- ── Default team channels ─────────────────────────────────────────────────────

insert into public.chat_channels (slug, name, description, is_announcements, channel_type) values
  ('general', 'General', 'Company-wide discussion', false, 'team'),
  ('dev-team', 'Dev Team', 'Development team channel', false, 'team'),
  ('design', 'Design', 'Design team channel', false, 'team'),
  ('marketing', 'Marketing', 'Marketing team channel', false, 'team'),
  ('hr-team', 'HR Team', 'HR and people ops', false, 'team'),
  ('announcements', 'Announcements', 'Company announcements', true, 'team')
on conflict (slug) do nothing;

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.chat_channels enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_channel_reads enable row level security;
alter table public.chat_channel_members enable row level security;

drop policy if exists "chat_channels_select" on public.chat_channels;
drop policy if exists "chat_channels_insert" on public.chat_channels;
drop policy if exists "chat_messages_select" on public.chat_messages;
drop policy if exists "chat_messages_insert" on public.chat_messages;
drop policy if exists "chat_reads_select" on public.chat_channel_reads;
drop policy if exists "chat_reads_insert" on public.chat_channel_reads;
drop policy if exists "chat_reads_update" on public.chat_channel_reads;
drop policy if exists "chat_channel_members_select" on public.chat_channel_members;
drop policy if exists "chat_channel_members_insert" on public.chat_channel_members;
drop policy if exists "chat_channel_members_delete" on public.chat_channel_members;

create policy "chat_channels_select"
  on public.chat_channels for select to anon, authenticated using (true);

create policy "chat_channels_insert"
  on public.chat_channels for insert to anon, authenticated with check (true);

create policy "chat_messages_select"
  on public.chat_messages for select to anon, authenticated using (true);

create policy "chat_messages_insert"
  on public.chat_messages for insert to anon, authenticated with check (true);

create policy "chat_reads_select"
  on public.chat_channel_reads for select to anon, authenticated using (true);

create policy "chat_reads_insert"
  on public.chat_channel_reads for insert to anon, authenticated with check (true);

create policy "chat_reads_update"
  on public.chat_channel_reads for update to anon, authenticated using (true);

create policy "chat_channel_members_select"
  on public.chat_channel_members for select to anon, authenticated using (true);

create policy "chat_channel_members_insert"
  on public.chat_channel_members for insert to anon, authenticated with check (true);

create policy "chat_channel_members_delete"
  on public.chat_channel_members for delete to anon, authenticated using (true);

-- ── Realtime ──────────────────────────────────────────────────────────────────

alter table public.chat_messages replica identity full;
alter table public.chat_channels replica identity full;
alter table public.chat_channel_members replica identity full;
alter table public.chat_channel_reads replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.chat_channels;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.chat_channel_members;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.chat_channel_reads;
exception when duplicate_object then null; end $$;
