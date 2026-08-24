/**
 * One-time backfill for two issues found after the initial Phase 1 migration:
 *
 * 1. Logo/signature images: the Cloudinary upload preset used during migration was
 *    broken (invalid/missing preset — confirmed via both this repo's .env and the live
 *    production API), so every migrated logo_url/signature_url/company_logo_url was left
 *    blank. The legacy Express server ("app.use('/uploads', express.static(...))") is
 *    still serving those exact files, and the legacy frontend always rendered images
 *    this same way — so this points at the SAME URLs the old project actually used,
 *    not a re-upload.
 *
 * 2. Invoice bank-detail snapshot: the original migration matched each invoice's bank
 *    by NAME, which silently collapsed multiple same-named invoicing_bank_details rows
 *    (e.g. 3x "HDFC Bank" with different account numbers) into one, so some invoices
 *    ended up showing the wrong bank account. This reads bankNamed/accNo/BranchName/
 *    accName/accType/ifscCode/swiftCode straight off each invoice's own legacy
 *    tamplatetwo row instead — matching how companylogo/signature already worked.
 *
 * This is read-only against the legacy Postgres DB and only UPDATEs rows already
 * migrated (matched by legacy_id) — no new rows are inserted.
 *
 * Usage:
 *   node scripts/backfill-invoice-images.mjs            # dry run
 *   node scripts/backfill-invoice-images.mjs --yes       # apply
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DRY_RUN = !process.argv.includes("--yes");
const LEGACY_BASE_URL = "https://invoicebackend.base2brand.com";

function loadEnvFile(path) {
  const text = readFileSync(path, "utf8");
  const out = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim().replace(/\s+#.*$/, "").trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

const legacyEnv = loadEnvFile(resolve(ROOT, "invoice/invoice_backend/.env"));
const appEnv = loadEnvFile(resolve(ROOT, ".env"));

const supabase = createClient(appEnv.VITE_SUPABASE_URL, appEnv.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });
const legacyClient = new pg.Client({
  host: legacyEnv.DB_HOST, port: Number(legacyEnv.DB_PORT), database: legacyEnv.DB_NAME,
  user: legacyEnv.DB_USER, password: legacyEnv.DB_PASSWORD, ssl: { rejectUnauthorized: false },
});

function legacyUrl(relativePath) {
  if (!relativePath) return null;
  return `${LEGACY_BASE_URL}${relativePath}`;
}

async function applyUpdate(table, id, patch) {
  const nonNullPatch = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== null));
  if (Object.keys(nonNullPatch).length === 0) return false;
  if (DRY_RUN) return true;
  const { error } = await supabase.from(table).update(nonNullPatch).eq("id", id);
  if (error) throw new Error(`Update ${table}/${id} failed: ${error.message}`);
  return true;
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN (pass --yes to apply) ===" : "=== APPLYING BACKFILL ===");
  await legacyClient.connect();

  // ---- Companies ----
  const { rows: legacyCompanies } = await legacyClient.query('select "_id", "companylogo", "signature" from "company_detail"');
  const { data: companies } = await supabase.from("invoicing_companies").select("id, legacy_id");
  let companyUpdates = 0;
  for (const c of legacyCompanies) {
    const target = companies.find(x => x.legacy_id === c._id);
    if (!target) continue;
    const applied = await applyUpdate("invoicing_companies", target.id, {
      logo_url: legacyUrl(c.companylogo),
      signature_url: legacyUrl(c.signature),
    });
    if (applied) companyUpdates++;
  }
  console.log(`Companies: ${companyUpdates} updated (of ${legacyCompanies.length} legacy rows)`);

  // ---- Invoices ----
  // Also backfills the per-invoice bank-detail snapshot (bankNamed/accNo/BranchName/
  // accName/accType/ifscCode/swiftCode) directly from tamplatetwo — the original
  // migration matched bank_id by NAME, which silently collapsed multiple same-named
  // bank_detail rows (e.g. 3x "HDFC Bank" with different account numbers) into one,
  // so some invoices ended up linked to the wrong bank account. Reading these fields
  // straight off each invoice's own legacy row (like companylogo/signature already
  // were) sidesteps that entirely — no name-matching involved.
  const { rows: legacyInvoices } = await legacyClient.query(
    'select "_id", "companylogo", "signature", "bankNamed", "accNo", "BranchName", "accName", "accType", "ifscCode", "swiftCode" from "tamplatetwo"'
  );
  const { data: invoices } = await supabase.from("invoicing_invoices").select("id, legacy_id");
  let invoiceUpdates = 0;
  for (const inv of legacyInvoices) {
    const target = invoices.find(x => x.legacy_id === inv._id);
    if (!target) continue;
    const applied = await applyUpdate("invoicing_invoices", target.id, {
      company_logo_url: legacyUrl(inv.companylogo),
      signature_url: legacyUrl(inv.signature),
      bank_name: inv.bankNamed || null,
      bank_account_no: inv.accNo || null,
      bank_branch_name: inv.BranchName || null,
      bank_account_name: inv.accName || null,
      bank_account_type: inv.accType || null,
      bank_ifsc_code: inv.ifscCode || null,
      bank_swift_code: inv.swiftCode || null,
    });
    if (applied) invoiceUpdates++;
  }
  console.log(`Invoices: ${invoiceUpdates} updated (of ${legacyInvoices.length} legacy rows)`);

  // ---- Wages ----
  // Also backfills the per-record employee-info snapshot (department/designation/
  // joinDate/familyMember/empCode) directly from wages_detail — these were only ever
  // resolved live from employee_profiles, which is blank for the 76/92 migrated
  // records with no current employee match, and reflects TODAY's profile (not what
  // was true at the time) even for the 16 that do match.
  const { rows: legacyWages } = await legacyClient.query(
    'select "_id", "companylogo", "department", "designation", "joinDate", "familyMember", "empCode" from "wages_detail"'
  );
  const { data: wages } = await supabase.from("invoicing_wages").select("id, legacy_id");
  let wageUpdates = 0;
  for (const w of legacyWages) {
    const target = wages.find(x => x.legacy_id === w._id);
    if (!target) continue;
    const applied = await applyUpdate("invoicing_wages", target.id, {
      company_logo_url: legacyUrl(w.companylogo),
      legacy_department: w.department || null,
      legacy_designation: w.designation || null,
      legacy_join_date: w.joinDate || null,
      legacy_family_member: w.familyMember || null,
      legacy_employee_code: w.empCode || null,
    });
    if (applied) wageUpdates++;
  }
  console.log(`Wages: ${wageUpdates} updated (of ${legacyWages.length} legacy rows)`);

  if (DRY_RUN) console.log("\nThis was a dry run — nothing was written. Re-run with --yes to apply.");
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => legacyClient.end());
