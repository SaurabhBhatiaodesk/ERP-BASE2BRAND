-- Run if chat messages don't appear without page refresh
-- Supabase SQL Editor → New query → Run

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
