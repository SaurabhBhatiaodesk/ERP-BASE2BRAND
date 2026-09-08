-- =============================================================================
-- BASE2BRAND ERP — drop legacy invoicing tables + employee_profiles.salary
-- =============================================================================
-- Run this against the MAIN project (jgbkpbafgwxlkudwqvdb) only — NOT the
-- isolated invoicing project (qbyehcinzybxtptnzjpp), which holds the real,
-- actively-used invoicing_* tables and employee_salaries.
--
-- Both were migrated to the isolated project earlier this session:
--   - invoicing_companies, invoicing_bank_details, invoicing_clients,
--     invoicing_invoices, invoicing_wages, invoicing_module_lock
--   - employee_profiles.salary -> employee_salaries (isolated project)
-- The app (src/lib/database.ts) has read/written exclusively through
-- `supabaseInvoice` (the isolated client) for all of the above since that
-- migration — nothing left in the main project reads or writes them. A
-- full backup of the rows being dropped here was taken before running this.
-- =============================================================================

alter table public.employee_profiles drop column if exists salary;

drop table if exists public.invoicing_invoices;
drop table if exists public.invoicing_wages;
drop table if exists public.invoicing_clients;
drop table if exists public.invoicing_bank_details;
drop table if exists public.invoicing_companies;
drop table if exists public.invoicing_module_lock;

notify pgrst, 'reload schema';
