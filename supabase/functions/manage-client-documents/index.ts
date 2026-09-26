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

const CATEGORIES = ["contracts", "invoices", "design", "reports", "meetings", "brand"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

/** Same admin-check as manage-portal-settings / list-portal-clients. */
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
        .from("documents")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ documents: data });
    }

    if (action === "create") {
      const projectId = payload.project_id;
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      const category = typeof payload.category === "string" ? payload.category : "";
      const fileUrl = typeof payload.file_url === "string" ? payload.file_url : null;
      if (!projectId) return json({ error: "project_id is required" }, 400);
      if (!name) return json({ error: "name is required" }, 400);
      if (!CATEGORIES.includes(category)) return json({ error: `category must be one of: ${CATEGORIES.join(", ")}` }, 400);

      const { data, error } = await clientErp
        .from("documents")
        .insert({
          project_id: projectId,
          name,
          category,
          file_url: fileUrl,
          file_type: typeof payload.file_type === "string" ? payload.file_type : null,
          file_size_bytes: typeof payload.file_size_bytes === "number" ? payload.file_size_bytes : null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return json({ document: data });
    }

    if (action === "update") {
      const id = payload.id;
      if (!id) return json({ error: "id is required" }, 400);
      const updates: Record<string, unknown> = {};
      if (typeof payload.name === "string" && payload.name.trim()) updates.name = payload.name.trim();
      if (typeof payload.category === "string") {
        if (!CATEGORIES.includes(payload.category)) return json({ error: `category must be one of: ${CATEGORIES.join(", ")}` }, 400);
        updates.category = payload.category;
      }
      if (Object.keys(updates).length === 0) return json({ error: "Nothing to update" }, 400);

      const { data, error } = await clientErp.from("documents").update(updates).eq("id", id).select("*").single();
      if (error) throw error;
      return json({ document: data });
    }

    if (action === "delete") {
      const id = payload.id;
      if (!id) return json({ error: "id is required" }, 400);
      const { error } = await clientErp.from("documents").delete().eq("id", id);
      if (error) throw error;
      return json({ deleted: true });
    }

    return json({ error: `Unknown action "${action}"` }, 400);
  } catch (error) {
    console.error("manage-client-documents error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
