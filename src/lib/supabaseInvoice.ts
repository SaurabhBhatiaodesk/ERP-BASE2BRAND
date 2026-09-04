import { createClient } from "@supabase/supabase-js";
import { createLoggedFetch } from "@/lib/networkDebug";

/**
 * Separate Supabase project holding the Invoicing module's data
 * (companies, bank details, clients, invoices, wages/salary slips, and
 * the module's shared password lock) — isolated from the main ERP
 * database. Access is still gated client-side by isInvoicingRole +
 * the module password gate, same convention as the main project; this
 * client has no employee auth session of its own.
 */
const invoiceSupabaseUrl = import.meta.env.VITE_SUPABASE_INVOICE_URL;
const invoiceSupabaseAnonKey = import.meta.env.VITE_SUPABASE_INVOICE_ANON_KEY;

if (!invoiceSupabaseUrl || !invoiceSupabaseAnonKey) {
  throw new Error(
    "Missing Invoicing Supabase env vars. Set VITE_SUPABASE_INVOICE_URL and VITE_SUPABASE_INVOICE_ANON_KEY in .env"
  );
}

export const supabaseInvoice = createClient(invoiceSupabaseUrl, invoiceSupabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: createLoggedFetch(),
  },
});
