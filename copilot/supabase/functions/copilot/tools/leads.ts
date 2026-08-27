// Supabase Edge Function - Lead Tools
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function searchLeads(
  client: any,
  orgId: string,
  args: {
    query?: string;
    status?: string;
    assigned_to?: string;
    stale_days?: number;
    limit?: number;
    sort_by?: "deal_value" | "last_contacted_at" | "created_at";
  }
) {
  const limit = Math.min(args.limit || 10, 25);
  let query = client
    .from("leads")
    .select("id, name, email, phone, company, status, deal_value, source, assigned_to, last_contacted_at, created_at")
    .eq("organization_id", orgId)
    .limit(limit);

  if (args.status) {
    query = query.eq("status", args.status);
  }
  if (args.assigned_to) {
    query = query.eq("assigned_to", args.assigned_to);
  }
  if (args.stale_days && args.stale_days > 0) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - args.stale_days);
    query = query.lt("last_contacted_at", thresholdDate.toISOString());
  }
  if (args.query) {
    query = query.or(`name.ilike.%${args.query}%,company.ilike.%${args.query}%,email.ilike.%${args.query}%`);
  }

  if (args.sort_by === "deal_value") {
    query = query.order("deal_value", { ascending: false });
  } else if (args.sort_by === "last_contacted_at") {
    query = query.order("last_contacted_at", { ascending: true, nullsFirst: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to search leads: ${error.message}`);
  return data;
}

export async function getLead(client: any, orgId: string, leadIdOrName: string) {
  let query = client
    .from("leads")
    .select("id, name, email, phone, company, status, deal_value, source, assigned_to, last_contacted_at, notes_count, created_at")
    .eq("organization_id", orgId);

  // Check if uuid
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadIdOrName);
  if (isUuid) {
    query = query.eq("id", leadIdOrName);
  } else {
    query = query.ilike("name", `%${leadIdOrName}%`).limit(1);
  }

  const { data, error } = await query.single();
  if (error || !data) throw new Error(`Lead "${leadIdOrName}" not found`);
  return data;
}

export async function getLeadActivity(client: any, orgId: string, leadId: string, limit = 10) {
  const { data, error } = await client
    .from("activities")
    .select("id, activity_type, summary, details, duration_minutes, created_at, performed_by")
    .eq("organization_id", orgId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch lead activities: ${error.message}`);
  return data;
}

export async function getLeadNotes(client: any, orgId: string, leadId: string) {
  const { data, error } = await client
    .from("notes")
    .select("id, content, is_pinned, created_at, author_id")
    .eq("organization_id", orgId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch notes: ${error.message}`);
  return data;
}
