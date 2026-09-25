import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Main ERP (this function's project) — auto-injected by the Supabase platform.
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

// Client Portal (client-erp) — same secrets already used by
// sync-project-to-client-portal, set via:
//   supabase secrets set CLIENT_ERP_SUPABASE_URL=... CLIENT_ERP_SERVICE_ROLE_KEY=...
const clientErpUrl = Deno.env.get("CLIENT_ERP_SUPABASE_URL")!;
const clientErpServiceKey = Deno.env.get("CLIENT_ERP_SERVICE_ROLE_KEY")!;
const clientErp = createClient(clientErpUrl, clientErpServiceKey);

const KNOWN_MODULES = [
  "analytics", "projects", "deliverables", "activity", "documents",
  "meetings", "team", "support", "invoices", "knowledge", "ai", "notifications",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

/**
 * The default "a valid Supabase JWT was presented" check that Edge Functions
 * do automatically is satisfied by the anon key alone — it does NOT prove a
 * real signed-in CEO/Superadmin is calling. This settings endpoint controls
 * what every client sees, so it explicitly resolves the caller's own user
 * from their bearer token, then checks THEIR employee_profiles.app_role.
 */
async function requireAdmin(req: Request): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401, message: "Missing Authorization header" };

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user?.email) {
    return { ok: false, status: 401, message: "Not signed in" };
  }

  const { data: profile } = await supabaseService
    .from("employee_profiles")
    .select("app_role, dept, name, role")
    .ilike("email", userData.user.email)
    .maybeSingle();

  const appRole = (profile?.app_role || "").toLowerCase();
  const isExecutive = profile?.dept === "Executive" || profile?.name === "CEO Admin";
  const isAdmin = appRole === "ceo" || appRole === "superadmin" || isExecutive;

  if (!isAdmin) return { ok: false, status: 403, message: "CEO/Superadmin only" };
  return { ok: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return json({ error: auth.message }, auth.status);

    const payload = await req.json().catch(() => ({}));
    const action = payload.action;

    if (action === "get") {
      const { data, error } = await clientErp
        .from("portal_settings")
        .select("*")
        .eq("id", "global")
        .maybeSingle();
      if (error) throw error;
      return json({ settings: data });
    }

    if (action === "update") {
      const visibleModules = Array.isArray(payload.visible_modules)
        ? payload.visible_modules.filter((m: unknown) => typeof m === "string" && KNOWN_MODULES.includes(m))
        : null;
      const showFinancials = typeof payload.show_financials === "boolean" ? payload.show_financials : null;

      if (!visibleModules) return json({ error: "visible_modules must be an array of known module ids" }, 400);
      if (showFinancials === null) return json({ error: "show_financials must be a boolean" }, 400);

      const { data, error } = await clientErp
        .from("portal_settings")
        .upsert(
          { id: "global", visible_modules: visibleModules, show_financials: showFinancials, updated_at: new Date().toISOString() },
          { onConflict: "id" }
        )
        .select("*")
        .single();
      if (error) throw error;
      return json({ settings: data });
    }

    return json({ error: `Unknown action "${action}"` }, 400);
  } catch (error) {
    console.error("manage-portal-settings error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
