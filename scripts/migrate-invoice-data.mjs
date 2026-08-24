/**
 * One-off migration: legacy invoice app's Postgres (DigitalOcean) → this app's Supabase.
 * Covers Phase 1 tables only: company_detail, bank_detail, client_detail, tamplatetwo.
 *
 * Read-only against the legacy DB — nothing is deleted or altered there.
 *
 * Usage:
 *   node scripts/migrate-invoice-data.mjs            # dry run — prints what would happen
 *   node scripts/migrate-invoice-data.mjs --yes       # actually writes to Supabase + Cloudinary
 *
 * Credentials are read from invoice/invoice_backend/.env (legacy DB) and the
 * project root .env (Supabase + Cloudinary) — nothing is hardcoded here.
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname, extname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DRY_RUN = !process.argv.includes("--yes");

function loadEnvFile(path) {
  const text = readFileSync(path, "utf8");
  const out = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // strip inline comments and surrounding quotes (legacy .env has both)
    value = value.replace(/\s+#.*$/, "").trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const legacyEnv = loadEnvFile(resolve(ROOT, "invoice/invoice_backend/.env"));
const appEnv = loadEnvFile(resolve(ROOT, ".env"));

const supabaseUrl = appEnv.VITE_SUPABASE_URL;
const supabaseServiceKey = appEnv.SUPABASE_SERVICE_ROLE_KEY;
const cloudName = appEnv.VITE_CLOUDINARY_CLOUD_NAME;
const uploadPreset = appEnv.VITE_CLOUDINARY_UPLOAD_PRESET;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, { realtime: { transport: ws } });

const legacyClient = new pg.Client({
  host: legacyEnv.DB_HOST,
  port: Number(legacyEnv.DB_PORT),
  database: legacyEnv.DB_NAME,
  user: legacyEnv.DB_USER,
  password: legacyEnv.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const UPLOADS_DIR = resolve(ROOT, "invoice/invoice_backend/uploads");
const uploadedFileCache = new Map(); // legacy relative path -> new Cloudinary URL
let cloudinaryBroken = false; // set after the first failure so we don't retry ~860 times

async function uploadLegacyFile(relativePath) {
  if (!relativePath) return null;
  if (uploadedFileCache.has(relativePath)) return uploadedFileCache.get(relativePath);
  if (!cloudName || !uploadPreset) {
    console.warn(`  ! Cloudinary not configured — leaving ${relativePath} unmigrated`);
    return null;
  }
  if (cloudinaryBroken) return null;
  const filename = relativePath.split("/").pop();
  const localPath = resolve(UPLOADS_DIR, filename);
  let bytes;
  try {
    bytes = readFileSync(localPath);
  } catch {
    console.warn(`  ! File not found locally, skipping: ${localPath}`);
    return null;
  }

  if (DRY_RUN) {
    const fakeUrl = `[dry-run-cloudinary-url for ${filename}]`;
    uploadedFileCache.set(relativePath, fakeUrl);
    return fakeUrl;
  }

  const ext = extname(filename).toLowerCase().replace(".", "");
  const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "application/octet-stream";
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), filename);
  form.append("upload_preset", uploadPreset);
  form.append("folder", "base2brand-invoicing-migrated");

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.text();
    console.warn(`  ! Cloudinary upload failed for ${filename}: ${body}`);
    if (body.includes("Upload preset not found")) {
      cloudinaryBroken = true;
      console.warn("  ! Cloudinary upload preset appears invalid/missing — skipping all remaining file uploads for this run. Logo/signature URLs will be left blank; re-run once the preset is fixed (see VITE_CLOUDINARY_UPLOAD_PRESET / VITE_CLOUDINARY_CLOUD_NAME in .env and the Cloudinary dashboard).");
    }
    return null;
  }
  const data = await res.json();
  uploadedFileCache.set(relativePath, data.secure_url);
  return data.secure_url;
}

async function insertRows(table, rows) {
  if (rows.length === 0) return [];
  if (DRY_RUN) {
    console.log(`  [dry-run] would insert ${rows.length} row(s) into ${table}`);
    return rows.map(r => ({ ...r, id: `[dry-run-id]` }));
  }
  const { data, error } = await supabase.from(table).insert(rows).select("*");
  if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
  return data;
}

/**
 * Insert only rows whose legacy_id isn't already present in `table`, so a re-run
 * after a partial failure doesn't duplicate rows already migrated successfully.
 * Returns the full set (previously-migrated + newly-inserted) for building lookup maps.
 */
async function insertRowsIdempotent(table, rows) {
  if (rows.length === 0) return [];
  let existing = [];
  if (!DRY_RUN) {
    const { data, error } = await supabase.from(table).select("*").not("legacy_id", "is", null);
    if (error) throw new Error(`Reading existing ${table} failed: ${error.message}`);
    existing = data ?? [];
  }
  const existingIds = new Set(existing.map(r => r.legacy_id));
  const toInsert = rows.filter(r => !existingIds.has(r.legacy_id));
  if (existing.length > 0) {
    console.log(`  ${existing.length} row(s) already migrated into ${table}, inserting ${toInsert.length} new.`);
  }
  const inserted = await insertRows(table, toInsert);
  return [...existing, ...inserted];
}

/** Legacy dates are inconsistent: InvoiceDate mixes DD/MM/YYYY and ISO; selectDate is
 * usually a clean ISO date/datetime. Prefer selectDate, fall back to parsing InvoiceDate. */
function normalizeLegacyDate(invoiceDate, selectDate) {
  if (selectDate) {
    const d = new Date(selectDate);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (invoiceDate) {
    const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(invoiceDate);
    if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
    const d = new Date(invoiceDate);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function parseMaybeArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value ? [value] : [];
    }
  }
  return [];
}

function parseMaybeObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN (pass --yes to actually migrate) ===" : "=== LIVE MIGRATION ===");
  await legacyClient.connect();
  console.log("Connected to legacy Postgres.");

  // ---- Companies ----
  const { rows: legacyCompanies } = await legacyClient.query('select * from "company_detail"');
  console.log(`Fetched ${legacyCompanies.length} company_detail row(s).`);
  const companyRows = [];
  for (const c of legacyCompanies) {
    companyRows.push({
      legacy_id: c._id,
      trade_name: c.trade || "Untitled Company",
      company_address: c.companyAddress || null,
      ifsc: c.ifsc || null,
      pan_no: c.panNo || null,
      gst_no: c.gstNo || null,
      logo_url: await uploadLegacyFile(c.companylogo),
      signature_url: await uploadLegacyFile(c.signature),
    });
  }
  const insertedCompanies = await insertRowsIdempotent("invoicing_companies", companyRows);
  const companyNameToId = new Map(insertedCompanies.map(c => [c.trade_name, c.id]));

  // ---- Bank details ----
  const { rows: legacyBanks } = await legacyClient.query('select * from "bank_detail"');
  console.log(`Fetched ${legacyBanks.length} bank_detail row(s).`);
  const bankRows = legacyBanks.map(b => ({
    legacy_id: b._id,
    bank_name: b.bankName || "Untitled Bank",
    account_no: b.accNo || null,
    account_type: b.accType || null,
    branch_name: b.BranchName || null,
    ifsc_code: b.ifscCode || null,
    swift_code: b.swiftCode || null,
    account_name: b.accName || null,
    trade_name: b.tradeName || null,
  }));
  const insertedBanks = await insertRowsIdempotent("invoicing_bank_details", bankRows);
  const bankNameToId = new Map(insertedBanks.map(b => [b.bank_name, b.id]));

  // ---- Clients ----
  const { rows: legacyClients } = await legacyClient.query('select * from "client_detail"');
  console.log(`Fetched ${legacyClients.length} client_detail row(s).`);
  const clientRows = legacyClients.map(c => ({
    legacy_id: c._id,
    client_name: c.clientName || "Untitled Client",
    company: c.company || null,
    address: c.clientAddress || null,
    address1: c.clientAddress1 || null,
    address2: c.clientAddress2 || null,
    email: c.email || null,
    mobile_no: c.mobileNo || null,
    projects: parseMaybeArray(c.project),
  }));
  const insertedClients = await insertRowsIdempotent("invoicing_clients", clientRows);
  const clientNameToId = new Map(insertedClients.map(c => [c.client_name, c.id]));

  // ---- Invoices ----
  const { rows: legacyInvoices } = await legacyClient.query('select * from "tamplatetwo"');
  console.log(`Fetched ${legacyInvoices.length} tamplatetwo (invoice) row(s).`);
  let unmatchedClient = 0, unmatchedCompany = 0, unmatchedBank = 0;
  const invoiceRows = [];
  // The legacy app never enforced invoice_no uniqueness — real duplicates exist in
  // production data (verified against the live legacy DB). Our schema does enforce it,
  // so disambiguate repeats with a suffix rather than dropping or silently renaming
  // the first occurrence.
  const seenInvoiceNo = new Map();
  const dedupedInvoiceNos = [];
  for (const inv of legacyInvoices) {
    const projects = parseMaybeArray(inv.project);
    const descriptions = parseMaybeObject(inv.description);
    const amounts = parseMaybeObject(inv.amounts);
    const lineItems = [];
    for (const projectName of projects) {
      const descLines = Array.isArray(descriptions[projectName]) ? descriptions[projectName] : [];
      const amountMap = amounts[projectName] || {};
      descLines.forEach((desc, idx) => {
        if (!desc || !desc.trim()) return;
        lineItems.push({ project: projectName, description: desc, amount: Number(amountMap[idx]) || 0 });
      });
    }

    // NOTE: tamplatetwo.bankName is broken data (holds a stale legacy Mongo ObjectId
    // or a stray numeric index, e.g. "6688197bf184ab3f33e71562" or "1") — verified against
    // the live legacy DB. The real human-readable bank name lives in `bankNamed` instead
    // (e.g. "HDFC Bank"), despite its typo-looking name. Match on that field, not bankName.
    const clientId = clientNameToId.get(inv.client) ?? null;
    const companyId = companyNameToId.get(inv.trade) ?? null;
    const bankId = bankNameToId.get(inv.bankNamed) ?? null;
    if (inv.client && !clientId) unmatchedClient++;
    if (inv.trade && !companyId) unmatchedCompany++;
    if (inv.bankNamed && !bankId) unmatchedBank++;

    const baseInvoiceNo = inv.invoiceNo || `B2B/legacy/${inv._id}`;
    const occurrence = (seenInvoiceNo.get(baseInvoiceNo) ?? 0) + 1;
    seenInvoiceNo.set(baseInvoiceNo, occurrence);
    const invoiceNo = occurrence === 1 ? baseInvoiceNo : `${baseInvoiceNo}-dup${occurrence}`;
    if (occurrence > 1) dedupedInvoiceNos.push(invoiceNo);

    invoiceRows.push({
      legacy_id: inv._id,
      invoice_no: invoiceNo,
      invoice_date: normalizeLegacyDate(inv.InvoiceDate, inv.selectDate),
      client_id: clientId,
      company_id: companyId,
      bank_id: bankId,
      line_items: lineItems,
      currency: inv.currency || "INR",
      client_gst_no: inv.gstNo || null,
      company_gst_no: inv.CompanygstNo || inv.gstin || null,
      amount: Number(inv.amount) || lineItems.reduce((s, li) => s + li.amount, 0),
      cgst: Number(inv.cgst) || 0,
      sgst: Number(inv.sgst) || 0,
      cgst_percent: Number(inv.cgstper) || 0,
      sgst_percent: Number(inv.sgstper) || 0,
      advance_amount: Number(inv.AdvanceAmount) || 0,
      // enableGST is a legacy STRING column ("true"/"false"/"yes"/"no") — Boolean(str) would
      // be wrong here since any non-empty string (including "false") is truthy in JS.
      enable_gst: ["true", "yes", "1"].includes(String(inv.enableGST).toLowerCase()),
      payment_status: (inv.paymentStatus || "unpaid").toLowerCase(),
      pay_method: inv.payMethod || null,
      payment_options: {
        paytm: inv.paytmName || inv.PaytmId ? { name: inv.paytmName || "", id: inv.PaytmId || "" } : undefined,
        paypal: inv.payPalName || inv.payPalId ? { name: inv.payPalName || "", id: inv.payPalId || "" } : undefined,
        wise: inv.wise || inv.wiseId ? { name: inv.wise || "", id: inv.wiseId || "" } : undefined,
        payoneer: inv.payOneer || inv.payoneerId ? { name: inv.payOneer || "", id: inv.payoneerId || "" } : undefined,
      },
      signature_url: await uploadLegacyFile(inv.signature),
      company_logo_url: await uploadLegacyFile(inv.companylogo),
    });
  }
  const insertedInvoices = await insertRowsIdempotent("invoicing_invoices", invoiceRows);

  // ---- Wages ----
  // The 8 earning-component columns (grosssalary, basic, med, children, house, conveyance,
  // earning, arrear) are AES-256-CTR encrypted in the legacy DB with a key that is lost —
  // verified against BOTH the checked-in .env's key AND the live production API itself,
  // neither can decrypt them. Per an explicit decision with the user, this migration brings
  // over every field that IS readable (employee info, deductions, attendance, net salary,
  // dates) and leaves those 8 fields at 0, not fabricated — see README note in the summary.
  const { rows: legacyWages } = await legacyClient.query('select * from "wages_detail"');
  console.log(`Fetched ${legacyWages.length} wages_detail row(s).`);
  let unmatchedEmployee = 0;
  const wageRows = [];
  if (legacyWages.length > 0) {
    const { data: employeeProfiles, error: empErr } = await supabase.from("employee_profiles").select("id, name");
    if (empErr) throw new Error(`Reading employee_profiles failed: ${empErr.message}`);
    const employeeNameToId = new Map((employeeProfiles ?? []).map(p => [p.name.trim().toLowerCase(), p.id]));

    for (const w of legacyWages) {
      const employeeName = w.employeeName || "";
      const employeeId = employeeNameToId.get(employeeName.trim().toLowerCase()) ?? null;
      if (employeeName && !employeeId) unmatchedEmployee++;

      const salaryPeriod = normalizeLegacyDate(null, w.chooseDate) || new Date().toISOString().slice(0, 10);

      wageRows.push({
        legacy_id: w._id,
        employee_id: employeeId,
        // Preserved even when employeeId matched, for traceability; the UI falls back to
        // this only when employee_id is null (e.g. former employees with no current profile).
        legacy_employee_name: employeeName || null,
        company_id: null, // legacy stores a free-text companyName, not a linkable id — left for manual assignment
        // NOTE: unrecoverable — see comment above. Left at 0, not a real historical value.
        basic: 0, med: 0, children: 0, house: 0, conveyance: 0, earning: 0, arrear: 0, reimbursement: 0,
        health: Number(w.health) || 0,
        proftax: Number(w.proftax) || 0,
        epf: Number(w.epf) || 0,
        tds: Number(w.tds) || 0,
        days_in_month: w.daysMonth ? Number(w.daysMonth) : null,
        working_days: w.workingDays ? Number(w.workingDays) : null,
        casual_leave: Number(w.causelLeave) || 0,
        medical_leave: Number(w.medicalLeave) || 0,
        absent: Number(w.absent) || 0,
        salary_period: salaryPeriod,
        net_salary: Number(w.netsalary) || 0,
      });
    }
  }
  const insertedWages = await insertRowsIdempotent("invoicing_wages", wageRows);

  console.log("\n=== Summary ===");
  console.log(`Companies migrated: ${insertedCompanies.length}`);
  console.log(`Bank details migrated: ${insertedBanks.length}`);
  console.log(`Clients migrated: ${insertedClients.length}`);
  console.log(`Invoices migrated: ${insertedInvoices.length}`);
  console.log(`Wage records migrated: ${insertedWages.length}`);
  if (insertedWages.length > 0) {
    console.log(`  NOTE: basic/med/children/house/conveyance/earning/arrear/reimbursement are 0 on ALL migrated wage records — the legacy encryption key for these 8 fields is lost (confirmed unrecoverable even via the live production API). Net salary, deductions, attendance, and employee info were preserved.`);
  }
  if (unmatchedEmployee) {
    console.log(`  unmatched employee references (left as NULL, review manually): ${unmatchedEmployee}`);
  }
  if (unmatchedClient || unmatchedCompany || unmatchedBank) {
    console.log(`\nWARNING — some invoices could not be matched by name to a migrated record (left as NULL, review manually):`);
    console.log(`  unmatched client references: ${unmatchedClient}`);
    console.log(`  unmatched company references: ${unmatchedCompany}`);
    console.log(`  unmatched bank references: ${unmatchedBank}`);
  }
  if (dedupedInvoiceNos.length > 0) {
    console.log(`\nWARNING — ${dedupedInvoiceNos.length} invoice(s) had a duplicate invoice_no in the legacy data (a pre-existing legacy bug) and were suffixed to stay unique:`);
    dedupedInvoiceNos.forEach(n => console.log(`  ${n}`));
  }
  if (cloudinaryBroken) {
    console.log(`\nWARNING — Cloudinary uploads failed (invalid/missing upload preset), so all logo/signature URLs on migrated rows are blank. This does not block the data migration. Fix VITE_CLOUDINARY_CLOUD_NAME/VITE_CLOUDINARY_UPLOAD_PRESET, then re-upload logos/signatures manually via the Invoicing UI — re-running this script will NOT retroactively backfill them, since already-migrated rows (matched by legacy_id) are skipped.`);
  }
  if (DRY_RUN) console.log("\nThis was a dry run — nothing was written. Re-run with --yes to migrate for real.");
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => legacyClient.end());
