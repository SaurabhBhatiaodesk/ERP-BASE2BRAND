-- Raise Ticket module — project-scoped tickets, taggable to multiple people.
-- CEO/Superadmin can tag anyone; Team Lead/Employee can tag anyone except
-- CEO/Superadmin (enforced in the app layer — see TicketsView.tsx/auth.ts's
-- canTagAnyoneInTicket — matching this app's existing convention of
-- client-side-enforced authorization for internal-employee roles).

create table if not exists public.tickets (
  id text primary key,
  -- Nullable: a ticket doesn't have to belong to a project (a general/company
  -- ticket) — see createTicket() in database.ts and the "General (No
  -- Project)" option in TicketsView.tsx.
  project_id text references public.projects(id) on delete cascade,
  title text not null,
  description text not null default '',
  priority text not null default 'medium',
  status text not null default 'open',
  created_by text references public.employee_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tickets alter column project_id drop not null;

create table if not exists public.ticket_assignees (
  ticket_id text not null references public.tickets(id) on delete cascade,
  employee_id text not null references public.employee_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ticket_id, employee_id)
);

create index if not exists tickets_project_idx on public.tickets (project_id);
create index if not exists tickets_created_by_idx on public.tickets (created_by);
create index if not exists ticket_assignees_employee_idx on public.ticket_assignees (employee_id);

alter table public.tickets enable row level security;
alter table public.ticket_assignees enable row level security;

-- Same wide-open-to-employees convention as the rest of this app's tables,
-- except client_user sessions are excluded from day one (this app now has
-- an external client login — see supabase/client_login.sql — and tickets
-- are an internal-only feature clients have no UI path into).
drop policy if exists "tickets_select" on public.tickets;
drop policy if exists "tickets_insert" on public.tickets;
drop policy if exists "tickets_update" on public.tickets;
drop policy if exists "tickets_delete" on public.tickets;
create policy "tickets_select" on public.tickets for select to anon, authenticated using (not public.is_client_user());
create policy "tickets_insert" on public.tickets for insert to anon, authenticated with check (not public.is_client_user());
create policy "tickets_update" on public.tickets for update to anon, authenticated using (not public.is_client_user()) with check (not public.is_client_user());
create policy "tickets_delete" on public.tickets for delete to anon, authenticated using (not public.is_client_user());

drop policy if exists "ticket_assignees_select" on public.ticket_assignees;
drop policy if exists "ticket_assignees_insert" on public.ticket_assignees;
drop policy if exists "ticket_assignees_update" on public.ticket_assignees;
drop policy if exists "ticket_assignees_delete" on public.ticket_assignees;
create policy "ticket_assignees_select" on public.ticket_assignees for select to anon, authenticated using (not public.is_client_user());
create policy "ticket_assignees_insert" on public.ticket_assignees for insert to anon, authenticated with check (not public.is_client_user());
create policy "ticket_assignees_update" on public.ticket_assignees for update to anon, authenticated using (not public.is_client_user()) with check (not public.is_client_user());
create policy "ticket_assignees_delete" on public.ticket_assignees for delete to anon, authenticated using (not public.is_client_user());

do $$
begin
  alter publication supabase_realtime add table public.tickets;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ticket_assignees;
exception
  when duplicate_object then null;
end $$;
