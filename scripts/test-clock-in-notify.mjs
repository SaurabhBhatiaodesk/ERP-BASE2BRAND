/**
 * Quick smoke test: leaders exist + clock_in notification insert works.
 * Run: node scripts/test-clock-in-notify.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const base = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!base || !key) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function rest(path, opts = {}) {
  const res = await fetch(`${base}/rest/v1/${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) throw new Error(`${res.status} ${path}: ${typeof json === "object" ? JSON.stringify(json) : text}`);
  return json;
}

function isLeader(row) {
  const appRole = (row.app_role || "").trim().toLowerCase();
  const role = (row.role || "").trim().toLowerCase();
  if (appRole === "ceo" || appRole === "teamlead" || appRole === "team_lead") return true;
  if (role.includes("ceo") || role.includes("chief executive") || role.includes("administrator")) return true;
  if (role.includes("team lead") || role.includes("teamlead") || role.includes("team leader")) return true;
  return false;
}

const profiles = await rest(
  "employee_profiles?select=id,name,role,app_role,fcm_token,web_fcm_token&order=name.asc"
);

const leaders = profiles.filter(isLeader);
const employees = profiles.filter((p) => !isLeader(p));

console.log("\n=== Clock-in notification test ===\n");
console.log(`Total profiles: ${profiles.length}`);
console.log(`Leaders (CEO/TL): ${leaders.length}`);
leaders.forEach((l) => {
  console.log(
    `  - ${l.name} (${l.app_role || l.role}) | mobile FCM: ${l.fcm_token ? "yes" : "no"} | web: ${l.web_fcm_token ? "yes" : "no"}`
  );
});

if (!leaders.length) {
  console.error("\nFAIL: No CEO/Team Lead profiles found.");
  process.exit(1);
}

const testEmployee = employees.find((e) => e.name?.toLowerCase().includes("deepak")) || employees[0];
if (!testEmployee) {
  console.error("\nFAIL: No employee profile to simulate clock-in.");
  process.exit(1);
}

console.log(`\nSimulating clock-in for: ${testEmployee.name} (${testEmployee.id})`);

const timeLabel = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const title = "Clock-in";
const message = `${testEmployee.name} clocked in at ${timeLabel}.`;
const testSessionId = `test-${Date.now()}`;

const inserts = [];
for (const leader of leaders) {
  if (leader.id === testEmployee.id) continue;
  try {
    const row = await rest("notifications", {
      method: "POST",
      body: JSON.stringify({
        recipient_id: leader.id,
        sender_id: testEmployee.id,
        title,
        message,
        type: "clock_in",
        reference_id: testSessionId,
      }),
    });
    const data = Array.isArray(row) ? row[0] : row;
    inserts.push(data);
    console.log(`  OK → ${leader.name}: notification id ${data?.id}`);
  } catch (err) {
    console.error(`  FAIL insert for ${leader.name}:`, err.message);
  }
}

const recent = await rest(
  "notifications?select=id,type,title,message,created_at,recipient_id&type=eq.clock_in&order=created_at.desc&limit=5"
);

console.log(`\nRecent clock_in notifications in DB (${recent.length} shown):`);
for (const n of recent) {
  const recip = profiles.find((p) => p.id === n.recipient_id);
  console.log(`  - ${recip?.name || n.recipient_id}: "${n.message}" @ ${n.created_at}`);
}

const expected = leaders.filter((l) => l.id !== testEmployee.id).length;
if (inserts.length === expected) {
  console.log("\nPASS: Clock-in notifications saved to DB (mobile push uses same webhook as chat).");
  console.log("CEO/TL should get push on phone if fcm_token is set.\n");
} else {
  console.log(`\nPARTIAL: ${inserts.length}/${expected} inserts succeeded.\n`);
  process.exit(1);
}
