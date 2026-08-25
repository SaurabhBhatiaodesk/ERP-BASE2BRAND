-- ============================================================
-- Invoicing Module — shared password/PIN gate
-- Run this in your Supabase SQL Editor
-- New table only — does not touch any existing table.
-- Single-row config table: whoever opens Invoicing first sets the
-- password; access after that is enforced client-side (see
-- src/lib/auth.ts isInvoicingRole + InvoicingView.tsx's ModuleLockGate),
-- same wide-open RLS convention as every other table in this app.
-- ============================================================

create table if not exists public.invoicing_module_lock (
  id             uuid primary key default gen_random_uuid(),
  password_hash  text not null,
  updated_at     timestamptz not null default now()
);

-- ---- RLS ----
alter table public.invoicing_module_lock enable row level security;

drop policy if exists "invoicing_module_lock_select" on public.invoicing_module_lock;
drop policy if exists "invoicing_module_lock_insert" on public.invoicing_module_lock;
drop policy if exists "invoicing_module_lock_update" on public.invoicing_module_lock;
drop policy if exists "invoicing_module_lock_delete" on public.invoicing_module_lock;

create policy "invoicing_module_lock_select" on public.invoicing_module_lock for select using (true);
create policy "invoicing_module_lock_insert" on public.invoicing_module_lock for insert with check (true);
create policy "invoicing_module_lock_update" on public.invoicing_module_lock for update using (true);
create policy "invoicing_module_lock_delete" on public.invoicing_module_lock for delete using (true);
