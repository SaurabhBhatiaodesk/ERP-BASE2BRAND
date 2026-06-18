-- Work / break / meeting segments per clock session (lunch, tea, etc.)
-- Run after clock_sessions.sql

create table if not exists public.clock_session_segments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.clock_sessions(id) on delete cascade,
  kind text not null check (kind in ('working', 'break', 'meeting')),
  label text not null default '',
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists clock_session_segments_session_idx
  on public.clock_session_segments (session_id, started_at);

alter table public.clock_session_segments enable row level security;

drop policy if exists "clock_session_segments_select" on public.clock_session_segments;
drop policy if exists "clock_session_segments_insert" on public.clock_session_segments;
drop policy if exists "clock_session_segments_update" on public.clock_session_segments;
create policy "clock_session_segments_select" on public.clock_session_segments for select to anon, authenticated using (true);
create policy "clock_session_segments_insert" on public.clock_session_segments for insert to anon, authenticated with check (true);
create policy "clock_session_segments_update" on public.clock_session_segments for update to anon, authenticated using (true);

-- Backfill: one working segment for today's open sessions
insert into public.clock_session_segments (session_id, kind, label, started_at, ended_at)
select
  cs.id,
  'working',
  'Office attendance',
  coalesce(cs.session_start, cs.clock_in),
  case when cs.status = 'paused' then coalesce(cs.session_start, cs.clock_in) else null end
from public.clock_sessions cs
where cs.clock_in >= date_trunc('day', now())
  and not exists (
    select 1 from public.clock_session_segments seg where seg.session_id = cs.id
  );

-- If currently on break, add open break segment from last pause
insert into public.clock_session_segments (session_id, kind, label, started_at, ended_at)
select
  cs.id,
  case when cs.notes ilike '%meeting%' then 'meeting' else 'break' end,
  coalesce(nullif(trim(replace(coalesce(cs.notes, ''), 'Break:', '')), ''), 'On break'),
  cs.session_start,
  null
from public.clock_sessions cs
where cs.status = 'paused'
  and cs.session_start is not null
  and not exists (
    select 1 from public.clock_session_segments seg
    where seg.session_id = cs.id and seg.ended_at is null
  );

do $$
begin
  alter publication supabase_realtime add table public.clock_session_segments;
exception
  when duplicate_object then null;
end $$;
