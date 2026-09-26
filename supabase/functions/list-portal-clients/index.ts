import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Main ERP (this function's project) — auto-injected by the Supabase platform.
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

// Client Portal (client-erp) — same secrets already used by
// sync-project-to-client-portal / manage-portal-settings.
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

/**
 * Same admin-check as manage-portal-settings — the default "valid JWT"
 * check alone would pass for the anon key too, which isn't sufficient here:
 * this lists every client's org/project, which no ordinary employee login
 * should be able to pull.
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
    .select("app_role, dept, name")
    .ilike("email", userData.user.email)
    .maybeSingle();

  const appRole = (profile?.app_role || "").toLowerCase();
  const isExecutive = profile?.dept === "Executive" || profile?.name === "CEO Admin";
  const isAdmin = appRole === "ceo" || appRole === "superadmin" || isExecutive;

  if (!isAdmin) return { ok: false, status: 403, message: "CEO/Superadmin only" };
  return { ok: true };
}

/** Same "pick the primary project" rule client-erp's own frontend uses: the active one, else the first. */
function pickPrimaryProject(projects: { id: string; name: string; status: string; created_at: string }[]) {
  if (projects.length === 0) return null;
  return projects.find(p => p.status === "active") ?? projects[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return json({ error: auth.message }, auth.status);

    const { data: orgs, error: orgsError } = await clientErp
      .from("organizations")
      .select("id, name")
      .order("name", { ascending: true });
    if (orgsError) throw orgsError;

    const { data: projects, error: projectsError } = await clientErp
      .from("projects")
      .select("id, name, status, organization_id, created_at")
      .order("created_at", { ascending: true });
    if (projectsError) throw projectsError;

    const projectsByOrg = new Map<string, typeof projects>();
    for (const p of projects ?? []) {
      const list = projectsByOrg.get(p.organization_id as string) ?? [];
      list.push(p);
      projectsByOrg.set(p.organization_id as string, list);
    }

    const clients = (orgs ?? []).map(org => {
      const primary = pickPrimaryProject((projectsByOrg.get(org.id as string) ?? []) as never);
      return {
        organizationId: org.id,
        organizationName: org.name,
        projectId: primary?.id ?? null,
        projectName: primary?.name ?? null,
      };
    });

    return json({ clients });
  } catch (error) {
    console.error("list-portal-clients error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
