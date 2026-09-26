import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

const clientErpUrl = Deno.env.get("CLIENT_ERP_SUPABASE_URL")!;
const clientErpServiceKey = Deno.env.get("CLIENT_ERP_SERVICE_ROLE_KEY")!;
const clientErp = createClient(clientErpUrl, clientErpServiceKey);

const TYPES = ["Design", "Development", "Report", "Document"];
const STATUSES = ["pending", "review", "approved", "changes"];

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

    if (action === "list") {
      const projectId = payload.project_id;
      if (!projectId) return json({ error: "project_id is required" }, 400);
      const { data, error } = await clientErp
        .from("deliverables")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ deliverables: data });
    }

    if (action === "create") {
      const projectId = payload.project_id;
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      if (!projectId) return json({ error: "project_id is required" }, 400);
      if (!name) return json({ error: "name is required" }, 400);
      if (payload.type && !TYPES.includes(payload.type)) return json({ error: `type must be one of: ${TYPES.join(", ")}` }, 400);
      const status = STATUSES.includes(payload.status) ? payload.status : "pending";

      const { data, error } = await clientErp
        .from("deliverables")
        .insert({
          project_id: projectId,
          name,
          type: payload.type ?? null,
          status,
          current_version: typeof payload.current_version === "string" ? payload.current_version : null,
          file_url: typeof payload.file_url === "string" ? payload.file_url : null,
          preview_url: typeof payload.preview_url === "string" ? payload.preview_url : null,
          file_size_bytes: typeof payload.file_size_bytes === "number" ? payload.file_size_bytes : null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return json({ deliverable: data });
    }

    if (action === "update") {
      const id = payload.id;
      if (!id) return json({ error: "id is required" }, 400);
      const updates: Record<string, unknown> = {};
      if (typeof payload.name === "string" && payload.name.trim()) updates.name = payload.name.trim();
      if (payload.type !== undefined) {
        if (payload.type !== null && !TYPES.includes(payload.type)) return json({ error: `type must be one of: ${TYPES.join(", ")}` }, 400);
        updates.type = payload.type;
      }
      if (payload.status !== undefined) {
        if (!STATUSES.includes(payload.status)) return json({ error: `status must be one of: ${STATUSES.join(", ")}` }, 400);
        updates.status = payload.status;
      }
      if (typeof payload.current_version === "string") updates.current_version = payload.current_version;
      updates.updated_at = new Date().toISOString();
      if (Object.keys(updates).length === 1) return json({ error: "Nothing to update" }, 400);

      const { data, error } = await clientErp.from("deliverables").update(updates).eq("id", id).select("*").single();
      if (error) throw error;
      return json({ deliverable: data });
    }

    if (action === "delete") {
      const id = payload.id;
      if (!id) return json({ error: "id is required" }, 400);
      const { error } = await clientErp.from("deliverables").delete().eq("id", id);
      if (error) throw error;
      return json({ deleted: true });
    }

    return json({ error: `Unknown action "${action}"` }, 400);
  } catch (error) {
    console.error("manage-client-deliverables error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
