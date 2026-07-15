/**
 * Bulk create/update Supabase Auth users from employee_profiles.
 * Default password: 12345678 (all employees)
 *
 * Usage: node bulk-auth-users.mjs
 * Requires .env: VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_PASSWORD = "12345678";

function loadEnv() {
  try {
    const text = readFileSync(".env", "utf8");
    const env = {};
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
    return env;
  } catch {
    return {};
  }
}

function isValidEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  return e.length > 3 && e.includes("@") && e !== "—";
}

async function fetchAllProfiles(supabase) {
  const pageSize = 500;
  let from = 0;
  const rows = [];

  while (true) {
    const { data, error } = await supabase
      .from("employee_profiles")
      .select("id, name, email, dept, role, app_role")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function findAuthUserByEmail(admin, email) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = data.users.find(u => u.email?.toLowerCase() === email);
    if (match) return match;

    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Fetching employee_profiles...\n");
  const profiles = await fetchAllProfiles(supabase);
  const valid = profiles.filter(p => isValidEmail(p.email));

  console.log(`Total profiles: ${profiles.length}`);
  console.log(`Valid emails:   ${valid.length}\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const profile of valid) {
    const email = profile.email.trim().toLowerCase();
    const appRole = profile.app_role?.trim() || "employee";

    try {
      const existing = await findAuthUserByEmail(supabase, email);

      if (existing) {
        const { error } = await supabase.auth.admin.updateUserById(existing.id, {
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: profile.name,
            role: appRole,
            app_role: appRole,
            department: profile.dept,
            designation: profile.role,
          },
        });
        if (error) throw error;
        updated += 1;
        console.log(`UPDATED  ${email}`);
      } else {
        const { error } = await supabase.auth.admin.createUser({
          email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: profile.name,
            role: appRole,
            app_role: appRole,
            department: profile.dept,
            designation: profile.role,
          },
        });
        if (error) throw error;
        created += 1;
        console.log(`CREATED  ${email}`);
      }
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`FAILED   ${email} — ${msg}`);
    }
  }

  skipped = profiles.length - valid.length;

  console.log("\n--- Done ---");
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no valid email): ${skipped}`);
  console.log(`Failed:  ${failed}`);
  console.log(`\nAll accounts password: ${DEFAULT_PASSWORD}`);
  console.log("Forgot password OTP in app: 1234 (then set new password)");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
