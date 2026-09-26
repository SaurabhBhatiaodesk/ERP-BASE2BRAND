import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

const clientErpUrl = Deno.env.get("CLIENT_ERP_SUPABASE_URL")!;
const clientErpServiceKey = Deno.env.get("CLIENT_ERP_SERVICE_ROLE_KEY")!;
const clientErp = createClient(clientErpUrl, clientErpServiceKey);

const STATUSES = ["paid", "pending", "overdue"];

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
        .from("invoices")
        .select("*")
        .eq("project_id", projectId)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return json({ invoices: data });
    }

    if (action === "create") {
      const projectId = payload.project_id;
      const invoiceNumber = typeof payload.invoice_number === "string" ? payload.invoice_number.trim() : "";
      const amount = Number(payload.amount);
      if (!projectId) return json({ error: "project_id is required" }, 400);
      if (!invoiceNumber) return json({ error: "invoice_number is required" }, 400);
      if (!Number.isFinite(amount) || amount <= 0) return json({ error: "amount must be a positive number" }, 400);
      if (!payload.issue_date || !payload.due_date) return json({ error: "issue_date and due_date are required" }, 400);
      const status = STATUSES.includes(payload.status) ? payload.status : "pending";

      const { data, error } = await clientErp
        .from("invoices")
        .insert({
          project_id: projectId,
          invoice_number: invoiceNumber,
          description: typeof payload.description === "string" ? payload.description : null,
          amount,
          paid_amount: Number.isFinite(Number(payload.paid_amount)) ? Number(payload.paid_amount) : 0,
          issue_date: payload.issue_date,
          due_date: payload.due_date,
          status,
        })
        .select("*")
        .single();
      if (error) throw error;
      return json({ invoice: data });
    }

    if (action === "update") {
      const id = payload.id;
      if (!id) return json({ error: "id is required" }, 400);
      const updates: Record<string, unknown> = {};
      if (typeof payload.description === "string") updates.description = payload.description;
      if (payload.amount !== undefined) {
        const amount = Number(payload.amount);
        if (!Number.isFinite(amount) || amount <= 0) return json({ error: "amount must be a positive number" }, 400);
        updates.amount = amount;
      }
      if (payload.paid_amount !== undefined) {
        const paidAmount = Number(payload.paid_amount);
        if (!Number.isFinite(paidAmount) || paidAmount < 0) return json({ error: "paid_amount must be zero or a positive number" }, 400);
        updates.paid_amount = paidAmount;
      }
      if (payload.status !== undefined) {
        if (!STATUSES.includes(payload.status)) return json({ error: `status must be one of: ${STATUSES.join(", ")}` }, 400);
        updates.status = payload.status;
      }
      if (typeof payload.due_date === "string") updates.due_date = payload.due_date;
      updates.updated_at = new Date().toISOString();
      if (Object.keys(updates).length === 1) return json({ error: "Nothing to update" }, 400);

      const { data, error } = await clientErp.from("invoices").update(updates).eq("id", id).select("*").single();
      if (error) throw error;
      return json({ invoice: data });
    }

    if (action === "delete") {
      const id = payload.id;
      if (!id) return json({ error: "id is required" }, 400);
      const { error } = await clientErp.from("invoices").delete().eq("id", id);
      if (error) throw error;
      return json({ deleted: true });
    }

    return json({ error: `Unknown action "${action}"` }, 400);
  } catch (error) {
    console.error("manage-client-invoices error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
