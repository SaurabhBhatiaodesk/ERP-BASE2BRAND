-- Run this in your Supabase SQL Editor (CLIENT-ERP project)
-- Document vault (also backs the Knowledge Base, which is just a filtered/AI-searchable
-- view over this table + meetings.ai_summary — no separate articles table) and meetings.

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  category text not null check (category in ('contracts', 'invoices', 'design', 'reports', 'meetings', 'brand')),
  file_type text,
  version text,
  file_url text,
  file_size_bytes bigint,
  uploaded_by uuid references people(id),
  -- Optional pointer back to the record this document originated from.
  source_type text check (source_type in ('deliverable', 'invoice', 'meeting')),
  source_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists documents_project_id_idx on documents(project_id);

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  meeting_date date not null,
  start_time time,
  duration_minutes int,
  type text check (type in ('planning', 'review', 'design', 'retro')),
  ai_summary text,
  decisions text[],
  recording_url text,
  created_at timestamptz not null default now()
);

create index if not exists meetings_project_id_idx on meetings(project_id);

create table if not exists meeting_attendees (
  meeting_id uuid not null references meetings(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  primary key (meeting_id, person_id)
);
