-- Run this in Supabase SQL Editor to create the missing table
-- (meetings table already exists, this only adds meeting_participants)

create table if not exists public.meeting_participants (
  id             uuid primary key default gen_random_uuid(),
  meeting_id     uuid not null references public.meetings(id) on delete cascade,
  participant_id text not null references public.employee_profiles(id) on delete cascade,
  added_at       timestamptz not null default now(),
  unique(meeting_id, participant_id)
);

-- Indexes
create index if not exists meeting_participants_meeting_idx
  on public.meeting_participants(meeting_id);

create index if not exists meeting_participants_participant_idx
  on public.meeting_participants(participant_id);

-- RLS
alter table public.meeting_participants enable row level security;

drop policy if exists "mp_select" on public.meeting_participants;
drop policy if exists "mp_insert" on public.meeting_participants;
drop policy if exists "mp_delete" on public.meeting_participants;

create policy "mp_select" on public.meeting_participants for select using (true);
create policy "mp_insert" on public.meeting_participants for insert with check (true);
create policy "mp_delete" on public.meeting_participants for delete using (true);

-- Realtime
alter table public.meeting_participants replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.meeting_participants;
exception
  when duplicate_object then null;
end $$;
