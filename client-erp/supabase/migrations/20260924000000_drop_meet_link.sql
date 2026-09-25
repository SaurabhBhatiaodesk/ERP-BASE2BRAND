-- Run this in your Supabase SQL Editor (CLIENT-ERP project)
-- Switched video from Google Meet (needed a stored link, fetched via OAuth)
-- to Jitsi (meet.jit.si) — the room name is now derived deterministically
-- from meetings.id, so nothing needs to be persisted for it anymore.

alter table public.meetings drop column if exists meet_link;

notify pgrst, 'reload schema';
