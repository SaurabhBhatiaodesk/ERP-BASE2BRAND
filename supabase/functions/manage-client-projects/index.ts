import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

const clientErpUrl = Deno.env.get("CLIENT_ERP_SUPABASE_URL")!;
const clientErpServiceKey = Deno.env.get("CLIENT_ERP_SERVICE_ROLE_KEY")!;
const clientErp = createClient(clientErpUrl, clientErpServiceKey);

const STATUSES = ["active", "completed", "planning"];
const MILESTONE_STATUSES = ["done", "active", "upcoming"];

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

    // ── Projects ──────────────────────────────────────────────────────────
    if (action === "list") {
      const organizationId = payload.organization_id;
      if (!organizationId) return json({ error: "organization_id is required" }, 400);
      const { data, error } = await clientErp
        .from("projects")
        .select("*")
        .eq("organization_id", organizationId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return json({ projects: data });
    }

    if (action === "create") {
      const organizationId = payload.organization_id;
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      if (!organizationId) return json({ error: "organization_id is required" }, 400);
      if (!name) return json({ error: "name is required" }, 400);
      const status = STATUSES.includes(payload.status) ? payload.status : "planning";

      const { data, error } = await clientErp
        .from("projects")
        .insert({
          organization_id: organizationId,
          name,
          category: typeof payload.category === "string" ? payload.category : null,
          status,
          description: typeof payload.description === "string" ? payload.description : null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return json({ project: data });
    }

    if (action === "update") {
      const id = payload.id;
      if (!id) return json({ error: "id is required" }, 400);
      const updates: Record<string, unknown> = {};
      if (typeof payload.name === "string" && payload.name.trim()) updates.name = payload.name.trim();
      if (payload.category !== undefined) updates.category = payload.category;
      if (payload.status !== undefined) {
        if (!STATUSES.includes(payload.status)) return json({ error: `status must be one of: ${STATUSES.join(", ")}` }, 400);
        updates.status = payload.status;
      }
      if (payload.progress_pct !== undefined) {
        const pct = Number(payload.progress_pct);
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) return json({ error: "progress_pct must be between 0 and 100" }, 400);
        updates.progress_pct = pct;
      }
      if (payload.budget_total !== undefined) updates.budget_total = payload.budget_total === null ? null : Number(payload.budget_total);
      if (payload.budget_used !== undefined) updates.budget_used = Number(payload.budget_used) || 0;
      if (payload.start_date !== undefined) updates.start_date = payload.start_date;
      if (payload.launch_date !== undefined) updates.launch_date = payload.launch_date;
      if (payload.description !== undefined) updates.description = payload.description;
      updates.updated_at = new Date().toISOString();
      if (Object.keys(updates).length === 1) return json({ error: "Nothing to update" }, 400);

      const { data, error } = await clientErp.from("projects").update(updates).eq("id", id).select("*").single();
      if (error) throw error;
      return json({ project: data });
    }

    if (action === "delete") {
      const id = payload.id;
      if (!id) return json({ error: "id is required" }, 400);
      const { error } = await clientErp.from("projects").delete().eq("id", id);
      if (error) throw error;
      return json({ deleted: true });
    }

    // ── Milestones ────────────────────────────────────────────────────────
    if (action === "list_milestones") {
      const projectId = payload.project_id;
      if (!projectId) return json({ error: "project_id is required" }, 400);
      const { data, error } = await clientErp
        .from("milestones")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return json({ milestones: data });
    }

    if (action === "create_milestone") {
      const projectId = payload.project_id;
      const label = typeof payload.label === "string" ? payload.label.trim() : "";
      if (!projectId) return json({ error: "project_id is required" }, 400);
      if (!label) return json({ error: "label is required" }, 400);
      const status = MILESTONE_STATUSES.includes(payload.status) ? payload.status : "upcoming";

      const { count } = await clientErp
        .from("milestones")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);

      const { data, error } = await clientErp
        .from("milestones")
        .insert({ project_id: projectId, label, status, sort_order: count ?? 0 })
        .select("*")
        .single();
      if (error) throw error;
      return json({ milestone: data });
    }

    if (action === "update_milestone") {
      const id = payload.id;
      if (!id) return json({ error: "id is required" }, 400);
      const updates: Record<string, unknown> = {};
      if (typeof payload.label === "string" && payload.label.trim()) updates.label = payload.label.trim();
      if (payload.status !== undefined) {
        if (!MILESTONE_STATUSES.includes(payload.status)) return json({ error: `status must be one of: ${MILESTONE_STATUSES.join(", ")}` }, 400);
        updates.status = payload.status;
      }
      if (Object.keys(updates).length === 0) return json({ error: "Nothing to update" }, 400);

      const { data, error } = await clientErp.from("milestones").update(updates).eq("id", id).select("*").single();
      if (error) throw error;
      return json({ milestone: data });
    }

    if (action === "delete_milestone") {
      const id = payload.id;
      if (!id) return json({ error: "id is required" }, 400);
      const { error } = await clientErp.from("milestones").delete().eq("id", id);
      if (error) throw error;
      return json({ deleted: true });
    }

    return json({ error: `Unknown action "${action}"` }, 400);
  } catch (error) {
    console.error("manage-client-projects error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
