-- ============================================================
-- Invoicing Module — ISOLATED PROJECT schema
-- Run this in the Supabase SQL Editor for the SEPARATE Invoicing
-- Supabase project (the one at VITE_SUPABASE_INVOICE_URL in .env),
-- NOT the main ERP project.
--
-- This is the same schema as supabase/invoicing.sql +
-- supabase/invoicing_wages.sql + supabase/invoicing_module_lock.sql,
-- combined into one file, with ONE change: invoicing_wages.employee_id
-- no longer has a foreign key to employee_profiles(id), because that
-- table lives in the OTHER (main) Supabase project — Postgres can't
-- enforce a foreign key across two separate databases. employee_id is
-- still stored as plain text and matched up in application code.
-- ============================================================

-- invoicing_companies: the issuing entity/branch shown on an invoice
create table if not exists public.invoicing_companies (
  id             uuid primary key default gen_random_uuid(),
  legacy_id      text,
  trade_name     text not null,
  company_address text,
  ifsc           text,
  pan_no         text,
  gst_no         text,
  signature_url  text,
  logo_url       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- invoicing_bank_details: bank accounts an invoice can be paid into
create table if not exists public.invoicing_bank_details (
  id             uuid primary key default gen_random_uuid(),
  legacy_id      text,
  bank_name      text not null,
  account_no     text,
  account_type   text,
  branch_name    text,
  ifsc_code      text,
  swift_code     text,
  account_name   text,
  trade_name     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- invoicing_clients: billed-to parties
create table if not exists public.invoicing_clients (
  id             uuid primary key default gen_random_uuid(),
  legacy_id      text,
  client_name    text not null,
  company        text,
  address        text,
  address1       text,
  address2       text,
  email          text,
  mobile_no      text,
  projects       jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- invoicing_invoices: the invoice itself
create table if not exists public.invoicing_invoices (
  id               uuid primary key default gen_random_uuid(),
  legacy_id        text,
  invoice_no       text not null unique,
  invoice_date     date not null default current_date,
  client_id        uuid references public.invoicing_clients(id) on delete set null,
  company_id       uuid references public.invoicing_companies(id) on delete set null,
  bank_id          uuid references public.invoicing_bank_details(id) on delete set null,
  bank_name         text,
  bank_account_no   text,
  bank_branch_name  text,
  bank_account_name text,
  bank_account_type text,
  bank_ifsc_code    text,
  bank_swift_code   text,
  line_items       jsonb not null default '[]'::jsonb,
  currency         text not null default 'INR',
  client_gst_no    text,
  company_gst_no   text,
  amount           numeric not null default 0,
  cgst             numeric not null default 0,
  sgst             numeric not null default 0,
  cgst_percent     numeric not null default 0,
  sgst_percent     numeric not null default 0,
  advance_amount   numeric not null default 0,
  enable_gst       boolean not null default false,
  payment_status   text not null default 'unpaid',
  pay_method       text,
  payment_options  jsonb not null default '{}'::jsonb,
  signature_url    text,
  company_logo_url text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists invoicing_invoices_client_idx  on public.invoicing_invoices(client_id);
create index if not exists invoicing_invoices_company_idx on public.invoicing_invoices(company_id);
create index if not exists invoicing_invoices_bank_idx    on public.invoicing_invoices(bank_id);
create index if not exists invoicing_invoices_date_idx    on public.invoicing_invoices(invoice_date);
create index if not exists invoicing_invoices_status_idx  on public.invoicing_invoices(payment_status);

-- invoicing_wages: wage / salary slip records
create table if not exists public.invoicing_wages (
  id             uuid primary key default gen_random_uuid(),
  legacy_id      text,
  -- NOTE: no FK to employee_profiles — that table is in the main project.
  employee_id    text,
  legacy_employee_name text,
  legacy_department text,
  legacy_designation text,
  legacy_join_date text,
  legacy_family_member text,
  legacy_employee_code text,
  company_id     uuid references public.invoicing_companies(id) on delete set null,

  basic          numeric not null default 0,
  med            numeric not null default 0,
  children       numeric not null default 0,
  house          numeric not null default 0,
  conveyance     numeric not null default 0,
  earning        numeric not null default 0,
  arrear         numeric not null default 0,
  reimbursement  numeric not null default 0,

  health         numeric not null default 0,
  proftax        numeric not null default 0,
  epf            numeric not null default 0,
  tds            numeric not null default 0,

  days_in_month  int,
  working_days   int,
  casual_leave   numeric not null default 0,
  medical_leave  numeric not null default 0,
  absent         numeric not null default 0,

  salary_period  date not null default current_date,
  net_salary     numeric not null default 0,
  company_logo_url text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists invoicing_wages_employee_idx on public.invoicing_wages(employee_id);
create index if not exists invoicing_wages_company_idx  on public.invoicing_wages(company_id);
create index if not exists invoicing_wages_period_idx   on public.invoicing_wages(salary_period);

-- invoicing_module_lock: shared password/PIN gate for the Invoicing screen
create table if not exists public.invoicing_module_lock (
  id             uuid primary key default gen_random_uuid(),
  password_hash  text not null,
  updated_at     timestamptz not null default now()
);

-- ---- RLS (same wide-open convention as the main project — access is
-- enforced client-side by role checks + the module password gate) ----
alter table public.invoicing_companies    enable row level security;
alter table public.invoicing_bank_details enable row level security;
alter table public.invoicing_clients      enable row level security;
alter table public.invoicing_invoices     enable row level security;
alter table public.invoicing_wages        enable row level security;
alter table public.invoicing_module_lock  enable row level security;

drop policy if exists "invoicing_companies_select"    on public.invoicing_companies;
drop policy if exists "invoicing_companies_insert"    on public.invoicing_companies;
drop policy if exists "invoicing_companies_update"    on public.invoicing_companies;
drop policy if exists "invoicing_companies_delete"    on public.invoicing_companies;
drop policy if exists "invoicing_bank_details_select" on public.invoicing_bank_details;
drop policy if exists "invoicing_bank_details_insert" on public.invoicing_bank_details;
drop policy if exists "invoicing_bank_details_update" on public.invoicing_bank_details;
drop policy if exists "invoicing_bank_details_delete" on public.invoicing_bank_details;
drop policy if exists "invoicing_clients_select"      on public.invoicing_clients;
drop policy if exists "invoicing_clients_insert"      on public.invoicing_clients;
drop policy if exists "invoicing_clients_update"      on public.invoicing_clients;
drop policy if exists "invoicing_clients_delete"      on public.invoicing_clients;
drop policy if exists "invoicing_invoices_select"     on public.invoicing_invoices;
drop policy if exists "invoicing_invoices_insert"     on public.invoicing_invoices;
drop policy if exists "invoicing_invoices_update"     on public.invoicing_invoices;
drop policy if exists "invoicing_invoices_delete"     on public.invoicing_invoices;
drop policy if exists "invoicing_wages_select" on public.invoicing_wages;
drop policy if exists "invoicing_wages_insert" on public.invoicing_wages;
drop policy if exists "invoicing_wages_update" on public.invoicing_wages;
drop policy if exists "invoicing_wages_delete" on public.invoicing_wages;
drop policy if exists "invoicing_module_lock_select" on public.invoicing_module_lock;
drop policy if exists "invoicing_module_lock_insert" on public.invoicing_module_lock;
drop policy if exists "invoicing_module_lock_update" on public.invoicing_module_lock;
drop policy if exists "invoicing_module_lock_delete" on public.invoicing_module_lock;

create policy "invoicing_companies_select" on public.invoicing_companies for select using (true);
create policy "invoicing_companies_insert" on public.invoicing_companies for insert with check (true);
create policy "invoicing_companies_update" on public.invoicing_companies for update using (true);
create policy "invoicing_companies_delete" on public.invoicing_companies for delete using (true);

create policy "invoicing_bank_details_select" on public.invoicing_bank_details for select using (true);
create policy "invoicing_bank_details_insert" on public.invoicing_bank_details for insert with check (true);
create policy "invoicing_bank_details_update" on public.invoicing_bank_details for update using (true);
create policy "invoicing_bank_details_delete" on public.invoicing_bank_details for delete using (true);

create policy "invoicing_clients_select" on public.invoicing_clients for select using (true);
create policy "invoicing_clients_insert" on public.invoicing_clients for insert with check (true);
create policy "invoicing_clients_update" on public.invoicing_clients for update using (true);
create policy "invoicing_clients_delete" on public.invoicing_clients for delete using (true);

create policy "invoicing_invoices_select" on public.invoicing_invoices for select using (true);
create policy "invoicing_invoices_insert" on public.invoicing_invoices for insert with check (true);
create policy "invoicing_invoices_update" on public.invoicing_invoices for update using (true);
create policy "invoicing_invoices_delete" on public.invoicing_invoices for delete using (true);

create policy "invoicing_wages_select" on public.invoicing_wages for select using (true);
create policy "invoicing_wages_insert" on public.invoicing_wages for insert with check (true);
create policy "invoicing_wages_update" on public.invoicing_wages for update using (true);
create policy "invoicing_wages_delete" on public.invoicing_wages for delete using (true);

create policy "invoicing_module_lock_select" on public.invoicing_module_lock for select using (true);
create policy "invoicing_module_lock_insert" on public.invoicing_module_lock for insert with check (true);
create policy "invoicing_module_lock_update" on public.invoicing_module_lock for update using (true);
create policy "invoicing_module_lock_delete" on public.invoicing_module_lock for delete using (true);

-- ---- Realtime ----
alter table public.invoicing_companies    replica identity full;
alter table public.invoicing_bank_details replica identity full;
alter table public.invoicing_clients      replica identity full;
alter table public.invoicing_invoices     replica identity full;
alter table public.invoicing_wages        replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.invoicing_companies;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.invoicing_bank_details;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.invoicing_clients;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.invoicing_invoices;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.invoicing_wages;
exception when duplicate_object then null; end $$;
