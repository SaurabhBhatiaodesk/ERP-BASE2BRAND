-- Run this in your Supabase SQL Editor (CLIENT-ERP project)
-- Core entities: client organizations, people (client users + agency staff), client settings.

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_name text,
  created_at timestamptz not null default now()
);

-- A single table for both client-portal users and agency staff.
-- kind = 'client'  -> logs in via Supabase Auth, belongs to an organization (auth_user_id set).
-- kind = 'team'    -> Base2Brand staff directory entry, no login (auth_user_id null).
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('client', 'team')),
  organization_id uuid references organizations(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  initials text,
  role text,
  specialty text,
  years_experience int,
  availability_text text,
  presence_status text check (presence_status in ('online', 'busy', 'away', 'offline')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists people_organization_id_idx on people(organization_id);

-- Per-user portal preferences (client kind only).
create table if not exists client_settings (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references people(id) on delete cascade,
  email_notifications boolean not null default true,
  in_app_alerts boolean not null default true,
  sms_alerts boolean not null default false,
  theme text not null default 'dark',
  dashboard_layout text,
  date_time_format text,
  two_factor_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
