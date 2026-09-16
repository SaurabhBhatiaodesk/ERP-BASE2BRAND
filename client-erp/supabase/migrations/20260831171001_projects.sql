-- Run this in your Supabase SQL Editor (CLIENT-ERP project)
-- Projects and everything that hangs directly off a project's timeline/execution.

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  category text,
  status text not null default 'planning' check (status in ('active', 'completed', 'planning')),
  progress_pct int not null default 0,
  health_score int,
  health_timeline int,
  health_budget int,
  health_quality int,
  health_communication int,
  health_risk int,
  budget_total numeric(12, 2),
  budget_used numeric(12, 2) not null default 0,
  current_milestone text,
  project_manager_id uuid references people(id),
  start_date date,
  launch_date date,
  description text,
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_organization_id_idx on projects(organization_id);

create table if not exists project_team_members (
  project_id uuid not null references projects(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  primary key (project_id, person_id)
);

-- Project timeline steps (Discovery, Wireframes, UI Design, Development, QA, Deployment...).
create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label text not null,
  status text not null default 'upcoming' check (status in ('done', 'active', 'upcoming')),
  sort_order int not null default 0,
  target_date date,
  created_at timestamptz not null default now()
);

create index if not exists milestones_project_id_idx on milestones(project_id);

create table if not exists sprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label text not null,
  velocity_points int,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists sprints_project_id_idx on sprints(project_id);

-- Shared by Command Center action items, Sprint task boards, meeting action items,
-- and AI-feedback-generated tasks (see source_type/source_id).
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  sprint_id uuid references sprints(id) on delete set null,
  title text not null,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'blocked', 'completed')),
  type text check (type in ('approval', 'review', 'upload', 'invoice', 'general')),
  due_date date,
  assigned_to uuid references people(id),
  source_type text check (source_type in ('meeting', 'change_request', 'ai_feedback', 'manual')),
  source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_project_id_idx on tasks(project_id);
create index if not exists tasks_sprint_id_idx on tasks(sprint_id);

-- Unifies Command Center's activity feed and the Project page's "Recent Updates".
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  actor_id uuid references people(id),
  action_type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_project_id_idx on activity_log(project_id);
