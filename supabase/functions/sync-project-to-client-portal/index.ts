import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Main ERP (source) — auto-injected by the Supabase platform for the project
// this function is deployed to.
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Client Portal (destination) — set via:
//   supabase secrets set CLIENT_ERP_SUPABASE_URL=... CLIENT_ERP_SERVICE_ROLE_KEY=...
// on the MAIN ERP project (this function's project), not client-erp's own.
const clientErpUrl = Deno.env.get("CLIENT_ERP_SUPABASE_URL")!;
const clientErpServiceKey = Deno.env.get("CLIENT_ERP_SERVICE_ROLE_KEY")!;
const clientErp = createClient(clientErpUrl, clientErpServiceKey);

type DbTimelinePhase = { phase: string; start: number; width: number; color: string };

type DbProject = {
  id: string;
  name: string;
  client: string;
  dept: string | null;
  status: string;
  progress: number;
  start_date: string | null;
  deadline: string | null;
  budget: string | null;
  spent: string | null;
  description: string | null;
  timeline: DbTimelinePhase[] | null;
};

/**
 * Main ERP stores start_date/deadline as free text with no year (e.g. "May 1",
 * "Jun 30") — not valid for client-erp's `date` columns as-is. Best-effort
 * parse assuming the current year (these are near-term dates for active
 * projects, so this is right in the common case); anything unparseable
 * becomes null rather than a guess that could silently insert a wrong date.
 *
 * A yearless string like "May 1" is NOT a spec-compliant Date Time String
 * (that requires ISO 8601), so JS engines fall back to legacy/implementation-
 * specific parsing — V8 defaults a bare "Month Day" string to the year 2001,
 * not "now". Appending the current year explicitly avoids that trap.
 */
function parseLenientDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const withYear = /\b\d{4}\b/.test(trimmed) ? trimmed : `${trimmed} ${new Date().getFullYear()}`;
  const parsed = new Date(withYear);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/** Live `leads.contact` data is often actually a phone number, not a name (a data-quality issue in the source table) — don't use it as a person's display name when it looks like one. */
function looksLikePhoneNumber(value: string): boolean {
  return /^[\d\s+()-]+$/.test(value.trim());
}

/** Main ERP stores budget/spent as formatted currency strings (e.g. "₹50,000") — strip everything but digits/decimal. */
function parseCurrency(value: string | null | undefined): number | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/** Main ERP's project status is free text (e.g. "In Progress", "Planning") — map it onto client-erp's 3-value enum. */
function mapStatus(status: string): "active" | "completed" | "planning" {
  const s = (status || "").toLowerCase();
  if (s.includes("complete") || s.includes("done")) return "completed";
  if (s.includes("plan")) return "planning";
  return "active";
}

/**
 * Main ERP's `timeline` is a Gantt bar per phase ({ phase, start, width, color }),
 * not a checklist with a done/active/upcoming status — there's nothing to copy,
 * so status is inferred from where the bar falls relative to overall progress.
 */
function milestoneStatus(phase: DbTimelinePhase, progressPct: number): "done" | "active" | "upcoming" {
  const end = phase.start + phase.width;
  if (end <= progressPct) return "done";
  if (phase.start <= progressPct && progressPct < end) return "active";
  return "upcoming";
}

function initialsFromName(name: string): string {
  return name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record as DbProject | undefined;
    if (!record?.id || !record.client?.trim()) {
      return new Response(JSON.stringify({ skipped: "No project record or client name in payload" }), { status: 200 });
    }

    // 1. Find a confident, unambiguous client contact match. `projects.client`
    // is free text with no foreign key anywhere — an unrecognized or ambiguous
    // name simply doesn't sync, rather than guessing which client it means.
    const { data: leads, error: leadsError } = await supabase.from("leads").select("id, name, email, contact");
    if (leadsError) throw leadsError;

    const clientNameLower = record.client.trim().toLowerCase();
    const candidates = (leads ?? []).filter(
      l => l.email && (l.name as string)?.trim().toLowerCase() === clientNameLower
    );
    if (candidates.length !== 1) {
      return new Response(
        JSON.stringify({
          skipped: `No confident lead match for client "${record.client}" (${candidates.length} candidate(s) with an email on file)`,
        }),
        { status: 200 }
      );
    }
    const lead = candidates[0] as { id: number; name: string; email: string; contact: string | null };
    const sourceLeadId = String(lead.id);

    // 2. Upsert the client organization, keyed by the lead id so the same
    // client always maps to the same org across multiple projects/re-syncs.
    const { data: org, error: orgError } = await clientErp
      .from("organizations")
      .upsert({ source_lead_id: sourceLeadId, name: lead.name }, { onConflict: "source_lead_id" })
      .select("id")
      .single();
    if (orgError) throw orgError;
    const organizationId = org.id as string;

    // 3. Ensure a client contact (people row + invited auth user) exists,
    // and keep the display name current on every re-sync (the source lead's
    // contact name can be corrected later even if the person row already exists).
    const rawContact = lead.contact?.trim();
    const contactName = rawContact && !looksLikePhoneNumber(rawContact) ? rawContact : lead.name;

    const { data: existingPerson } = await clientErp
      .from("people")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", lead.email)
      .maybeSingle();

    if (existingPerson) {
      const { error: updateError } = await clientErp
        .from("people")
        .update({ full_name: contactName, initials: initialsFromName(contactName) })
        .eq("id", existingPerson.id);
      if (updateError) throw updateError;
    } else {
      let authUserId: string | null = null;
      const { data: invited, error: inviteError } = await clientErp.auth.admin.inviteUserByEmail(lead.email);
      if (inviteError && !inviteError.message?.toLowerCase().includes("already")) {
        throw inviteError;
      }
      authUserId = invited?.user?.id ?? null;

      if (!authUserId) {
        // Already-registered case — invite doesn't return the existing user, so look it up.
        const { data: usersPage } = await clientErp.auth.admin.listUsers({ perPage: 1000 });
        authUserId = usersPage?.users.find(u => u.email?.toLowerCase() === lead.email.toLowerCase())?.id ?? null;
      }

      const { error: personError } = await clientErp.from("people").insert({
        kind: "client",
        organization_id: organizationId,
        auth_user_id: authUserId,
        full_name: contactName,
        email: lead.email,
        initials: initialsFromName(contactName),
        role: "Client Admin",
      });
      if (personError) throw personError;
    }

    // 4. Upsert the project. Health scores, AI summaries, and tasks aren't
    // touched — the main ERP has no equivalent data for any of these.
    const progressPct = Math.max(0, Math.min(100, Number(record.progress) || 0));
    const { data: project, error: projectError } = await clientErp
      .from("projects")
      .upsert(
        {
          source_project_id: record.id,
          organization_id: organizationId,
          name: record.name,
          category: record.dept || null,
          status: mapStatus(record.status),
          progress_pct: progressPct,
          budget_total: parseCurrency(record.budget),
          budget_used: parseCurrency(record.spent) ?? 0,
          start_date: parseLenientDate(record.start_date),
          launch_date: parseLenientDate(record.deadline),
          description: record.description || null,
        },
        { onConflict: "source_project_id" }
      )
      .select("id")
      .single();
    if (projectError) throw projectError;
    const projectId = project.id as string;

    // 5. Replace milestones from the current timeline snapshot.
    const { error: deleteMilestonesError } = await clientErp.from("milestones").delete().eq("project_id", projectId);
    if (deleteMilestonesError) throw deleteMilestonesError;

    const timeline = Array.isArray(record.timeline) ? record.timeline : [];
    if (timeline.length > 0) {
      const milestoneRows = timeline.map((phase, i) => ({
        project_id: projectId,
        label: phase.phase,
        status: milestoneStatus(phase, progressPct),
        sort_order: i,
      }));
      const { error: milestonesError } = await clientErp.from("milestones").insert(milestoneRows);
      if (milestonesError) throw milestonesError;
    }

    return new Response(
      JSON.stringify({ synced: true, organizationId, projectId, matchedLead: lead.email }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("sync-project-to-client-portal error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500 });
  }
});
