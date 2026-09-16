-- Run this in your Supabase SQL Editor (CLIENT-ERP project)
-- Deliverables, their version history, and Figma-style pin comments/approvals.

create table if not exists deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  type text check (type in ('Design', 'Development', 'Report', 'Document')),
  status text not null default 'pending' check (status in ('pending', 'review', 'approved', 'changes')),
  current_version text,
  uploaded_by uuid references people(id),
  file_url text,
  preview_url text,
  file_size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deliverables_project_id_idx on deliverables(project_id);

create table if not exists deliverable_versions (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references deliverables(id) on delete cascade,
  version text not null,
  file_url text,
  file_size_bytes bigint,
  uploaded_by uuid references people(id),
  created_at timestamptz not null default now()
);

create index if not exists deliverable_versions_deliverable_id_idx on deliverable_versions(deliverable_id);

-- Pin annotations placed on a deliverable's preview image (x/y as percent coordinates).
create table if not exists deliverable_comments (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references deliverables(id) on delete cascade,
  x numeric(5, 2) not null,
  y numeric(5, 2) not null,
  author_id uuid references people(id),
  text text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists deliverable_comments_deliverable_id_idx on deliverable_comments(deliverable_id);
