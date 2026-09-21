-- Run this in your Supabase SQL Editor (CLIENT-ERP project)
-- Google Meet link for a meeting. Populated lazily by the create-meet-link
-- edge function (service role, bypasses RLS) the first time anyone clicks
-- "Join" — never written to directly by the client.

alter table public.meetings add column if not exists meet_link text;

notify pgrst, 'reload schema';
