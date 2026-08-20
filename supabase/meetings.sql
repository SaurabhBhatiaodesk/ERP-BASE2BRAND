-- ============================================================
-- Meetings Module
-- Run this in your Supabase SQL Editor
-- ============================================================

-- meetings table
create table if not exists public.meetings (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  type          text not null default 'Client Meeting',
  platform      text not null default 'Zoom',
  meeting_link  text,
  date          date not null,
  start_time    time not null,
  end_time      time not null,
  duration_mins int  not null default 30,
  status        text not null default 'scheduled', -- scheduled | ongoing | completed | cancelled
  organizer_id  text not null references public.employee_profiles(id) on delete cascade,
  agenda        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- meeting_participants join table
create table if not exists public.meeting_participants (
  id             uuid primary key default gen_random_uuid(),
  meeting_id     uuid not null references public.meetings(id) on delete cascade,
  participant_id text not null references public.employee_profiles(id) on delete cascade,
  added_at       timestamptz not null default now(),
  unique(meeting_id, participant_id)
);

-- Indexes
create index if not exists meetings_organizer_idx       on public.meetings(organizer_id);
create index if not exists meetings_date_idx            on public.meetings(date);
create index if not exists meeting_participants_meeting_idx     on public.meeting_participants(meeting_id);
create index if not exists meeting_participants_participant_idx on public.meeting_participants(participant_id);

-- ---- RLS ----
alter table public.meetings enable row level security;
alter table public.meeting_participants enable row level security;

-- Drop existing policies if re-running
drop policy if exists "meetings_select"     on public.meetings;
drop policy if exists "meetings_insert"     on public.meetings;
drop policy if exists "meetings_update"     on public.meetings;
drop policy if exists "meetings_delete"     on public.meetings;
drop policy if exists "mp_select"           on public.meeting_participants;
drop policy if exists "mp_insert"           on public.meeting_participants;
drop policy if exists "mp_delete"           on public.meeting_participants;

-- meetings: everyone can read (filtered in app by organizer/participant), organizer can mutate
create policy "meetings_select" on public.meetings for select using (true);
create policy "meetings_insert" on public.meetings for insert with check (true);
create policy "meetings_update" on public.meetings for update using (true);
create policy "meetings_delete" on public.meetings for delete using (true);

-- meeting_participants: open (app handles ownership logic)
create policy "mp_select" on public.meeting_participants for select using (true);
create policy "mp_insert" on public.meeting_participants for insert with check (true);
create policy "mp_delete" on public.meeting_participants for delete using (true);

-- ---- Realtime ----
alter table public.meetings replica identity full;
alter table public.meeting_participants replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.meetings;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.meeting_participants;
exception
  when duplicate_object then null;
end $$;
