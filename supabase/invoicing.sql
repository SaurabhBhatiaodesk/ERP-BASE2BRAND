-- ============================================================
-- Invoicing Module — Phase 1 (Core Invoicing)
-- Run this in your Supabase SQL Editor
-- New tables only — does not touch any existing table.
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
  projects       jsonb not null default '[]'::jsonb, -- array of named work-streams for this client
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
  -- Per-invoice bank-detail snapshot (matches the legacy app's own tamplatetwo pattern:
  -- each invoice keeps its own copy rather than always reflecting the linked bank record's
  -- current values — important since bank names aren't unique, e.g. multiple "HDFC Bank"
  -- rows with different account numbers, so a live join can't reliably tell them apart).
  bank_name         text,
  bank_account_no   text,
  bank_branch_name  text,
  bank_account_name text,
  bank_account_type text,
  bank_ifsc_code    text,
  bank_swift_code   text,
  line_items       jsonb not null default '[]'::jsonb, -- [{ project, description, amount }]
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
  payment_status   text not null default 'unpaid', -- unpaid | paid | overdue
  pay_method       text,
  payment_options  jsonb not null default '{}'::jsonb, -- { paytm:{name,id}, paypal:{...}, wise:{...}, payoneer:{...} }
  signature_url    text,
  company_logo_url text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Indexes
create index if not exists invoicing_invoices_client_idx  on public.invoicing_invoices(client_id);
create index if not exists invoicing_invoices_company_idx on public.invoicing_invoices(company_id);
create index if not exists invoicing_invoices_bank_idx    on public.invoicing_invoices(bank_id);
create index if not exists invoicing_invoices_date_idx    on public.invoicing_invoices(invoice_date);
create index if not exists invoicing_invoices_status_idx  on public.invoicing_invoices(payment_status);

-- ---- RLS ----
alter table public.invoicing_companies    enable row level security;
alter table public.invoicing_bank_details enable row level security;
alter table public.invoicing_clients      enable row level security;
alter table public.invoicing_invoices     enable row level security;

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

-- Access enforced client-side (CEO/HR only, see src/lib/auth.ts isPayrollRole), same
-- wide-open convention as every other table in this app (e.g. meetings.sql).
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

-- ---- Realtime ----
alter table public.invoicing_companies    replica identity full;
alter table public.invoicing_bank_details replica identity full;
alter table public.invoicing_clients      replica identity full;
alter table public.invoicing_invoices     replica identity full;

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
