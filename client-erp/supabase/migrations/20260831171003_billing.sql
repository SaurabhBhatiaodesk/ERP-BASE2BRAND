-- Run this in your Supabase SQL Editor (CLIENT-ERP project)
-- Contracts (retainer terms) and invoices. Monthly billing totals are a derived
-- SUM(amount) GROUP BY month query over invoices, not a stored table.

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references projects(id) on delete cascade,
  total_value numeric(12, 2) not null default 0,
  hours_total numeric(8, 2) not null default 0,
  hours_used numeric(8, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Retainer hour usage broken down by work category (Design, Development, QA & Testing, PM & Strategy).
create table if not exists contract_hour_categories (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  category text not null,
  hours_used numeric(8, 2) not null default 0
);

create index if not exists contract_hour_categories_contract_id_idx on contract_hour_categories(contract_id);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  project_id uuid not null references projects(id) on delete cascade,
  description text,
  amount numeric(12, 2) not null,
  paid_amount numeric(12, 2) not null default 0,
  issue_date date not null,
  due_date date not null,
  status text not null default 'pending' check (status in ('paid', 'pending', 'overdue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_project_id_idx on invoices(project_id);
