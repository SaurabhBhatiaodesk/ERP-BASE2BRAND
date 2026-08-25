/**
 * One-off: create the first `superadmin` account.
 *
 * Creates a Supabase Auth user via the Admin API (service-role key — NOT the
 * client-side supabase.auth.signUp() used by the in-app registration form, which
 * would hijack a local browser session if called from a script) with a generated
 * temporary password, then upserts the matching employee_profiles row with
 * app_role = 'superadmin'. The two are linked by email only (matching how the
 * in-app registration flow already links them — see src/lib/auth.ts finalizeAuthUser
 * / fetchEmployeeProfileByEmail), not by a shared id.
 *
 * Usage:
 *   node scripts/create-superadmin.mjs                                  # defaults to nitin@yopmail.com
 *   node scripts/create-superadmin.mjs someone@example.com "Full Name"  # custom account
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const EMAIL = (process.argv[2] || "nitin@yopmail.com").trim().toLowerCase();
const NAME = process.argv[3] || "Nitin Sharma";

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

function generatePassword() {
  // 16 chars, alphanumeric + a couple of symbols — easy enough to read off a terminal once.
  const bytes = crypto.randomBytes(12).toString("base64").replace(/[+/=]/g, "");
  return `${bytes.slice(0, 12)}!9`;
}

function formatJoinDate() {
  return new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function initialsFromName(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

async function main() {
  const appEnv = loadEnvFile(resolve(ROOT, ".env"));
  const supabaseUrl = appEnv.VITE_SUPABASE_URL;
  const serviceRoleKey = appEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws },
  });

  const { data: existingProfile } = await supabase
    .from("employee_profiles")
    .select("id, app_role")
    .eq("email", EMAIL)
    .maybeSingle();

  const password = generatePassword();

  console.log(`Creating auth user for ${EMAIL}...`);
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password,
    email_confirm: true,
    user_metadata: { role: "superadmin", app_role: "superadmin", full_name: NAME },
  });

  let authUserExisted = false;
  if (createError) {
    if (String(createError.message || "").toLowerCase().includes("already")) {
      authUserExisted = true;
      console.log(`Auth user for ${EMAIL} already exists — leaving its password unchanged.`);
    } else {
      throw createError;
    }
  } else {
    console.log(`Auth user created (id: ${created.user.id}).`);
  }

  if (existingProfile) {
    console.log(`employee_profiles row already exists for ${EMAIL} (id: ${existingProfile.id}, app_role: ${existingProfile.app_role || "unset"}) — updating app_role to superadmin.`);
    const { error: updateError } = await supabase
      .from("employee_profiles")
      .update({ app_role: "superadmin", role: "Super Admin" })
      .eq("id", existingProfile.id);
    if (updateError) throw updateError;
  } else {
    const profileId = crypto.randomUUID();
    console.log(`Creating employee_profiles row (id: ${profileId})...`);
    const { error: insertError } = await supabase.from("employee_profiles").insert({
      id: profileId,
      name: NAME,
      role: "Super Admin",
      dept: "Management",
      email: EMAIL,
      phone: "—",
      location: "Remote",
      joined: formatJoinDate(),
      score: 85,
      status: "Active",
      salary: "₹0",
      manager: "—",
      skills: ["Super Admin"],
      bio: "Super Admin at Base2Brand.",
      weekly_hours: ["Mon", "Tue", "Wed", "Thu", "Fri"].map(day => ({ day, h: 8 })),
      attendance: 100,
      leaves: 0,
      projects: 0,
      revenue: "₹0",
      avatar: initialsFromName(NAME),
      profile_image_url: null,
      trend: "up",
      app_role: "superadmin",
      shift_start: "10:00",
    });
    if (insertError) throw insertError;
  }

  console.log("\nDone.");
  console.log(`  Email:    ${EMAIL}`);
  if (authUserExisted) {
    console.log("  Password: (unchanged — auth user already existed, log in with the existing password)");
  } else {
    console.log(`  Password: ${password}`);
    console.log("  This password is shown only once — save it now and change it after first login.");
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
