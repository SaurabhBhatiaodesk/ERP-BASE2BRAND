import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

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
async function requireAdmin(req: Request): Promise<{ ok: true; profile: { name: string | null } } | { ok: false; status: number; message: string }> {
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
  return { ok: true, profile: { name: profile?.name ?? null } };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return json({ error: auth.message }, auth.status);

    const payload = await req.json().catch(() => ({}));
    const action = payload.action;

    if (action === "list") {
      const projectId = payload.project_id;
      if (!projectId) return json({ error: "project_id is required" }, 400);
      const { data, error } = await clientErp
        .from("activity_log")
        .select("*, people(full_name)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return json({ activity: data });
    }

    if (action === "create") {
      const projectId = payload.project_id;
      const description = typeof payload.description === "string" ? payload.description.trim() : "";
      const actionType = typeof payload.action_type === "string" && payload.action_type.trim() ? payload.action_type.trim() : "update";
      if (!projectId) return json({ error: "project_id is required" }, 400);
      if (!description) return json({ error: "description is required" }, 400);

      const { data, error } = await clientErp
        .from("activity_log")
        .insert({ project_id: projectId, action_type: actionType, description })
        .select("*")
        .single();
      if (error) throw error;
      return json({ entry: data });
    }

    if (action === "delete") {
      const id = payload.id;
      if (!id) return json({ error: "id is required" }, 400);
      const { error } = await clientErp.from("activity_log").delete().eq("id", id);
      if (error) throw error;
      return json({ deleted: true });
    }

    return json({ error: `Unknown action "${action}"` }, 400);
  } catch (error) {
    console.error("manage-client-activity error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
