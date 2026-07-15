-- Fix: chat messages only appear after page refresh (live updates not working)
-- Run in Supabase SQL Editor on project jgbkpbafgwxlkudwqvdb
--
-- If chat tables don't exist yet, run chat_full_setup.sql FIRST, then this file.

-- Required for filtered postgres_changes (channel_id=eq.xxx)
alter table public.chat_messages replica identity full;
alter table public.chat_channels replica identity full;
alter table public.chat_channel_members replica identity full;
alter table public.chat_channel_reads replica identity full;

do $$ begin
  alter table public.chat_message_reactions replica identity full;
exception when undefined_table then null; end $$;

grant select, insert, update, delete on public.chat_messages to anon, authenticated;
grant select, insert, update, delete on public.chat_channels to anon, authenticated;
grant select, insert, update, delete on public.chat_channel_members to anon, authenticated;
grant select, insert, update, delete on public.chat_channel_reads to anon, authenticated;

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

do $$ begin
  alter publication supabase_realtime add table public.chat_message_reactions;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';

-- Verify (optional):
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename LIKE 'chat%';
