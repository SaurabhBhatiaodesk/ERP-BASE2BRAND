import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText, Plus, Search, X, Building2, Landmark, Users,
  Download, Pencil, Trash2, ShieldAlert, Loader2, Camera, Wallet, Lock, KeyRound,
} from "lucide-react";
import { usePDF } from "react-to-pdf";
// @ts-expect-error — number-to-words ships no type declarations; matches the exact
// library (and output format) the legacy app used for "amount in words" on documents.
import numberToWordsLib from "number-to-words";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { isInvoicingRole } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";
import { useEmployeeProfiles } from "@/hooks/useSupabaseData";
import {
  fetchInvoices, createInvoice, updateInvoice, deleteInvoice,
  fetchInvoiceClients, createInvoiceClient, updateInvoiceClient, deleteInvoiceClient,
  fetchInvoiceCompanies, createInvoiceCompany, updateInvoiceCompany, deleteInvoiceCompany,
  fetchInvoiceBankDetails, createInvoiceBankDetail, updateInvoiceBankDetail, deleteInvoiceBankDetail,
  fetchInvoiceWages, createInvoiceWages, updateInvoiceWages, deleteInvoiceWages, updateEmployeeWageFields,
  fetchInvoicingLockHash, setInvoicingLockHash,
  type Invoice, type InvoiceClient, type InvoiceCompany, type InvoiceBankDetail,
  type InvoiceLineItem, type InvoicePaymentStatus, type InvoiceWage,
} from "@/lib/database";

// ── Styles (matches MeetingView/PayrollView convention) ─────────
const cardCls = "bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl";
const inputCls =
  "w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans']";
const labelCls = "block text-xs font-semibold text-[#6b7fa8] mb-1.5 uppercase tracking-wide font-['Geist_Mono']";
const btnPrimary =
  "flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-indigo-900/30 font-['Plus_Jakarta_Sans']";
const btnSecondary =
  "flex items-center gap-2 px-5 py-2.5 bg-[#131a35] border border-[rgba(99,102,241,0.2)] text-[#a8b5d1] text-sm font-semibold rounded-xl hover:bg-[#1a2340] transition-colors font-['Plus_Jakarta_Sans']";

const STATUS_CONFIG: Record<InvoicePaymentStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "text-[#6b7fa8] bg-white/[0.04] border-[rgba(99,102,241,0.15)]" },
  unpaid: { label: "Unpaid", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  paid: { label: "Paid", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  overdue: { label: "Overdue", color: "text-red-400 bg-red-500/10 border-red-500/20" },
};
const FALLBACK_STATUS_CONFIG = { label: "Unknown", color: "text-[#6b7fa8] bg-white/[0.04] border-[rgba(99,102,241,0.15)]" };
function statusConfig(status: InvoicePaymentStatus) {
  return STATUS_CONFIG[status] ?? FALLBACK_STATUS_CONFIG;
}

type Tab = "invoices" | "clients" | "companies" | "banks" | "wages";

const DAYS_TO_WORKING_DAYS: Record<number, number> = { 31: 23, 30: 22, 28: 19, 29: 20 };

/** Small local number→words for the salary slip — avoids adding a dependency for one conversion. */
/** Matches the legacy app's exact usage: numberToWords.toWords(x), first letter capitalized. */
function numberToWords(n: number): string {
  const words: string = numberToWordsLib.toWords(Math.abs(Math.round(n)));
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatMoney(amount: number, currency = "INR") {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "₹";
  return `${symbol}${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function lineItemsTotal(items: InvoiceLineItem[]) {
  return items.reduce((sum, li) => sum + (Number(li.amount) || 0), 0);
}

// ── Module password gate ─────────────────────────────────────
// One shared password/PIN for the whole Invoicing module (not per-user login) — the
// first CEO/superadmin to open it sets the password; unlocked state is in-memory only
// for the current app session, so it re-prompts after a restart.
function ModuleLockGate({ onUnlock }: { onUnlock: () => void }) {
  const [loading, setLoading] = useState(true);
  const [existingHash, setExistingHash] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const hash = await fetchInvoicingLockHash();
      setExistingHash(hash);
      setLoading(false);
    })();
  }, []);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 4) { setError("Password must be at least 4 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setSubmitting(true);
    const hash = await bcrypt.hash(password, 10);
    const ok = await setInvoicingLockHash(hash);
    setSubmitting(false);
    if (!ok) { setError("Could not save the password. Please try again."); return; }
    toast.success("Invoicing module password set.");
    onUnlock();
  }

  async function handleEnterPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!existingHash) return;
    setSubmitting(true);
    const matches = await bcrypt.compare(password, existingHash);
    setSubmitting(false);
    if (!matches) { setError("Incorrect password."); return; }
    onUnlock();
  }

  if (loading) {
    return (
      <div className={`${cardCls} p-8 max-w-md mx-auto text-center`}>
        <Loader2 size={22} className="animate-spin text-indigo-400 mx-auto" />
      </div>
    );
  }

  return (
    <div className={`${cardCls} p-8 max-w-md mx-auto`}>
      <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
        {existingHash ? <Lock size={22} className="text-indigo-400" /> : <KeyRound size={22} className="text-indigo-400" />}
      </div>
      <h3 className="text-base font-bold text-white mb-1.5 text-center font-['Plus_Jakarta_Sans']">
        {existingHash ? "Invoicing is locked" : "Set an Invoicing password"}
      </h3>
      <p className="text-xs text-[#6b7fa8] mb-5 text-center font-['Plus_Jakarta_Sans']">
        {existingHash
          ? "Enter the shared module password to continue."
          : "No password has been set yet. Choose one to protect this module — anyone with CEO/Superadmin access will need it."}
      </p>
      <form onSubmit={existingHash ? handleEnterPassword : handleSetPassword} className="space-y-3">
        <input
          type="password"
          autoFocus
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={existingHash ? "Module password" : "New module password"}
          className={inputCls}
        />
        {!existingHash && (
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            className={inputCls}
          />
        )}
        {error && <p className="text-xs text-red-400 font-['Plus_Jakarta_Sans']">{error}</p>}
        <button type="submit" disabled={submitting} className={`${btnPrimary} w-full justify-center disabled:opacity-60`}>
          {submitting ? <Loader2 size={15} className="animate-spin" /> : existingHash ? "Unlock" : "Set Password"}
        </button>
      </form>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────
export function InvoicingView({ userRole = "" }: { userRole?: string }) {
  const allowed = isInvoicingRole(userRole);
  const [unlocked, setUnlocked] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const [tab, setTab] = useState<Tab>("invoices");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<InvoiceClient[]>([]);
  const [companies, setCompanies] = useState<InvoiceCompany[]>([]);
  const [banks, setBanks] = useState<InvoiceBankDetail[]>([]);
  const [wages, setWages] = useState<InvoiceWage[]>([]);
  const [loading, setLoading] = useState(true);

  const [invoiceModal, setInvoiceModal] = useState<{ open: boolean; editing: Invoice | null }>({ open: false, editing: null });
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [clientModal, setClientModal] = useState<{ open: boolean; editing: InvoiceClient | null }>({ open: false, editing: null });
  const [companyModal, setCompanyModal] = useState<{ open: boolean; editing: InvoiceCompany | null }>({ open: false, editing: null });
  const [bankModal, setBankModal] = useState<{ open: boolean; editing: InvoiceBankDetail | null }>({ open: false, editing: null });
  const [wageModal, setWageModal] = useState<{ open: boolean; editing: InvoiceWage | null }>({ open: false, editing: null });
  const [previewWage, setPreviewWage] = useState<InvoiceWage | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [inv, cl, co, bk, wg] = await Promise.all([
      fetchInvoices(), fetchInvoiceClients(), fetchInvoiceCompanies(), fetchInvoiceBankDetails(), fetchInvoiceWages(),
    ]);
    setInvoices(inv); setClients(cl); setCompanies(co); setBanks(bk); setWages(wg);
    setLoading(false);
  }, []);

  useEffect(() => { if (allowed && unlocked) void load(); }, [load, allowed, unlocked]);

  useEffect(() => {
    if (!allowed || !unlocked) return;
    const channel = supabase
      .channel("invoicing-module")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoicing_invoices" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "invoicing_clients" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "invoicing_companies" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "invoicing_bank_details" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "invoicing_wages" }, () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, allowed, unlocked]);

  if (!allowed) {
    return (
      <div className={`${cardCls} p-8 max-w-lg mx-auto text-center`}>
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={22} className="text-rose-400" />
        </div>
        <h3 className="text-base font-bold text-white mb-1.5 font-['Plus_Jakarta_Sans']">Invoicing is restricted</h3>
        <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
          Invoicing data is visible to CEO and Superadmin accounts only. Contact your administrator if you need access.
        </p>
      </div>
    );
  }

  if (!unlocked) {
    return <ModuleLockGate onUnlock={() => setUnlocked(true)} />;
  }

  const filteredInvoices = invoices.filter(i =>
    !search ||
    i.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
    (i.client_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const TABS: { id: Tab; label: string; icon: React.FC<{ size?: number; className?: string }>; searchPlaceholder: string }[] = [
    { id: "invoices", label: "Invoices", icon: FileText, searchPlaceholder: "Search invoices..." },
    { id: "clients", label: "Clients", icon: Users, searchPlaceholder: "Search clients..." },
    { id: "companies", label: "Companies", icon: Building2, searchPlaceholder: "Search companies..." },
    { id: "banks", label: "Bank Details", icon: Landmark, searchPlaceholder: "Search bank details..." },
    { id: "wages", label: "Wages", icon: Wallet, searchPlaceholder: "Search wage slips..." },
  ];

  const filteredClients = clients.filter(c =>
    !search ||
    c.client_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredCompanies = companies.filter(c =>
    !search ||
    c.trade_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.gst_no ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredBanks = banks.filter(b =>
    !search ||
    b.bank_name.toLowerCase().includes(search.toLowerCase()) ||
    (b.account_name ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredWages = wages.filter(w =>
    !search ||
    (w.employee_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    w.salary_period.includes(search)
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSearch(""); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold font-['Plus_Jakarta_Sans'] border transition-all ${
                tab === t.id ? "bg-indigo-600/15 border-indigo-500/30 text-white" : "border-[rgba(99,102,241,0.12)] text-[#6b7fa8] hover:text-[#a8b5d1]"
              }`}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7fa8]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={TABS.find(t => t.id === tab)?.searchPlaceholder}
              className="bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl pl-9 pr-4 py-2 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans']"
            />
          </div>
          <button
            onClick={() => setChangePasswordOpen(true)}
            title="Change Invoicing module password"
            className={`${btnSecondary} !px-3`}
          >
            <Lock size={14} />
          </button>
          {tab === "invoices" && (
            <button onClick={() => setInvoiceModal({ open: true, editing: null })} className={btnPrimary}>
              <Plus size={15} /> New Invoice
            </button>
          )}
          {tab === "clients" && (
            <button onClick={() => setClientModal({ open: true, editing: null })} className={btnPrimary}>
              <Plus size={15} /> New Client
            </button>
          )}
          {tab === "companies" && (
            <button onClick={() => setCompanyModal({ open: true, editing: null })} className={btnPrimary}>
              <Plus size={15} /> New Company
            </button>
          )}
          {tab === "banks" && (
            <button onClick={() => setBankModal({ open: true, editing: null })} className={btnPrimary}>
              <Plus size={15} /> New Bank Detail
            </button>
          )}
          {tab === "wages" && (
            <button onClick={() => setWageModal({ open: true, editing: null })} className={btnPrimary}>
              <Plus size={15} /> New Wage Slip
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={`${cardCls} p-10 text-center`}>
          <Loader2 size={20} className="animate-spin text-indigo-400 mx-auto mb-2" />
          <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">Loading...</p>
        </div>
      ) : tab === "invoices" ? (
        <InvoiceTable
          invoices={filteredInvoices}
          onEdit={inv => setInvoiceModal({ open: true, editing: inv })}
          onPreview={inv => setPreviewInvoice(inv)}
          onDelete={async id => { if (confirm("Delete this invoice?")) { await deleteInvoice(id); toast.success("Invoice deleted."); void load(); } }}
        />
      ) : tab === "clients" ? (
        <ClientTable
          clients={filteredClients}
          onEdit={c => setClientModal({ open: true, editing: c })}
          onDelete={async id => { if (confirm("Delete this client?")) { await deleteInvoiceClient(id); toast.success("Client deleted."); void load(); } }}
        />
      ) : tab === "companies" ? (
        <CompanyTable
          companies={filteredCompanies}
          onEdit={c => setCompanyModal({ open: true, editing: c })}
          onDelete={async id => { if (confirm("Delete this company?")) { await deleteInvoiceCompany(id); toast.success("Company deleted."); void load(); } }}
        />
      ) : tab === "banks" ? (
        <BankTable
          banks={filteredBanks}
          onEdit={b => setBankModal({ open: true, editing: b })}
          onDelete={async id => { if (confirm("Delete this bank detail?")) { await deleteInvoiceBankDetail(id); toast.success("Bank detail deleted."); void load(); } }}
        />
      ) : (
        <WagesTable
          wages={filteredWages}
          onEdit={w => setWageModal({ open: true, editing: w })}
          onPreview={w => setPreviewWage(w)}
          onDelete={async id => { if (confirm("Delete this wage slip?")) { await deleteInvoiceWages(id); toast.success("Wage slip deleted."); void load(); } }}
        />
      )}

      {invoiceModal.open && (
        <InvoiceFormModal
          editing={invoiceModal.editing}
          clients={clients}
          companies={companies}
          banks={banks}
          onClose={() => setInvoiceModal({ open: false, editing: null })}
          onSaved={() => { setInvoiceModal({ open: false, editing: null }); void load(); }}
        />
      )}
      {previewInvoice && (
        <InvoicePreviewModal invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} />
      )}
      {clientModal.open && (
        <ClientFormModal
          editing={clientModal.editing}
          onClose={() => setClientModal({ open: false, editing: null })}
          onSaved={() => { setClientModal({ open: false, editing: null }); void load(); }}
        />
      )}
      {companyModal.open && (
        <CompanyFormModal
          editing={companyModal.editing}
          onClose={() => setCompanyModal({ open: false, editing: null })}
          onSaved={() => { setCompanyModal({ open: false, editing: null }); void load(); }}
        />
      )}
      {bankModal.open && (
        <BankFormModal
          editing={bankModal.editing}
          onClose={() => setBankModal({ open: false, editing: null })}
          onSaved={() => { setBankModal({ open: false, editing: null }); void load(); }}
        />
      )}
      {wageModal.open && (
        <WageFormModal
          editing={wageModal.editing}
          companies={companies}
          onClose={() => setWageModal({ open: false, editing: null })}
          onSaved={() => { setWageModal({ open: false, editing: null }); void load(); }}
        />
      )}
      {previewWage && (
        <WageSlipPreviewModal wage={previewWage} onClose={() => setPreviewWage(null)} />
      )}
      {changePasswordOpen && (
        <ChangeInvoicingPasswordModal onClose={() => setChangePasswordOpen(false)} />
      )}
    </div>
  );
}

// ── Invoice table ─────────────────────────────────────────────
function InvoiceTable({
  invoices, onEdit, onPreview, onDelete,
}: {
  invoices: Invoice[];
  onEdit: (i: Invoice) => void;
  onPreview: (i: Invoice) => void;
  onDelete: (id: string) => void;
}) {
  if (invoices.length === 0) {
    return (
      <div className={`${cardCls} p-10 text-center`}>
        <FileText size={22} className="text-[#6b7fa8] mx-auto mb-2" />
        <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">No invoices yet.</p>
      </div>
    );
  }
  return (
    <div className={`${cardCls} p-5 overflow-x-auto`}>
      <div className="space-y-2 min-w-[820px]">
        {/* Columns match the legacy invoice list: Client Name, Company, Status, Bank Name, Acc. No, Amount, Date, Action */}
        <div className="grid grid-cols-8 gap-3 px-3 py-2">
          {["Client Name", "Company", "Status", "Bank Name", "Acc. No", "Amount", "Date", ""].map(h => (
            <span key={h} className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] uppercase tracking-wider">{h}</span>
          ))}
        </div>
        {invoices.map(inv => {
          const total = lineItemsTotal(inv.line_items) + inv.cgst + inv.sgst - inv.advance_amount;
          return (
            <div key={inv.id} className="grid grid-cols-8 gap-3 px-3 py-3 bg-[#131a35] rounded-lg border border-[rgba(99,102,241,0.08)] items-center hover:border-indigo-500/15 transition-colors">
              <p className="text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] truncate">{inv.client_name ?? "N/A"}</p>
              <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] truncate">{inv.client_company ?? "N/A"}</p>
              <span className={`inline-flex w-fit px-2 py-0.5 rounded-md text-[10px] font-semibold border font-['Plus_Jakarta_Sans'] ${statusConfig(inv.payment_status).color}`}>
                {statusConfig(inv.payment_status).label}
              </span>
              <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] truncate">{inv.bank_name ?? "N/A"}</p>
              <p className="text-xs font-['Geist_Mono'] text-[#6b7fa8] truncate">{inv.bank_account_no ?? "N/A"}</p>
              <p className="text-xs font-bold font-['Geist_Mono'] text-[#e2e8f7]">{inv.currency} {total.toFixed(2)}</p>
              <p className="text-xs font-['Geist_Mono'] text-[#6b7fa8]">{inv.invoice_date}</p>
              <div className="flex items-center gap-1 justify-end">
                <button onClick={() => onPreview(inv)} title="Preview / Download" className="p-1.5 rounded-lg text-[#6b7fa8] hover:text-indigo-400 hover:bg-indigo-500/10"><Download size={14} /></button>
                <button onClick={() => onEdit(inv)} title="Edit" className="p-1.5 rounded-lg text-[#6b7fa8] hover:text-white hover:bg-white/[0.05]"><Pencil size={14} /></button>
                <button onClick={() => onDelete(inv.id)} title="Delete" className="p-1.5 rounded-lg text-[#6b7fa8] hover:text-rose-400 hover:bg-rose-500/10"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Generic small entity tables ──────────────────────────────
function ClientTable({ clients, onEdit, onDelete }: { clients: InvoiceClient[]; onEdit: (c: InvoiceClient) => void; onDelete: (id: string) => void }) {
  if (clients.length === 0) return <EmptyState icon={Users} text="No clients yet." />;
  return (
    <div className={`${cardCls} p-5 space-y-2`}>
      {clients.map(c => (
        <div key={c.id} className="flex items-center justify-between px-3 py-3 bg-[#131a35] rounded-lg border border-[rgba(99,102,241,0.08)]">
          <div className="min-w-0">
            <p className="text-sm text-[#e2e8f7] font-semibold font-['Plus_Jakarta_Sans'] truncate">{c.client_name}</p>
            <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] truncate">{c.company || c.email || "—"}</p>
          </div>
          <RowActions onEdit={() => onEdit(c)} onDelete={() => onDelete(c.id)} />
        </div>
      ))}
    </div>
  );
}

function CompanyTable({ companies, onEdit, onDelete }: { companies: InvoiceCompany[]; onEdit: (c: InvoiceCompany) => void; onDelete: (id: string) => void }) {
  if (companies.length === 0) return <EmptyState icon={Building2} text="No companies yet." />;
  return (
    <div className={`${cardCls} p-5 space-y-2`}>
      {companies.map(c => (
        <div key={c.id} className="flex items-center justify-between px-3 py-3 bg-[#131a35] rounded-lg border border-[rgba(99,102,241,0.08)]">
          <div className="flex items-center gap-3 min-w-0">
            {c.logo_url ? (
              <img src={c.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain bg-white/5 shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0"><Building2 size={14} className="text-indigo-400" /></div>
            )}
            <div className="min-w-0">
              <p className="text-sm text-[#e2e8f7] font-semibold font-['Plus_Jakarta_Sans'] truncate">{c.trade_name}</p>
              <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] truncate">{c.gst_no || "—"}</p>
            </div>
          </div>
          <RowActions onEdit={() => onEdit(c)} onDelete={() => onDelete(c.id)} />
        </div>
      ))}
    </div>
  );
}

function BankTable({ banks, onEdit, onDelete }: { banks: InvoiceBankDetail[]; onEdit: (b: InvoiceBankDetail) => void; onDelete: (id: string) => void }) {
  if (banks.length === 0) return <EmptyState icon={Landmark} text="No bank details yet." />;
  return (
    <div className={`${cardCls} p-5 space-y-2`}>
      {banks.map(b => (
        <div key={b.id} className="flex items-center justify-between px-3 py-3 bg-[#131a35] rounded-lg border border-[rgba(99,102,241,0.08)]">
          <div className="min-w-0">
            <p className="text-sm text-[#e2e8f7] font-semibold font-['Plus_Jakarta_Sans'] truncate">{b.bank_name}</p>
            <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] truncate">{b.account_no ? `A/C •••${b.account_no.slice(-4)}` : "—"}</p>
          </div>
          <RowActions onEdit={() => onEdit(b)} onDelete={() => onDelete(b.id)} />
        </div>
      ))}
    </div>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button onClick={onEdit} title="Edit" className="p-1.5 rounded-lg text-[#6b7fa8] hover:text-white hover:bg-white/[0.05]"><Pencil size={14} /></button>
      <button onClick={onDelete} title="Delete" className="p-1.5 rounded-lg text-[#6b7fa8] hover:text-rose-400 hover:bg-rose-500/10"><Trash2 size={14} /></button>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.FC<{ size?: number; className?: string }>; text: string }) {
  return (
    <div className={`${cardCls} p-10 text-center`}>
      <Icon size={22} className="text-[#6b7fa8] mx-auto mb-2" />
      <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{text}</p>
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────
function ModalShell({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div className={`${cardCls} w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/60 rounded-b-none sm:rounded-xl`}>
        <div className="flex items-center justify-between p-5 border-b border-[rgba(99,102,241,0.12)]">
          <h2 className="text-xs font-bold text-[#6b7fa8] font-['Plus_Jakarta_Sans'] uppercase tracking-wider">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.05] text-[#6b7fa8] hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function LogoUploadField({ label, url, onChange }: { label: string; url: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isCloudinaryConfigured()) { setError("Cloudinary not configured in .env"); return; }
    setUploading(true); setError("");
    try {
      const uploaded = await uploadToCloudinary(file, "base2brand-invoicing");
      onChange(uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-lg bg-[#131a35] border border-[rgba(99,102,241,0.15)] flex items-center justify-center overflow-hidden shrink-0">
          {uploading ? <Loader2 size={16} className="animate-spin text-indigo-400" /> : url ? <img src={url} alt="" className="w-full h-full object-contain" /> : <Camera size={16} className="text-[#6b7fa8]" />}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className={`${btnSecondary} !px-3 !py-1.5 text-xs`}>
            {url ? "Change" : "Upload"}
          </button>
          {url && <button type="button" onClick={() => onChange("")} className="text-xs text-[#6b7fa8] hover:text-rose-400 px-2">Remove</button>}
        </div>
      </div>
      {error && <p className="text-[10px] text-rose-400 mt-1">{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── Client form ───────────────────────────────────────────────
function ClientFormModal({ editing, onClose, onSaved }: { editing: InvoiceClient | null; onClose: () => void; onSaved: () => void }) {
  const [clientName, setClientName] = useState(editing?.client_name ?? "");
  const [company, setCompany] = useState(editing?.company ?? "");
  const [address, setAddress] = useState(editing?.address ?? "");
  const [address1, setAddress1] = useState(editing?.address1 ?? "");
  const [address2, setAddress2] = useState(editing?.address2 ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [mobileNo, setMobileNo] = useState(editing?.mobile_no ?? "");
  const [projectsText, setProjectsText] = useState((editing?.projects ?? []).join(", "));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!clientName.trim()) { toast.error("Client name is required"); return; }
    setSaving(true);
    const projects = projectsText.split(",").map(p => p.trim()).filter(Boolean);
    const payload = { client_name: clientName.trim(), company, address, address1, address2, email, mobile_no: mobileNo, projects };
    const ok = editing ? await updateInvoiceClient(editing.id, payload) : await createInvoiceClient(payload);
    setSaving(false);
    if (ok) { toast.success(editing ? "Client updated." : "Client added."); onSaved(); }
    else toast.error("Failed to save client.");
  }

  return (
    <ModalShell title={editing ? "Edit Client" : "New Client"} onClose={onClose}>
      <div><label className={labelCls}>Client Name *</label><input className={inputCls} value={clientName} onChange={e => setClientName(e.target.value)} /></div>
      <div><label className={labelCls}>Company</label><input className={inputCls} value={company} onChange={e => setCompany(e.target.value)} /></div>
      <div><label className={labelCls}>Address</label><input className={inputCls} value={address} onChange={e => setAddress(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Address Line 2</label><input className={inputCls} value={address1} onChange={e => setAddress1(e.target.value)} /></div>
        <div><label className={labelCls}>Address Line 3</label><input className={inputCls} value={address2} onChange={e => setAddress2(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Email</label><input className={inputCls} value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><label className={labelCls}>Mobile No.</label><input className={inputCls} value={mobileNo} onChange={e => setMobileNo(e.target.value)} /></div>
      </div>
      <div><label className={labelCls}>Projects (comma-separated)</label><input className={inputCls} value={projectsText} onChange={e => setProjectsText(e.target.value)} placeholder="Website Revamp, SEO Retainer" /></div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>{saving ? <Loader2 size={14} className="animate-spin" /> : null} Save</button>
      </div>
    </ModalShell>
  );
}

// ── Change module password ───────────────────────────────────
function ChangeInvoicingPasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError("");
    const existingHash = await fetchInvoicingLockHash();
    if (existingHash) {
      const matches = await bcrypt.compare(currentPassword, existingHash);
      if (!matches) { setError("Current password is incorrect."); return; }
    }
    if (newPassword.length < 4) { setError("New password must be at least 4 characters."); return; }
    if (newPassword !== confirmPassword) { setError("New passwords do not match."); return; }
    setSaving(true);
    const hash = await bcrypt.hash(newPassword, 10);
    const ok = await setInvoicingLockHash(hash);
    setSaving(false);
    if (!ok) { setError("Could not save the new password."); return; }
    toast.success("Invoicing module password updated.");
    onClose();
  }

  return (
    <ModalShell title="Change Invoicing Password" onClose={onClose}>
      <div><label className={labelCls}>Current Password</label><input type="password" className={inputCls} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></div>
      <div><label className={labelCls}>New Password</label><input type="password" className={inputCls} value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div>
      <div><label className={labelCls}>Confirm New Password</label><input type="password" className={inputCls} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></div>
      {error && <p className="text-xs text-red-400 font-['Plus_Jakarta_Sans']">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>{saving ? <Loader2 size={14} className="animate-spin" /> : null} Save</button>
      </div>
    </ModalShell>
  );
}

// ── Company form ──────────────────────────────────────────────
function CompanyFormModal({ editing, onClose, onSaved }: { editing: InvoiceCompany | null; onClose: () => void; onSaved: () => void }) {
  const [tradeName, setTradeName] = useState(editing?.trade_name ?? "");
  const [companyAddress, setCompanyAddress] = useState(editing?.company_address ?? "");
  const [ifsc, setIfsc] = useState(editing?.ifsc ?? "");
  const [panNo, setPanNo] = useState(editing?.pan_no ?? "");
  const [gstNo, setGstNo] = useState(editing?.gst_no ?? "");
  const [logoUrl, setLogoUrl] = useState(editing?.logo_url ?? "");
  const [signatureUrl, setSignatureUrl] = useState(editing?.signature_url ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!tradeName.trim()) { toast.error("Trade name is required"); return; }
    setSaving(true);
    const payload = { trade_name: tradeName.trim(), company_address: companyAddress, ifsc, pan_no: panNo, gst_no: gstNo, logo_url: logoUrl, signature_url: signatureUrl };
    const ok = editing ? await updateInvoiceCompany(editing.id, payload) : await createInvoiceCompany(payload);
    setSaving(false);
    if (ok) { toast.success(editing ? "Company updated." : "Company added."); onSaved(); }
    else toast.error("Failed to save company.");
  }

  return (
    <ModalShell title={editing ? "Edit Company" : "New Company"} onClose={onClose}>
      <div><label className={labelCls}>Trade Name *</label><input className={inputCls} value={tradeName} onChange={e => setTradeName(e.target.value)} /></div>
      <div><label className={labelCls}>Address</label><input className={inputCls} value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>IFSC</label><input className={inputCls} value={ifsc} onChange={e => setIfsc(e.target.value)} /></div>
        <div><label className={labelCls}>PAN No.</label><input className={inputCls} value={panNo} onChange={e => setPanNo(e.target.value)} /></div>
      </div>
      <div><label className={labelCls}>GST No.</label><input className={inputCls} value={gstNo} onChange={e => setGstNo(e.target.value)} /></div>
      <LogoUploadField label="Logo" url={logoUrl} onChange={setLogoUrl} />
      <LogoUploadField label="Signature" url={signatureUrl} onChange={setSignatureUrl} />
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>{saving ? <Loader2 size={14} className="animate-spin" /> : null} Save</button>
      </div>
    </ModalShell>
  );
}

// ── Bank form ─────────────────────────────────────────────────
function BankFormModal({ editing, onClose, onSaved }: { editing: InvoiceBankDetail | null; onClose: () => void; onSaved: () => void }) {
  const [bankName, setBankName] = useState(editing?.bank_name ?? "");
  const [accountNo, setAccountNo] = useState(editing?.account_no ?? "");
  const [accountType, setAccountType] = useState(editing?.account_type ?? "");
  const [branchName, setBranchName] = useState(editing?.branch_name ?? "");
  const [ifscCode, setIfscCode] = useState(editing?.ifsc_code ?? "");
  const [swiftCode, setSwiftCode] = useState(editing?.swift_code ?? "");
  const [accountName, setAccountName] = useState(editing?.account_name ?? "");
  const [tradeName, setTradeName] = useState(editing?.trade_name ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!bankName.trim()) { toast.error("Bank name is required"); return; }
    setSaving(true);
    const payload = { bank_name: bankName.trim(), account_no: accountNo, account_type: accountType, branch_name: branchName, ifsc_code: ifscCode, swift_code: swiftCode, account_name: accountName, trade_name: tradeName };
    const ok = editing ? await updateInvoiceBankDetail(editing.id, payload) : await createInvoiceBankDetail(payload);
    setSaving(false);
    if (ok) { toast.success(editing ? "Bank detail updated." : "Bank detail added."); onSaved(); }
    else toast.error("Failed to save bank detail.");
  }

  return (
    <ModalShell title={editing ? "Edit Bank Detail" : "New Bank Detail"} onClose={onClose}>
      <div><label className={labelCls}>Bank Name *</label><input className={inputCls} value={bankName} onChange={e => setBankName(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Account No.</label><input className={inputCls} value={accountNo} onChange={e => setAccountNo(e.target.value)} /></div>
        <div><label className={labelCls}>Account Type</label><input className={inputCls} value={accountType} onChange={e => setAccountType(e.target.value)} /></div>
      </div>
      <div><label className={labelCls}>Account Name</label><input className={inputCls} value={accountName} onChange={e => setAccountName(e.target.value)} /></div>
      <div><label className={labelCls}>Branch Name</label><input className={inputCls} value={branchName} onChange={e => setBranchName(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>IFSC Code</label><input className={inputCls} value={ifscCode} onChange={e => setIfscCode(e.target.value)} /></div>
        <div><label className={labelCls}>SWIFT Code</label><input className={inputCls} value={swiftCode} onChange={e => setSwiftCode(e.target.value)} /></div>
      </div>
      <div><label className={labelCls}>Trade Name</label><input className={inputCls} value={tradeName} onChange={e => setTradeName(e.target.value)} /></div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>{saving ? <Loader2 size={14} className="animate-spin" /> : null} Save</button>
      </div>
    </ModalShell>
  );
}

// ── Invoice form ──────────────────────────────────────────────
function InvoiceFormModal({
  editing, clients, companies, banks, onClose, onSaved,
}: {
  editing: Invoice | null;
  clients: InvoiceClient[];
  companies: InvoiceCompany[];
  banks: InvoiceBankDetail[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clientId, setClientId] = useState(editing?.client_id ?? "");
  const [companyId, setCompanyId] = useState(editing?.company_id ?? "");
  const [bankId, setBankId] = useState(editing?.bank_id ?? "");
  const [invoiceDate, setInvoiceDate] = useState(editing?.invoice_date ?? new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState(editing?.currency ?? "INR");
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(editing?.line_items?.length ? editing.line_items : [{ project: "", description: "", amount: 0 }]);
  const [enableGst, setEnableGst] = useState(editing?.enable_gst ?? false);
  const [cgstPercent, setCgstPercent] = useState(editing?.cgst_percent ?? 9);
  const [sgstPercent, setSgstPercent] = useState(editing?.sgst_percent ?? 9);
  const [clientGstNo, setClientGstNo] = useState(editing?.client_gst_no ?? "");
  const [advanceAmount, setAdvanceAmount] = useState(editing?.advance_amount ?? 0);
  const [paymentStatus, setPaymentStatus] = useState<InvoicePaymentStatus>(editing?.payment_status ?? "unpaid");
  const [payMethod, setPayMethod] = useState(editing?.pay_method ?? "bank");
  const [paytmId, setPaytmId] = useState(editing?.payment_options?.paytm?.id ?? "");
  const [paypalId, setPaypalId] = useState(editing?.payment_options?.paypal?.id ?? "");
  const [wiseId, setWiseId] = useState(editing?.payment_options?.wise?.id ?? "");
  const [payoneerId, setPayoneerId] = useState(editing?.payment_options?.payoneer?.id ?? "");
  const [saving, setSaving] = useState(false);

  const selectedClient = clients.find(c => c.id === clientId);
  const subtotal = lineItemsTotal(lineItems);
  const cgst = enableGst ? Math.round(subtotal * cgstPercent) / 100 : 0;
  const sgst = enableGst ? Math.round(subtotal * sgstPercent) / 100 : 0;
  const total = subtotal + cgst + sgst - advanceAmount;

  function updateLineItem(index: number, patch: Partial<InvoiceLineItem>) {
    setLineItems(prev => prev.map((li, i) => (i === index ? { ...li, ...patch } : li)));
  }
  function addLineItem() {
    setLineItems(prev => [...prev, { project: selectedClient?.projects?.[0] ?? "", description: "", amount: 0 }]);
  }
  function removeLineItem(index: number) {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!clientId) { toast.error("Select a client"); return; }
    if (lineItems.every(li => !li.description.trim())) { toast.error("Add at least one line item"); return; }

    setSaving(true);
    const company = companies.find(c => c.id === companyId);
    const bank = banks.find(b => b.id === bankId);
    const payload = {
      client_id: clientId,
      company_id: companyId || undefined,
      bank_id: bankId || undefined,
      // Snapshot the bank's details onto the invoice itself, matching the legacy app's
      // own pattern — bank names aren't unique, so a live join can't be trusted later.
      bank_name: bank?.bank_name ?? undefined,
      bank_account_no: bank?.account_no ?? undefined,
      bank_branch_name: bank?.branch_name ?? undefined,
      bank_account_name: bank?.account_name ?? undefined,
      bank_account_type: bank?.account_type ?? undefined,
      bank_ifsc_code: bank?.ifsc_code ?? undefined,
      bank_swift_code: bank?.swift_code ?? undefined,
      invoice_date: invoiceDate,
      currency,
      line_items: lineItems.filter(li => li.description.trim() || li.amount),
      amount: subtotal,
      enable_gst: enableGst,
      cgst_percent: enableGst ? cgstPercent : 0,
      sgst_percent: enableGst ? sgstPercent : 0,
      cgst, sgst,
      client_gst_no: clientGstNo,
      company_gst_no: company?.gst_no ?? "",
      advance_amount: advanceAmount,
      payment_status: paymentStatus,
      pay_method: payMethod,
      payment_options: {
        paytm: paytmId ? { name: "", id: paytmId } : undefined,
        paypal: paypalId ? { name: "", id: paypalId } : undefined,
        wise: wiseId ? { name: "", id: wiseId } : undefined,
        payoneer: payoneerId ? { name: "", id: payoneerId } : undefined,
      },
      company_logo_url: company?.logo_url ?? "",
      signature_url: company?.signature_url ?? "",
    };
    const ok = editing ? await updateInvoice(editing.id, payload) : await createInvoice(payload);
    setSaving(false);
    if (ok) { toast.success(editing ? "Invoice updated." : "Invoice created."); onSaved(); }
    else toast.error("Failed to save invoice.");
  }

  return (
    <ModalShell title={editing ? `Edit ${editing.invoice_no}` : "New Invoice"} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Client *</label>
          <select className={inputCls} value={clientId} onChange={e => setClientId(e.target.value)}>
            <option value="">Select client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Invoice Date</label>
          <input type="date" className={inputCls} value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Issuing Company</label>
          <select className={inputCls} value={companyId} onChange={e => setCompanyId(e.target.value)}>
            <option value="">Select company</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.trade_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Bank Detail</label>
          <select className={inputCls} value={bankId} onChange={e => setBankId(e.target.value)}>
            <option value="">Select bank</option>
            {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelCls}>Line Items</label>
          <button type="button" onClick={addLineItem} className="text-xs text-indigo-400 hover:text-indigo-300 font-['Plus_Jakarta_Sans']">+ Add line</button>
        </div>
        <div className="space-y-2">
          {lineItems.map((li, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input className={`${inputCls} col-span-3`} placeholder="Project" value={li.project} onChange={e => updateLineItem(i, { project: e.target.value })} />
              <input className={`${inputCls} col-span-6`} placeholder="Description" value={li.description} onChange={e => updateLineItem(i, { description: e.target.value })} />
              <input type="number" className={`${inputCls} col-span-2`} placeholder="Amount" value={li.amount || ""} onChange={e => updateLineItem(i, { amount: Number(e.target.value) || 0 })} />
              <button type="button" onClick={() => removeLineItem(i)} className="col-span-1 p-2 text-[#6b7fa8] hover:text-rose-400"><X size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="enable-gst" checked={enableGst} onChange={e => setEnableGst(e.target.checked)} className="accent-indigo-500" />
        <label htmlFor="enable-gst" className="text-xs text-[#a8b5d1] font-['Plus_Jakarta_Sans']">Apply GST</label>
      </div>
      {enableGst && (
        <div className="grid grid-cols-3 gap-3">
          <div><label className={labelCls}>CGST %</label><input type="number" className={inputCls} value={cgstPercent} onChange={e => setCgstPercent(Number(e.target.value) || 0)} /></div>
          <div><label className={labelCls}>SGST %</label><input type="number" className={inputCls} value={sgstPercent} onChange={e => setSgstPercent(Number(e.target.value) || 0)} /></div>
          <div><label className={labelCls}>Client GST No.</label><input className={inputCls} value={clientGstNo} onChange={e => setClientGstNo(e.target.value)} /></div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div><label className={labelCls}>Advance Paid</label><input type="number" className={inputCls} value={advanceAmount || ""} onChange={e => setAdvanceAmount(Number(e.target.value) || 0)} /></div>
        <div>
          <label className={labelCls}>Payment Status</label>
          <select className={inputCls} value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as InvoicePaymentStatus)}>
            <option value="draft">Draft</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Payment Method</label>
          <select className={inputCls} value={payMethod} onChange={e => setPayMethod(e.target.value)}>
            <option value="bank">Bank Transfer</option>
            <option value="paytm">Paytm</option>
            <option value="paypal">PayPal</option>
            <option value="wise">Wise</option>
            <option value="payOneer">Payoneer</option>
          </select>
        </div>
        {payMethod === "paytm" && (
          <div><label className={labelCls}>Paytm ID</label><input className={inputCls} value={paytmId} onChange={e => setPaytmId(e.target.value)} /></div>
        )}
        {payMethod === "paypal" && (
          <div><label className={labelCls}>PayPal ID</label><input className={inputCls} value={paypalId} onChange={e => setPaypalId(e.target.value)} /></div>
        )}
        {payMethod === "wise" && (
          <div><label className={labelCls}>Wise ID</label><input className={inputCls} value={wiseId} onChange={e => setWiseId(e.target.value)} /></div>
        )}
        {payMethod === "payOneer" && (
          <div><label className={labelCls}>Payoneer ID</label><input className={inputCls} value={payoneerId} onChange={e => setPayoneerId(e.target.value)} /></div>
        )}
      </div>

      <div className={`${cardCls} p-4 flex items-center justify-between`}>
        <span className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">Total Payable</span>
        <span className="text-lg font-bold text-white font-['Plus_Jakarta_Sans']">{formatMoney(total, currency)}</span>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>{saving ? <Loader2 size={14} className="animate-spin" /> : null} Save</button>
      </div>
    </ModalShell>
  );
}

// ── Printable preview + PDF export ───────────────────────────
const PAY_METHOD_LABELS: Record<string, string> = {
  bank: "Bank Detail", paytm: "Paytm Detail", paypal: "PayPal Detail", wise: "Wise Detail", payOneer: "Payoneer Detail",
};

/**
 * Scoped port of the legacy app's own stylesheet rules for its invoice/salary-slip
 * templates (invoice_frontend/src/index.css — .invoice, .form-head, .bill-head,
 * .invoice-body, .thead, .deta_combine, .amount_task, .sgst_per, .total_amount,
 * .word_amount, .bank_data, .salary-slip, .wages_header, .footer, etc.), so both
 * documents use the same technique/template as the old project rather than a
 * from-scratch redesign. Every color here is a literal hex/rgb value (matching the
 * legacy source, which never used Tailwind's oklch-based palette for these), so
 * html2canvas (used internally by react-to-pdf, same library the legacy app used)
 * can rasterize it for PDF export.
 */
/**
 * Every value here is a literal port of the legacy stylesheet's rules for its invoice/
 * salary-slip templates. Applied as INLINE styles (not a <style> tag / CSS classes) —
 * html2canvas (used internally by react-to-pdf, same library the legacy app used) does
 * not reliably pick up dynamically-injected stylesheets during PDF capture, so the
 * on-screen preview looked right while the actual downloaded PDF came out completely
 * unstyled. Inline styles are part of the element itself and can't be missed.
 */
const DS: Record<string, React.CSSProperties> = {
  doc: { fontFamily: "Arial, Helvetica, sans-serif", color: "#000000", background: "#ffffff", position: "relative" },
  watermark: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", opacity: 0.08, zIndex: 0, pointerEvents: "none" },
  content: { position: "relative", zIndex: 1, background: "#ffffff" },
  p: { margin: 0 },

  appoinmentLogo: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid #4c4c4c" },
  appoinmentLogoImg: { display: "block", width: 300, objectFit: "contain" },
  taxInvoiceTitle: { fontSize: 60, lineHeight: "60px", fontWeight: 700, color: "#042d9f", margin: 0 },
  invoiceSection: { padding: 20 },
  formHead: { fontWeight: "bold", display: "flex", justifyContent: "space-between", marginBottom: 15 },
  billHead: { borderBottom: "1px solid #000000", width: "49%", paddingBottom: 10, color: "#042da0", fontSize: 18 },
  invoiceBody: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, marginBottom: 20 },
  detailP: { fontSize: 16, lineHeight: 1.8, margin: 0 },
  detailRow: { display: "grid", gridTemplateColumns: "80px 1fr", gap: 8 },
  detailLabel: { fontWeight: 600 },
  detailsDataRow: { display: "flex", justifyContent: "space-between", lineHeight: 1.8 },
  detailsDataLabel: { fontSize: 16, fontWeight: 600 },
  detailsDataSpan: { fontWeight: 500, fontSize: 16 },
  thead: { borderBottom: "1px solid #000000", paddingBottom: 10, display: "flex", marginBottom: 8 },
  theadB: { minWidth: "23%", width: "13%", maxWidth: "23%", display: "inline-block", color: "#042da0", fontSize: 18 },
  theadBWide: { minWidth: "30%", width: "13%", maxWidth: "30%", display: "inline-block", color: "#042da0", fontSize: 18 },
  detaCombine: { width: "100%", display: "flex", padding: "6px 0", lineHeight: 1.6, borderBottom: "1px solid #eeeeee" },
  detaCombineP: { width: 40, fontSize: 16, fontWeight: 600, flexShrink: 0, margin: 0 },
  taskCombine: { width: "100%", display: "flex", gap: 12 },
  taskCombineP: { width: 150, fontSize: 16, fontWeight: 600, flexShrink: 0, margin: 0 },
  taskName: { width: "100%" },
  amountTask: { display: "flex", justifyContent: "space-between", gap: 12, padding: "2px 0" },
  amountTaskP: { fontSize: 16, fontWeight: 500, margin: 0 },
  sgstPer: { width: "35%", marginLeft: "auto", textAlign: "left", fontWeight: 600, marginTop: 8 },
  totalAmount: { display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 16, marginTop: 10 },
  totalLabel: { fontSize: 18, fontWeight: 700 },
  totalValue: { borderTop: "1px solid #000000", paddingTop: 4, fontSize: 18, fontWeight: 700 },
  wordAmount: { fontSize: 20, marginBottom: "1.5rem", marginTop: "1rem", fontWeight: 700 },
  bankDataRow: { display: "flex", justifyContent: "space-between", alignItems: "center", lineHeight: "32px" },
  bankDataLabel: { fontSize: 16, fontWeight: 600 },
  bankDataSpan: { fontWeight: 700 },

  footer: { display: "flex", color: "#ffffff", fontSize: 14, alignItems: "center", justifyContent: "space-between", padding: "12px 16px", flexWrap: "wrap", gap: 10 },
  iconText: { display: "flex", gap: 7, alignItems: "center" },
  iconSpan: { border: "2px solid #ffffff", padding: 8, borderRadius: 10, display: "flex" },
  footerP: { fontSize: 13, margin: 0 },

  slipTable: { borderCollapse: "collapse", width: "100%" },
  total: { fontWeight: "bold", borderBottom: "2px solid #000000" },
  netSalaryCell: { fontWeight: "bold", textAlign: "right", borderBottom: "2px solid #000000" },
  tableRowSpan: { float: "right", fontWeight: 700 },
  sectionHeader: { fontWeight: "bold", color: "#004681" },
  botBorder: { borderBottom: "1px solid #cccccc" },
  salAdvice: { borderBottom: "1px solid #cccccc" },
  boldData: { fontWeight: 700 },
  companyHead: { textAlign: "center", marginTop: "1.5rem", fontSize: 15, fontWeight: 600, margin: "1.5rem 0 0" },
  wagesHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", background: "#ebf0f5", borderBottom: "5px solid #004681" },
  wagesHeaderImg: { width: 300, objectFit: "contain", padding: 15 },
  wagesHeaderH3: { fontSize: 26, fontWeight: 700, margin: 0, color: "#004681" },
};

/** Cell style for the salary-slip table — legacy has vertical dividers on every cell,
 * plus alternating row tint (tr:nth-child(even)) which can't be a static rule here since
 * it's a fixed set of rows, not a CSS selector — passed in per-row instead. */
function slipTd(tint: boolean, extra?: React.CSSProperties): React.CSSProperties {
  return { padding: 6, borderRight: "1px solid #cccccc", borderLeft: "1px solid #cccccc", background: tint ? "#00468114" : undefined, ...extra };
}

const PHONE_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
    <path d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.68.68 0 0 0 .178.643l2.457 2.457a.68.68 0 0 0 .644.178l2.189-.547a1.75 1.75 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.6 18.6 0 0 1-7.01-4.42 18.6 18.6 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877z" />
  </svg>
);
const GLOBE_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
    <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m7.5-6.923c-.67.204-1.335.82-1.887 1.855A8 8 0 0 0 5.145 4H7.5zM4.09 4a9.3 9.3 0 0 1 .64-1.539 7 7 0 0 1 .597-.933A7.03 7.03 0 0 0 2.255 4zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a7 7 0 0 0-.656 2.5zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5zM8.5 5v2.5h2.99a12.5 12.5 0 0 0-.337-2.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5zM5.145 12q.208.58.468 1.068c.552 1.035 1.218 1.65 1.887 1.855V12zm.182 2.472a7 7 0 0 1-.597-.933A9.3 9.3 0 0 1 4.09 12H2.255a7 7 0 0 0 3.072 2.472M3.82 11a13.7 13.7 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5zm6.853 3.472A7 7 0 0 0 13.745 12H11.91a9.3 9.3 0 0 1-.64 1.539 7 7 0 0 1-.597.933M8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855q.26-.487.468-1.068zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.7 13.7 0 0 1-.312 2.5m2.802-3.5a7 7 0 0 0-.656-2.5H12.18c.174.782.282 1.623.312 2.5zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7 7 0 0 0-3.072-2.472c.218.284.418.598.597.933M10.855 4a8 8 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4z" />
  </svg>
);
const PIN_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
    <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10m0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6" />
  </svg>
);

/** Same footer content/layout as the legacy invoice/slip footer (phone, site+email, address). */
function DocumentFooter() {
  return (
    <div style={{ background: "#042DA0" }}>
      <div style={DS.footer}>
        <div style={DS.iconText}>
          <span style={DS.iconSpan}>{PHONE_ICON}</span>
          <div><p style={DS.footerP}>+91 9872084850</p><p style={DS.footerP}>+91 8360116967</p></div>
        </div>
        <div style={DS.iconText}>
          <span style={DS.iconSpan}>{GLOBE_ICON}</span>
          <div><p style={DS.footerP}>www.base2brand.com</p><p style={DS.footerP}>hello@base2brand.com</p></div>
        </div>
        <div style={DS.iconText}>
          <span style={DS.iconSpan}>{PIN_ICON}</span>
          <div><p style={DS.footerP}>F-209, Phase 8B, Industrial Area, Sector 74, Sahibzada Ajit Singh Nagar, Punjab 160074</p></div>
        </div>
      </div>
    </div>
  );
}

function InvoicePreviewModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { toPDF, targetRef } = usePDF({ filename: "page.pdf" }); // matches the legacy app's generatePDF(targetRef, { filename: "page.pdf" }) exactly
  const subtotal = lineItemsTotal(invoice.line_items);
  const gstPercent = invoice.cgst_percent + invoice.sgst_percent;
  const gstAmount = invoice.cgst + invoice.sgst;
  // Matches Invoice.js exactly: the GST line (and total) only include GST when both
  // percent fields are set — it checks `sgstper && cgstper` directly, not a separate
  // enable_gst flag (which the legacy template never actually reads). Advance_amount
  // is never subtracted from the total on the legacy invoice document either — it's
  // tracked as a field but not deducted here.
  const hasGst = invoice.cgst_percent > 0 && invoice.sgst_percent > 0;
  const total = subtotal + (hasGst ? gstAmount : 0);
  const amountInWords = numberToWords(Math.round(total));

  // Group line items by project — matches Invoice.js: one "Task" row per project,
  // with each description line (and its amount) nested beneath it.
  const grouped: { project: string; lines: InvoiceLineItem[] }[] = [];
  const byProject = new Map<string, InvoiceLineItem[]>();
  for (const li of invoice.line_items) {
    if (!byProject.has(li.project)) { byProject.set(li.project, []); grouped.push({ project: li.project, lines: byProject.get(li.project)! }); }
    byProject.get(li.project)!.push(li);
  }

  const payMethodLabel = PAY_METHOD_LABELS[invoice.pay_method ?? ""] ?? "Bank Detail";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-[#ffffff] rounded-xl shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[#e5e7eb] sticky top-0 bg-[#ffffff] z-10">
          <span className="text-sm font-semibold text-[#374151]">{invoice.invoice_no}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => toPDF()} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg"><Download size={13} /> Download PDF</button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#f3f4f6]"><X size={16} /></button>
          </div>
        </div>
        <div ref={targetRef} style={DS.doc}>
          {invoice.company_logo_url && <img style={{ ...DS.watermark, width: "55%" }} src={invoice.company_logo_url} alt="" />}
          <div style={DS.content}>
          <div style={DS.appoinmentLogo}>
            {invoice.company_logo_url ? <img style={DS.appoinmentLogoImg} src={invoice.company_logo_url} alt="" /> : <div />}
            <h2 style={DS.taxInvoiceTitle}>Tax Invoice</h2>
          </div>
          <div style={DS.invoiceSection}>
            <div style={DS.formHead}>
              <span style={DS.billHead}>Bill To</span>
              <span style={DS.billHead}>Original For Recipient</span>
            </div>
            <div style={DS.invoiceBody}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{invoice.client_name}</p>
                <div style={DS.detailRow}><label style={DS.detailLabel}>Name :</label><p style={DS.detailP}>{invoice.client_company}</p></div>
                {/* Legacy quirk, replicated exactly: this "Address :" row shows the ISSUING
                    company's address (Invoice.js reads formData.companyAddress here), not a
                    client-specific address — there's no separate client-address field used. */}
                {invoice.company_address && <div style={DS.detailRow}><label style={DS.detailLabel}>Address :</label><p style={DS.detailP}>{invoice.company_address}</p></div>}
                {invoice.client_gst_no && <div style={DS.detailRow}><label style={DS.detailLabel}>Gst NO :</label><p style={DS.detailP}>{invoice.client_gst_no}</p></div>}
              </div>
              <div>
                <div style={DS.detailsDataRow}><label style={DS.detailsDataLabel}>Invoice No.</label><span style={DS.detailsDataSpan}>{invoice.invoice_no}</span></div>
                <div style={DS.detailsDataRow}><label style={DS.detailsDataLabel}>Invoice Date</label><span style={DS.detailsDataSpan}>{invoice.invoice_date}</span></div>
                {invoice.client_gst_no && <div style={DS.detailsDataRow}><label style={DS.detailsDataLabel}>GST Code</label><span style={DS.detailsDataSpan}>{invoice.client_gst_no}</span></div>}
              </div>
            </div>

            <div style={DS.thead}>
              <b style={DS.theadB}>Sr. No.</b><b style={DS.theadB}>Task</b><b style={DS.theadBWide}>Description</b><b style={DS.theadB}>Amount</b>
            </div>
            <div>
              {grouped.map((g, gi) => (
                <div style={DS.detaCombine} key={gi}>
                  <p style={DS.detaCombineP}>{gi + 1}</p>
                  <div style={DS.taskCombine}>
                    <p style={DS.taskCombineP}>{g.project}</p>
                    <div style={DS.taskName}>
                      {g.lines.map((li, li_i) => (
                        <section style={DS.amountTask} key={li_i}>
                          <p style={DS.amountTaskP}>{li.description}</p>
                          {!!li.amount && <b>{li.amount}</b>}
                        </section>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasGst && (
              <div style={DS.sgstPer}><p style={{ margin: 0 }}>GST ({gstPercent}%): <b>{gstAmount.toFixed(2)}</b></p></div>
            )}
            <div style={DS.totalAmount}>
              <span style={DS.totalLabel}>Total Value</span>
              <span style={DS.totalValue}>{invoice.currency} {total.toFixed(2)}</span>
            </div>

            <h3 style={DS.wordAmount}>In Words: {invoice.currency} {amountInWords} Only /-</h3>

            <div style={DS.formHead}>
              <span style={DS.billHead}>{payMethodLabel}</span>
              <span style={DS.billHead}>Company Detail</span>
            </div>
            <div style={DS.invoiceBody}>
              <div>
                {(!invoice.pay_method || invoice.pay_method === "bank") && invoice.bank_name && (
                  <>
                    <div style={DS.bankDataRow}><label style={DS.bankDataLabel}>Bank</label><span style={DS.bankDataSpan}>{invoice.bank_name}</span></div>
                    <div style={DS.bankDataRow}><label style={DS.bankDataLabel}>Branch</label><span style={DS.bankDataSpan}>{invoice.bank_branch_name}</span></div>
                    <div style={DS.bankDataRow}><label style={DS.bankDataLabel}>Account No.</label><span style={DS.bankDataSpan}>{invoice.bank_account_no}</span></div>
                    <div style={DS.bankDataRow}><label style={DS.bankDataLabel}>Account Name</label><span style={DS.bankDataSpan}>{invoice.bank_account_name}</span></div>
                    <div style={DS.bankDataRow}><label style={DS.bankDataLabel}>Account Type</label><span style={DS.bankDataSpan}>{invoice.bank_account_type}</span></div>
                    <div style={DS.bankDataRow}><label style={DS.bankDataLabel}>IFSC</label><span style={DS.bankDataSpan}>{invoice.bank_ifsc_code}</span></div>
                    <div style={DS.bankDataRow}><label style={DS.bankDataLabel}>Swift Code</label><span style={DS.bankDataSpan}>{invoice.bank_swift_code}</span></div>
                  </>
                )}
                {invoice.pay_method === "paytm" && invoice.payment_options.paytm && <div style={DS.bankDataRow}><label style={DS.bankDataLabel}>Paytm Id</label><span style={DS.bankDataSpan}>{invoice.payment_options.paytm.id}</span></div>}
                {invoice.pay_method === "paypal" && invoice.payment_options.paypal && <div style={DS.bankDataRow}><label style={DS.bankDataLabel}>Paypal Id</label><span style={DS.bankDataSpan}>{invoice.payment_options.paypal.id}</span></div>}
                {invoice.pay_method === "wise" && invoice.payment_options.wise && <div style={DS.bankDataRow}><label style={DS.bankDataLabel}>Wise Id</label><span style={DS.bankDataSpan}>{invoice.payment_options.wise.id}</span></div>}
                {invoice.pay_method === "payOneer" && invoice.payment_options.payoneer && <div style={DS.bankDataRow}><label style={DS.bankDataLabel}>Payoneer Id</label><span style={DS.bankDataSpan}>{invoice.payment_options.payoneer.id}</span></div>}
              </div>
              <div>
                <div style={DS.bankDataRow}><label style={DS.bankDataLabel}>Trade Name</label><span style={DS.bankDataSpan}>{invoice.company_name}</span></div>
                {/* Legacy quirk, replicated exactly: this "Ifsc Code" row is gated on the
                    CLIENT's GST number being present, not the company's IFSC — that's
                    what Invoice.js actually does (likely a copy-paste bug in the source). */}
                {invoice.client_gst_no && <div style={DS.bankDataRow}><label style={DS.bankDataLabel}>Ifsc Code</label><span style={DS.bankDataSpan}>{invoice.company_ifsc}</span></div>}
                <div style={DS.bankDataRow}><label style={DS.bankDataLabel}>GSTIN</label><span style={DS.bankDataSpan}>{invoice.company_gst_no}</span></div>
                {!invoice.client_gst_no && <div style={DS.bankDataRow}><label style={DS.bankDataLabel}>PAN</label><span style={DS.bankDataSpan}>{invoice.company_pan_no}</span></div>}
                <div style={DS.bankDataRow}><label style={DS.bankDataLabel}>Address</label><span style={DS.bankDataSpan}>{invoice.company_address}</span></div>
                {invoice.signature_url && <div style={DS.bankDataRow}><label></label><span><img src={invoice.signature_url} alt="Signature" style={{ width: 80, height: 45, objectFit: "cover", marginTop: 6 }} /></span></div>}
                <div style={DS.bankDataRow}><label></label><span style={DS.bankDataSpan}>{invoice.company_name}</span></div>
              </div>
            </div>
          </div>
          <DocumentFooter />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Wages table ───────────────────────────────────────────────
function WagesTable({
  wages, onEdit, onPreview, onDelete,
}: {
  wages: InvoiceWage[];
  onEdit: (w: InvoiceWage) => void;
  onPreview: (w: InvoiceWage) => void;
  onDelete: (id: string) => void;
}) {
  if (wages.length === 0) return <EmptyState icon={Wallet} text="No wage slips yet." />;
  return (
    <div className={`${cardCls} p-5 overflow-x-auto`}>
      <div className="space-y-2 min-w-[900px]">
        {/* Columns match the legacy wages list: Date, Emp. Name, F/H Name, Dept., Designation, Emp. Code, Company Name, RS, Action */}
        <div className="grid grid-cols-9 gap-3 px-3 py-2">
          {["Date", "Emp. Name", "F/H Name", "Dept.", "Designation", "Emp. Code", "Company Name", "RS", ""].map(h => (
            <span key={h} className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] uppercase tracking-wider">{h}</span>
          ))}
        </div>
        {wages.map(w => (
          <div key={w.id} className="grid grid-cols-9 gap-3 px-3 py-3 bg-[#131a35] rounded-lg border border-[rgba(99,102,241,0.08)] items-center hover:border-indigo-500/15 transition-colors">
            <p className="text-xs font-['Geist_Mono'] text-[#6b7fa8]">{w.salary_period}</p>
            <p className="text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] truncate">{w.employee_name ?? "N/A"}</p>
            <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] truncate">{w.employee_family_member ?? "N/A"}</p>
            <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] truncate">{w.employee_dept ?? "N/A"}</p>
            <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] truncate">{w.employee_designation ?? "N/A"}</p>
            <p className="text-xs font-['Geist_Mono'] text-[#6b7fa8] truncate">{w.employee_code ?? "N/A"}</p>
            <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] truncate">{w.company_name ?? "N/A"}</p>
            <p className="text-xs font-bold font-['Geist_Mono'] text-[#e2e8f7]">{w.net_salary}</p>
            <div className="flex items-center gap-1 justify-end">
              <button onClick={() => onPreview(w)} title="pdf" className="p-1.5 rounded-lg text-[#6b7fa8] hover:text-indigo-400 hover:bg-indigo-500/10"><Download size={14} /></button>
              <button onClick={() => onEdit(w)} title="Edit" className="p-1.5 rounded-lg text-[#6b7fa8] hover:text-white hover:bg-white/[0.05]"><Pencil size={14} /></button>
              <button onClick={() => onDelete(w.id)} title="Delete" className="p-1.5 rounded-lg text-[#6b7fa8] hover:text-rose-400 hover:bg-rose-500/10"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Wage form ─────────────────────────────────────────────────
function WageFormModal({
  editing, companies, onClose, onSaved,
}: {
  editing: InvoiceWage | null;
  companies: InvoiceCompany[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: profiles } = useEmployeeProfiles();
  // useEmployeeProfiles() returns the app-wide EmployeeProfile shape, which doesn't carry
  // the two wages-only columns added to employee_profiles — fetch those separately so
  // selecting an employee can autofill them, matching the legacy form's behavior.
  type WageEmployeeFields = { family_member: string | null; employee_code: string | null; dept: string | null; role: string | null; joined: string | null };
  const [wageFieldsByEmployee, setWageFieldsByEmployee] = useState<Record<string, WageEmployeeFields>>({});
  useEffect(() => {
    void supabase.from("employee_profiles").select("id, family_member, employee_code, dept, role, joined").then(({ data }) => {
      if (!data) return;
      const map: Record<string, WageEmployeeFields> = {};
      for (const row of data as ({ id: string } & WageEmployeeFields)[]) {
        map[row.id] = { family_member: row.family_member, employee_code: row.employee_code, dept: row.dept, role: row.role, joined: row.joined };
      }
      setWageFieldsByEmployee(map);
    });
  }, []);

  const [employeeId, setEmployeeId] = useState(editing?.employee_id ?? "");
  const [companyId, setCompanyId] = useState(editing?.company_id ?? "");
  const [salaryPeriod, setSalaryPeriod] = useState(editing?.salary_period ?? new Date().toISOString().slice(0, 10));
  const [familyMember, setFamilyMember] = useState(editing?.employee_family_member ?? "");
  const [employeeCode, setEmployeeCode] = useState(editing?.employee_code ?? "");

  const [basic, setBasic] = useState(editing?.basic ?? 0);
  const [med, setMed] = useState(editing?.med ?? 0);
  const [children, setChildren] = useState(editing?.children ?? 0);
  const [house, setHouse] = useState(editing?.house ?? 0);
  const [conveyance, setConveyance] = useState(editing?.conveyance ?? 0);
  const [earning, setEarning] = useState(editing?.earning ?? 0);
  const [arrear, setArrear] = useState(editing?.arrear ?? 0);
  const [reimbursement, setReimbursement] = useState(editing?.reimbursement ?? 0);

  const [health, setHealth] = useState(editing?.health ?? 0);
  const [proftax, setProftax] = useState(editing?.proftax ?? 0);
  const [epf, setEpf] = useState(editing?.epf ?? 0);
  const [tds, setTds] = useState(editing?.tds ?? 0);

  const [daysInMonth, setDaysInMonth] = useState<number | "">(editing?.days_in_month ?? "");
  const [casualLeave, setCasualLeave] = useState(editing?.casual_leave ?? 0);
  const [medicalLeave, setMedicalLeave] = useState(editing?.medical_leave ?? 0);
  const [absent, setAbsent] = useState(editing?.absent ?? 0);
  const [netSalary, setNetSalary] = useState(editing?.net_salary ?? 0);
  const [saving, setSaving] = useState(false);

  const workingDays = daysInMonth ? DAYS_TO_WORKING_DAYS[daysInMonth] ?? null : null;
  const basicCut = basic + med + children + house + conveyance + earning + arrear + reimbursement;
  const deductionTotal = health + proftax + epf + tds;
  const totalLeaveDays = casualLeave + medicalLeave + absent;

  // Auto-recompute net salary whenever an input changes — matches legacy behavior
  // exactly, including that a prior manual override gets recomputed away if the HR
  // user then edits another field (only editing Net Salary itself is "sticky").
  useEffect(() => {
    const leaveDeduction = daysInMonth && totalLeaveDays ? Math.floor(basicCut / Number(daysInMonth)) * totalLeaveDays : 0;
    setNetSalary(Math.round(basicCut - deductionTotal - leaveDeduction));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basic, med, children, house, conveyance, earning, arrear, reimbursement, health, proftax, epf, tds, daysInMonth, casualLeave, medicalLeave, absent]);

  function handleEmployeeChange(id: string) {
    setEmployeeId(id);
    const fields = wageFieldsByEmployee[id];
    if (fields) {
      setFamilyMember(fields.family_member ?? "");
      setEmployeeCode(fields.employee_code ?? "");
    }
  }

  async function handleSave() {
    if (!employeeId) { toast.error("Select an employee"); return; }
    setSaving(true);
    const company = companies.find(c => c.id === companyId);
    const employeeFields = wageFieldsByEmployee[employeeId];
    const payload = {
      employee_id: employeeId,
      company_id: companyId || undefined,
      salary_period: salaryPeriod,
      basic, med, children, house, conveyance, earning, arrear, reimbursement,
      health, proftax, epf, tds,
      days_in_month: daysInMonth ? Number(daysInMonth) : undefined,
      working_days: workingDays ?? undefined,
      casual_leave: casualLeave, medical_leave: medicalLeave, absent,
      net_salary: netSalary,
      // Snapshot the employee's current details onto the record — a payslip should
      // reflect what was true at the time, matching the legacy wages_detail pattern.
      legacy_department: employeeFields?.dept ?? undefined,
      legacy_designation: employeeFields?.role ?? undefined,
      legacy_join_date: employeeFields?.joined ?? undefined,
      legacy_family_member: familyMember || undefined,
      legacy_employee_code: employeeCode || undefined,
      company_logo_url: company?.logo_url ?? undefined,
    };
    const ok = editing ? await updateInvoiceWages(editing.id, payload) : await createInvoiceWages(payload);
    if (ok && (familyMember || employeeCode)) {
      await updateEmployeeWageFields(employeeId, { family_member: familyMember || undefined, employee_code: employeeCode || undefined });
    }
    setSaving(false);
    if (ok) { toast.success(editing ? "Wage slip updated." : "Wage slip created."); onSaved(); }
    else toast.error("Failed to save wage slip.");
  }

  return (
    <ModalShell title={editing ? "Edit Wage Slip" : "New Wage Slip"} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Employee *</label>
          <select className={inputCls} value={employeeId} onChange={e => handleEmployeeChange(e.target.value)}>
            <option value="">Select employee</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Salary Period</label>
          <input type="date" className={inputCls} value={salaryPeriod} onChange={e => setSalaryPeriod(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className={labelCls}>F/H Name</label><input className={inputCls} value={familyMember} onChange={e => setFamilyMember(e.target.value)} /></div>
        <div><label className={labelCls}>Employee Code</label><input className={inputCls} value={employeeCode} onChange={e => setEmployeeCode(e.target.value)} /></div>
        <div>
          <label className={labelCls}>Issuing Company</label>
          <select className={inputCls} value={companyId} onChange={e => setCompanyId(e.target.value)}>
            <option value="">Select company</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.trade_name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className={labelCls}>Earnings</label>
          <div className="space-y-2">
            {([
              ["Basic", basic, setBasic], ["Medical", med, setMed], ["Children Education", children, setChildren],
              ["House Rent", house, setHouse], ["Conveyance", conveyance, setConveyance], ["Other Earning", earning, setEarning],
              ["Arrear", arrear, setArrear], ["Reimbursement", reimbursement, setReimbursement],
            ] as [string, number, (n: number) => void][]).map(([label, value, setter]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-[#a8b5d1] font-['Plus_Jakarta_Sans'] w-36 shrink-0">{label}</span>
                <input type="number" className={inputCls} value={value || ""} onChange={e => setter(Number(e.target.value) || 0)} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Deductions</label>
          <div className="space-y-2">
            {([
              ["Health", health, setHealth], ["Prof. Tax", proftax, setProftax], ["EPF", epf, setEpf], ["TDS", tds, setTds],
            ] as [string, number, (n: number) => void][]).map(([label, value, setter]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-[#a8b5d1] font-['Plus_Jakarta_Sans'] w-36 shrink-0">{label}</span>
                <input type="number" className={inputCls} value={value || ""} onChange={e => setter(Number(e.target.value) || 0)} />
              </div>
            ))}
          </div>

          <label className={`${labelCls} mt-4`}>Attendance / Leave</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">Days in Month</span>
              <select className={inputCls} value={daysInMonth} onChange={e => setDaysInMonth(e.target.value ? Number(e.target.value) : "")}>
                <option value="">—</option>
                <option value={31}>31</option><option value={30}>30</option><option value={29}>29</option><option value={28}>28</option>
              </select>
            </div>
            <div>
              <span className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">Working Days</span>
              <input disabled className={`${inputCls} opacity-60`} value={workingDays ?? ""} />
            </div>
            <div>
              <span className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">Casual Leave</span>
              <input type="number" className={inputCls} value={casualLeave || ""} onChange={e => setCasualLeave(Number(e.target.value) || 0)} />
            </div>
            <div>
              <span className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">Medical Leave</span>
              <input type="number" className={inputCls} value={medicalLeave || ""} onChange={e => setMedicalLeave(Number(e.target.value) || 0)} />
            </div>
            <div>
              <span className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">Absent</span>
              <input type="number" className={inputCls} value={absent || ""} onChange={e => setAbsent(Number(e.target.value) || 0)} />
            </div>
          </div>
        </div>
      </div>

      <div className={`${cardCls} p-4 space-y-2`}>
        <div className="flex items-center justify-between text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
          <span>Gross Salary</span><span>{formatMoney(basicCut)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
          <span>Total Deductions</span><span>{formatMoney(deductionTotal)}</span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-[rgba(99,102,241,0.12)]">
          <span className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">Net Salary</span>
          <input type="number" className="w-32 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg px-3 py-1.5 text-sm font-bold text-white text-right font-['Geist_Mono']" value={netSalary} onChange={e => setNetSalary(Number(e.target.value) || 0)} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>{saving ? <Loader2 size={14} className="animate-spin" /> : null} Save</button>
      </div>
    </ModalShell>
  );
}

// ── Printable salary slip + PDF export ───────────────────────
function WageSlipPreviewModal({ wage, onClose }: { wage: InvoiceWage; onClose: () => void }) {
  const { toPDF, targetRef } = usePDF({ filename: "page.pdf" }); // matches the legacy app's generatePDF(targetRef, { filename: "page.pdf" }) exactly
  const grossSalary = wage.basic + wage.med + wage.children + wage.house + wage.conveyance + wage.earning + wage.arrear + wage.reimbursement;
  const totalDeductions = wage.health + wage.proftax + wage.epf + wage.tds;
  const netSalary = Math.abs(Math.round(wage.net_salary));
  const period = new Date(`${wage.salary_period}T00:00:00`);
  const monthShort = isNaN(period.getTime()) ? wage.salary_period : period.toLocaleString("en-US", { month: "short" }) + "-" + String(period.getDate()).padStart(2, "0");
  const dateFull = isNaN(period.getTime()) ? wage.salary_period : `${String(period.getDate()).padStart(2, "0")}-${String(period.getMonth() + 1).padStart(2, "0")}-${period.getFullYear()}`;
  // Matches legacy's formatDate(joinDate): toLocaleDateString("en-GB", {day,month:"short",year"}) → "28 Aug 2023".
  const joinedDate = wage.employee_joined ? new Date(`${wage.employee_joined}T00:00:00`) : null;
  const joinedDisplay = joinedDate && !isNaN(joinedDate.getTime())
    ? joinedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : wage.employee_joined ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#ffffff] rounded-xl shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[#e5e7eb] sticky top-0 bg-[#ffffff] z-10">
          <span className="text-sm font-semibold text-[#374151]">{wage.employee_name} — {wage.salary_period}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => toPDF()} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg"><Download size={13} /> Download PDF</button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#f3f4f6]"><X size={16} /></button>
          </div>
        </div>
        <div ref={targetRef} style={DS.doc}>
          {wage.company_logo_url && <img style={{ ...DS.watermark, width: "40%" }} src={wage.company_logo_url} alt="" />}
          <div style={DS.content}>
          <div style={DS.wagesHeader}>
            {wage.company_logo_url ? <img style={DS.wagesHeaderImg} src={wage.company_logo_url} alt="Company Logo" /> : <span />}
            <h3 style={DS.wagesHeaderH3}>Salary Slip</h3>
          </div>

          <div style={{ padding: 20 }}>
            <table style={DS.slipTable}>
              <tbody>
                <tr>
                  <td style={slipTd(false, DS.salAdvice)}>Salary Advice for The Month</td>
                  <td style={slipTd(false, { ...DS.salAdvice, ...DS.boldData })}>{monthShort}</td>
                  <td style={slipTd(false, { ...DS.salAdvice, ...DS.boldData })}>{dateFull}</td>
                </tr>
                <tr>
                  <td style={slipTd(true, DS.botBorder)}>Emp. Name<span style={DS.tableRowSpan}>{wage.employee_name ?? ""}</span></td>
                  <td style={slipTd(true, DS.botBorder)}>Dept. </td>
                  <td style={slipTd(true, { ...DS.botBorder, ...DS.boldData })}>{wage.employee_dept ?? ""}</td>
                </tr>
                <tr>
                  <td style={slipTd(false, DS.botBorder)}>F/H Name<span style={DS.tableRowSpan}>{wage.employee_family_member ?? ""}</span></td>
                  <td style={slipTd(false, DS.botBorder)}>Designation</td>
                  <td style={slipTd(false, { ...DS.botBorder, ...DS.boldData })}>{wage.employee_designation ?? ""}</td>
                </tr>
                <tr>
                  <td style={slipTd(true, DS.botBorder)}>Date Of Joining<span style={DS.tableRowSpan}>{joinedDisplay}</span></td>
                  <td style={slipTd(true, DS.botBorder)}>Employee Code</td>
                  <td style={slipTd(true, { ...DS.botBorder, ...DS.boldData })}>{wage.employee_code ?? ""}</td>
                </tr>
                <tr>
                  <td style={slipTd(false, { ...DS.botBorder, ...DS.sectionHeader })}>Rate of salary/Wages</td>
                  <td style={slipTd(false, { ...DS.botBorder, ...DS.sectionHeader })}>Deduction</td>
                  <td style={slipTd(false, { ...DS.botBorder, ...DS.sectionHeader })}>Attendance/Leave</td>
                </tr>
                <tr>
                  <td style={slipTd(true)}>Basic<span style={DS.tableRowSpan}>{wage.basic}</span></td>
                  <td style={slipTd(true)}>Health Insurar<span style={DS.tableRowSpan}>{wage.health}</span></td>
                  <td style={slipTd(true)}>Days of this month<span style={DS.tableRowSpan}>{wage.days_in_month ?? ""}</span></td>
                </tr>
                <tr>
                  <td style={slipTd(false)}>Med.<span style={DS.tableRowSpan}>{wage.med}</span></td>
                  <td style={slipTd(false)}>EPF<span style={DS.tableRowSpan}>{wage.epf}</span></td>
                  <td style={slipTd(false)}>Working Days<span style={DS.tableRowSpan}>{wage.working_days ?? ""}</span></td>
                </tr>
                <tr>
                  <td style={slipTd(true)}>Children education Allowance<span style={DS.tableRowSpan}>{wage.children}</span></td>
                  <td style={slipTd(true)}>Prof. Tax<span style={DS.tableRowSpan}>{wage.proftax}</span></td>
                  <td style={slipTd(true)}></td>
                </tr>
                <tr>
                  <td style={slipTd(false)}>Conveyance Allowance<span style={DS.tableRowSpan}>{wage.conveyance}</span></td>
                  <td style={slipTd(false)}>TDS<span style={DS.tableRowSpan}>{wage.tds}</span></td>
                  <td style={slipTd(false)}></td>
                </tr>
                <tr>
                  <td style={slipTd(true)}>House Rent Allowance<span style={DS.tableRowSpan}>{wage.house}</span></td>
                  <td style={slipTd(true)}></td>
                  <td style={slipTd(true)}></td>
                </tr>
                <tr>
                  <td style={slipTd(false)}>Other Earnings<span style={DS.tableRowSpan}>{wage.earning}</span></td>
                  <td style={slipTd(false)}></td>
                  <td style={slipTd(false)}>Casual Leave<span style={DS.tableRowSpan}>{wage.casual_leave}</span></td>
                </tr>
                <tr>
                  <td style={slipTd(true)}>Arrear<span style={DS.tableRowSpan}>{wage.arrear}</span></td>
                  <td style={slipTd(true)}></td>
                  <td style={slipTd(true)}>Medical Leave<span style={DS.tableRowSpan}>{wage.medical_leave}</span></td>
                </tr>
                <tr>
                  <td style={slipTd(false, { borderBottom: "2px solid #000000" })}>Reimbursement<span style={DS.tableRowSpan}>{wage.reimbursement}</span></td>
                  <td style={slipTd(false, { borderBottom: "2px solid #000000" })}></td>
                  <td style={slipTd(false, { borderBottom: "2px solid #000000" })}>Absent<span style={DS.tableRowSpan}>{wage.absent}</span></td>
                </tr>
                <tr>
                  <td style={slipTd(true, DS.total)}>Gross Salary<span style={DS.tableRowSpan}>{grossSalary}</span></td>
                  <td style={slipTd(true, DS.total)}>Total<span style={DS.tableRowSpan}>{totalDeductions}</span></td>
                  <td style={slipTd(true, DS.total)}>Net Salary<span style={DS.tableRowSpan}>{netSalary}</span></td>
                </tr>
                <tr>
                  <td colSpan={2} style={slipTd(false, DS.total)}>Net Salary (in words)</td>
                  <td style={slipTd(false, DS.netSalaryCell)}>{numberToWords(netSalary)} Only/-</td>
                </tr>
              </tbody>
            </table>
            <h1 style={DS.companyHead}>This is a system genrated Pdf sign not required.</h1>
          </div>

          <DocumentFooter />
          </div>
        </div>
      </div>
    </div>
  );
}
