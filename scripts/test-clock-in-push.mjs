/**
 * Test mobile FCM push for clock-in via send-push edge function.
 * Run: node scripts/test-clock-in-push.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env"), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const base = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

async function rest(path, opts = {}) {
  const res = await fetch(`${base}/rest/v1/${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(json)}`);
  return json;
}

// CEO profile with mobile token
const profiles = await rest(
  "employee_profiles?select=id,name,fcm_token,app_role&app_role=eq.ceo&limit=1"
);
const ceo = profiles[0];
if (!ceo?.fcm_token) {
  console.error("CEO has no mobile fcm_token — login on mobile app first.");
  process.exit(1);
}

console.log(`CEO: ${ceo.name} | mobile FCM: yes`);

const timeLabel = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const row = await rest("notifications", {
  method: "POST",
  headers: { Prefer: "return=representation" },
  body: JSON.stringify({
    recipient_id: ceo.id,
    sender_id: ceo.id,
    title: "Clock-in",
    message: `Test Employee clocked in at ${timeLabel}.`,
    type: "clock_in",
    reference_id: `push-test-${Date.now()}`,
  }),
});
const record = Array.isArray(row) ? row[0] : row;
console.log("Notification inserted:", record.id);

const pushRes = await fetch(`${base}/functions/v1/send-push`, {
  method: "POST",
  headers,
  body: JSON.stringify({ record }),
});
const pushBody = await pushRes.text();
console.log(`send-push status: ${pushRes.status}`);
console.log("send-push response:", pushBody);

if (pushRes.ok) {
  console.log("\nPASS — Check CEO mobile for push notification now.");
} else {
  console.log("\nFAIL — send-push edge function error (deploy send-push if missing).");
  process.exit(1);
}
