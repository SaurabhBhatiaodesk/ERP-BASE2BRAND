/**
 * Read-only client for the third-party leads CRM ("leads crm README.md"). Auth
 * is a single `X-API-Key` header — no session/JWT — scoped to read-only
 * endpoints on their side; nothing here can write/update/delete anything.
 */

export type ExternalLeadSource = "leads_finder" | "lead_engine";

export type ExternalLead = {
  id: string;
  source: ExternalLeadSource;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  status: string | null;
  createdAt: string;
  raw: Record<string, unknown>;
};

export type FetchExternalLeadsResult = {
  items: ExternalLead[];
  totalCount: number;
  limit: number;
  offset: number;
  sourcesIncluded: ExternalLeadSource[];
};

type RawUnifiedLead = {
  id: string;
  source: ExternalLeadSource;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  status: string | null;
  created_at: string;
  raw: Record<string, unknown>;
};

type RawUnifiedResponse = {
  items: RawUnifiedLead[];
  total_count: number;
  limit: number;
  offset: number;
  sources_included: ExternalLeadSource[];
};

export function isLeadsCrmConfigured() {
  return Boolean(import.meta.env.VITE_LEADS_CRM_BASE_URL && import.meta.env.VITE_LEADS_CRM_API_KEY);
}

/**
 * The leads CRM's server doesn't send CORS headers for this app's origin, so
 * a renderer-side fetch() gets blocked ("Failed to fetch" despite a real 200
 * response). When running inside Electron, route the request through the
 * main process instead (electron/main.ts's 'fetch-leads-crm' handler) — a
 * plain Node request there isn't subject to browser CORS at all. Falls back
 * to a direct fetch when not in Electron (e.g. `npm run dev` in a browser),
 * which will only succeed once/if their server allows this origin.
 */
async function requestJson(url: string, apiKey: string): Promise<{ ok: boolean; status: number; bodyText: string }> {
  const electronApi = (window as unknown as { electronAPI?: { fetchLeadsCrm?: (url: string, apiKey: string) => Promise<{ ok: boolean; status: number; body: string; error?: string }> } }).electronAPI;
  if (electronApi?.fetchLeadsCrm) {
    const result = await electronApi.fetchLeadsCrm(url, apiKey);
    if (result.error) throw new Error(`Leads CRM request failed: ${result.error}`);
    return { ok: result.ok, status: result.status, bodyText: result.body };
  }

  const res = await fetch(url, { headers: { "X-API-Key": apiKey } });
  return { ok: res.ok, status: res.status, bodyText: await res.text() };
}

function mapUnifiedLead(row: RawUnifiedLead): ExternalLead {
  return {
    id: row.id,
    source: row.source,
    companyName: row.company_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    website: row.website,
    industry: row.industry,
    status: row.status,
    createdAt: row.created_at,
    raw: row.raw ?? {},
  };
}

/**
 * `GET /api/v1/leads` — the unified, recommended endpoint (merges every
 * source you have scope for into one consistent shape). `limit` is capped at
 * 200 by the API itself.
 */
export async function fetchExternalLeads(options?: {
  source?: "all" | ExternalLeadSource;
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<FetchExternalLeadsResult> {
  const baseUrl = import.meta.env.VITE_LEADS_CRM_BASE_URL as string | undefined;
  const apiKey = import.meta.env.VITE_LEADS_CRM_API_KEY as string | undefined;
  if (!baseUrl || !apiKey) {
    throw new Error("Leads CRM not configured. Add VITE_LEADS_CRM_BASE_URL and VITE_LEADS_CRM_API_KEY to .env");
  }

  const params = new URLSearchParams();
  params.set("source", options?.source || "all");
  params.set("limit", String(options?.limit ?? 50));
  params.set("offset", String(options?.offset ?? 0));
  if (options?.search?.trim()) params.set("search", options.search.trim());

  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/leads?${params.toString()}`;
  const { status, ok, bodyText } = await requestJson(url, apiKey);

  if (status === 401) throw new Error("Leads CRM: API key is invalid or missing.");
  if (status === 403) throw new Error("Leads CRM: API key is not scoped for this source.");
  if (!ok) throw new Error(`Leads CRM request failed (${status}).`);

  const data = JSON.parse(bodyText) as RawUnifiedResponse;
  return {
    items: (data.items ?? []).map(mapUnifiedLead),
    totalCount: data.total_count,
    limit: data.limit,
    offset: data.offset,
    sourcesIncluded: data.sources_included ?? [],
  };
}
