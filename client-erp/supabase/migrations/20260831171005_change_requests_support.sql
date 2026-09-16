-- Run this in your Supabase SQL Editor (CLIENT-ERP project)
-- Change Request kanban and the Support Center ticket queue.

create table if not exists change_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  requested_by uuid references people(id),
  -- Fallback for requesters that aren't a real person record yet (e.g. "Marketing Team").
  requested_by_text text,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'backlog' check (status in ('backlog', 'in-progress', 'review', 'approved')),
  assigned_to uuid references people(id),
  due_date date,
  progress_pct int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists change_requests_project_id_idx on change_requests(project_id);

create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'in-progress', 'resolved')),
  assignee_id uuid references people(id),
  sla_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_project_id_idx on support_tickets(project_id);
