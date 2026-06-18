-- Employee clock in / out — run in Supabase SQL Editor
-- employee_profiles.id is text (not uuid)

create table if not exists public.clock_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id text references public.employee_profiles(id) on delete set null,
  employee_name text not null,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  hours numeric(10, 4) not null default 0,
  session_start timestamptz,
  notes text,
  project_id text,
  created_at timestamptz not null default now()
);

-- If table already exists, run these once:
alter table public.clock_sessions
  add column if not exists session_start timestamptz;

alter table public.clock_sessions
  alter column hours type numeric(10, 4);

alter table public.clock_sessions
  alter column hours set default 0;

create index if not exists clock_sessions_employee_active_idx
  on public.clock_sessions (employee_name, status)
  where status = 'active';

create index if not exists clock_sessions_employee_id_active_idx
  on public.clock_sessions (employee_id, status)
  where status = 'active';

alter table public.clock_sessions enable row level security;

do $$ begin
  create policy "clock_sessions_read" on public.clock_sessions
    for select using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "clock_sessions_insert" on public.clock_sessions
    for insert with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "clock_sessions_update" on public.clock_sessions
    for update using (true);
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
