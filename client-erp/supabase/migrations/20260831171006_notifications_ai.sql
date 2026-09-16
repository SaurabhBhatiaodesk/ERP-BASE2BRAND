-- Run this in your Supabase SQL Editor (CLIENT-ERP project)
-- Notifications, AI executive summaries, and the shared AI chat tables used by
-- AI Project Manager, Knowledge Base search, Support Center assistant, and the
-- Deliverables feedback interpreter (discriminated by context_type).

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references people(id) on delete cascade,
  title text not null,
  description text,
  notification_type text check (notification_type in ('deliverable', 'invoice', 'task', 'ai_summary', 'meeting', 'support_ticket')),
  -- Optional pointer to the record this notification is about.
  related_type text,
  related_id uuid,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_id_idx on notifications(recipient_id);

create table if not exists ai_executive_summaries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  summary_text text not null,
  delivery_confidence_pct int,
  health_grade text,
  estimated_launch_date date,
  budget_status text,
  risk_level text,
  generated_at timestamptz not null default now()
);

create index if not exists ai_executive_summaries_project_id_idx on ai_executive_summaries(project_id);

create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  person_id uuid references people(id),
  context_type text check (context_type in ('project_assistant', 'knowledge_base', 'support', 'feedback_interpreter')),
  created_at timestamptz not null default now()
);

create index if not exists ai_conversations_person_id_idx on ai_conversations(person_id);

create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'ai')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_id_idx on ai_messages(conversation_id);
