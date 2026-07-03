-- Emoji reactions on chat messages (images, text, files)
-- Run in Supabase SQL Editor after chat.sql / chat_v2.sql

create table if not exists public.chat_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id text not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists chat_message_reactions_message_idx
  on public.chat_message_reactions (message_id);

alter table public.chat_message_reactions enable row level security;

drop policy if exists "chat_message_reactions_select" on public.chat_message_reactions;
drop policy if exists "chat_message_reactions_insert" on public.chat_message_reactions;
drop policy if exists "chat_message_reactions_delete" on public.chat_message_reactions;

create policy "chat_message_reactions_select"
  on public.chat_message_reactions for select
  to anon, authenticated
  using (true);

create policy "chat_message_reactions_insert"
  on public.chat_message_reactions for insert
  to anon, authenticated
  with check (true);

create policy "chat_message_reactions_delete"
  on public.chat_message_reactions for delete
  to anon, authenticated
  using (true);

alter table public.chat_message_reactions replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.chat_message_reactions;
exception
  when duplicate_object then null;
end $$;
