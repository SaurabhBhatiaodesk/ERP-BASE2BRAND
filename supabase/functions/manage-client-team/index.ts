import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Main ERP (this function's project) — auto-injected by the Supabase platform.
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

// Client Portal (client-erp) — same secrets already used by the other
// manage-client-* / list-portal-clients functions.
const clientErpUrl = Deno.env.get("CLIENT_ERP_SUPABASE_URL")!;
const clientErpServiceKey = Deno.env.get("CLIENT_ERP_SERVICE_ROLE_KEY")!;
const clientErp = createClient(clientErpUrl, clientErpServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

/** Same admin-check as every other manage-client-* function. */
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
    .select("app_role, dept, name")
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

    // Every staff directory entry (kind='team') plus which ones are already
    // assigned to this project — the picker needs both in one round trip.
    if (action === "list") {
      const projectId = payload.project_id;
      if (!projectId) return json({ error: "project_id is required" }, 400);

      const { data: staff, error: staffError } = await clientErp
        .from("people")
        .select("id, full_name, initials, role, specialty")
        .eq("kind", "team")
        .order("full_name", { ascending: true });
      if (staffError) throw staffError;

      const { data: assigned, error: assignedError } = await clientErp
        .from("project_team_members")
        .select("person_id")
        .eq("project_id", projectId);
      if (assignedError) throw assignedError;

      return json({ staff, assignedPersonIds: (assigned ?? []).map(r => r.person_id) });
    }

    if (action === "assign") {
      const projectId = payload.project_id;
      const personId = payload.person_id;
      if (!projectId || !personId) return json({ error: "project_id and person_id are required" }, 400);
      const { error } = await clientErp
        .from("project_team_members")
        .upsert({ project_id: projectId, person_id: personId }, { onConflict: "project_id,person_id" });
      if (error) throw error;
      return json({ assigned: true });
    }

    if (action === "unassign") {
      const projectId = payload.project_id;
      const personId = payload.person_id;
      if (!projectId || !personId) return json({ error: "project_id and person_id are required" }, 400);
      const { error } = await clientErp
        .from("project_team_members")
        .delete()
        .eq("project_id", projectId)
        .eq("person_id", personId);
      if (error) throw error;
      return json({ unassigned: true });
    }

    return json({ error: `Unknown action "${action}"` }, 400);
  } catch (error) {
    console.error("manage-client-team error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
