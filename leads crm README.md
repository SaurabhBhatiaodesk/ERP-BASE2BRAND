
base url - https://landed-platypus-subtype.ngrok-free.dev

# ERP Read API — Lead Data Access

This is the integration guide for a third-party developer whose ERP backend
(running locally, on their own machine) needs to **read** lead data produced
by this CRM backend's lead-generating modules. It is completely independent
of this CRM's internal login system — you authenticate with a single API
key, not a username/password or JWT.

## Authentication

Send your key on every request as an HTTP header:

```
X-API-Key: erp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- The key is **read-only** and scoped. It can only call the endpoints listed
  below — any write/update/delete/trigger endpoint rejects it (`401`/`403`),
  even if you send it there.
- If your key is invalid, revoked, or missing where required, you get
  `401 Unauthorized`.
- If your key is valid but not scoped for a particular source, you get
  `403 Forbidden`.
- Ask the CRM admin for your key — it is only ever shown once, at creation
  time, and cannot be retrieved again if lost (a new one can always be
  issued).

## Base URL

All endpoints below live on one host/port — ask the CRM admin for the
actual address (e.g. `http://<server-ip>:8001` in the current deployment).
Everything in this doc is a path relative to that base URL.

## Endpoints

### 1. Unified read endpoint (recommended)

```
GET /api/v1/leads?source=all&limit=50&offset=0&search=<optional>
```

Merges leads from every module you have scope for into **one consistent
shape**, so you don't need to understand each module's native schema. This
is the easiest way to integrate.

Query parameters:
| Param    | Default | Notes |
|----------|---------|-------|
| `source` | `all`   | `all`, `leads_finder`, or `lead_engine` |
| `limit`  | `50`    | 1–200 |
| `offset` | `0`     | for paging |
| `search` | none    | case-insensitive match on name/company/email/website |

Response shape:
```json
{
  "items": [
    {
      "id": "8113e4d6-8155-4cfc-a7b1-0ac3a1cefc1d",
      "source": "lead_engine",
      "company_name": "Acme Corp",
      "contact_name": "Jane Doe",
      "email": "jane@acme.com",
      "phone": null,
      "website": "https://acme.com",
      "industry": "Manufacturing",
      "status": "proposal_generated",
      "created_at": "2026-09-07T12:39:34.70Z",
      "raw": { "...module-specific extra fields, see below..." }
    }
  ],
  "total_count": 185,
  "limit": 50,
  "offset": 0,
  "sources_included": ["leads_finder", "lead_engine"]
}
```

`raw` carries every field that module tracks natively but that doesn't map
onto the common shape above — use it if you need something more specific
(e.g. `raw.match_score`/`raw.priority` from Lead Engine, or
`raw.digital_health_score`/`raw.seo_score` from Leads Finder). See sections 2
and 3 below for each module's full native field list if you need everything.

**Pagination note:** results are merged from two independently-run
databases behind the scenes. `total_count` is always exact, but keep
`limit`/`offset` modest (limit is capped at 200) — this endpoint is meant for
normal reads, not bulk export.

### 2. Leads Finder — native read endpoint

```
GET /leads-finder/leads
```

Returns the *raw* Leads Finder record shape (used internally by the CRM's
own frontend) if you need every field Leads Finder tracks, rather than the
common shape above.

Response: a JSON array of lead objects. Key fields:
```json
{
  "_id": "97d02d6a-b7cc-4aee-a52b-394017edd0ee",
  "name": "Aniket Plumber Services",
  "address": "SCO 2935 - 36, Sector 22C, Sector 22, Chandigarh, 160022, India",
  "phone": null,
  "website": null,
  "rating": 0.0,
  "reviews_count": 0,
  "location": { "lat": 30.72, "lng": 76.76 },
  "business_type": "plumber",
  "city": "mohali",
  "digital_health_score": 0,
  "seo_score": 0,
  "social_score": 0,
  "review_score": 0,
  "gap_labels": ["No Website", "Low Rating"],
  "status": "New",
  "added_to_crm": false,
  "emails_sent": 0,
  "responses_received": 0,
  "email": null,
  "linkedin": null,
  "owner_name": null,
  "enrichment_status": "pending",
  "created_at": "2026-09-05T12:56:45.06Z",
  "notes": [],
  "website_intelligence": { "...SEO/performance/trust/conversion audit, see below..." },
  "competitor_analysis": { "..." },
  "sales_agent": { "..." }
}
```
`website_intelligence`, `competitor_analysis`, and `sales_agent` are rich
nested objects produced by Leads Finder's AI analysis pipeline — present
once that lead has been analyzed, `null` otherwise.

Requires scope `leads_finder:read`. This is the **only** Leads Finder
endpoint your key can reach — every other Leads Finder route (scan/create/
update/delete/proposal-generation/outreach/etc.) rejects it with `403`.

### 3. Lead Engine — native read endpoints

```
GET /lead-engine/companies?limit=20&offset=0&status=<optional>&search=<optional>
GET /lead-engine/companies/{company_id}
```

Returns the raw Lead Engine record shape (used internally by the CRM's own
frontend). One row per company, each field from n8n's discovery → contact
enrichment → business analysis → AI proposal pipeline:

```json
{
  "id": "8113e4d6-8155-4cfc-a7b1-0ac3a1cefc1d",
  "company_name": "Acme Corp",
  "company_url": "https://acme.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "title": "Founder & CEO",
  "email": "jane@acme.com",
  "organization_name": "Acme Corp Ltd.",
  "linkedin": "https://linkedin.com/in/janedoe",
  "domain": "acme.com",
  "industry": "Technology",
  "services": "[\"Cloud Solutions\", \"...\"]",
  "business_model": "B2B",
  "tech_stack": "[\"AWS\", \"...\"]",
  "pain_points": "{...}",
  "recommended_services": "[...]",
  "match_score": 92,
  "priority": "High",
  "match_reasoning": "...",
  "ai_proposal": { "subject": "...", "body": "...", "...": "..." },
  "status": "proposal_generated",
  "created_at": "2026-09-07T12:39:34.70Z",
  "updated_at": "2026-09-07T13:05:00.00Z"
}
```
Note: `services`, `tech_stack`, `pain_points`, and `recommended_services`
are JSON-encoded **strings** (not native JSON) — parse them client-side if
you need structured access; they're stored exactly as n8n produced them.

The list endpoint's response wraps `items` with pagination metadata:
```json
{ "items": [ /* company objects above */ ], "total_count": 185, "limit": 20, "offset": 0 }
```

Requires scope `lead_engine:read`. There is no write endpoint your key can
reach here at all — Lead Engine's trigger/callback endpoints
(`/lead-engine/runs/*`) require the CRM's own internal login and reject an
API key outright.

## Getting a key / losing a key

Only a CRM admin can issue or revoke keys. If your key stops working
unexpectedly, ask the admin to check whether it was revoked, and request a
replacement — a lost/leaked key should always be revoked and reissued, never
reused.

---

## For CRM admins: issuing / revoking a key

Two equivalent ways to mint a key — the plain-text key is shown **once**,
at creation, and only its SHA-256 hash is ever stored (`shared_api_keys`
table):

**Option A — CLI script** (works even before any admin has logged in):
```bash
docker compose exec backend python -m scripts.create_shared_api_key \
    --label "ERP Dev - Acme Corp" --scopes leads_finder:read lead_engine:read
```

**Option B — admin-only HTTP endpoint** (requires a SUPER_ADMIN/ORG_ADMIN
JWT, via the CRM's normal login at `POST /api/v1/auth/login`):
```bash
curl -X POST http://<host>:8001/api/v1/admin/api-keys \
    -H "Authorization: Bearer <admin JWT>" -H "Content-Type: application/json" \
    -d '{"label": "ERP Dev - Acme Corp", "allowed_scopes": ["leads_finder:read", "lead_engine:read"]}'
```

List issued keys (never returns a usable key, only metadata):
```
GET /api/v1/admin/api-keys        (JWT admin)
```

Revoke a key immediately (irreversible — issue a new one instead of trying
to un-revoke):
```
POST /api/v1/admin/api-keys/{key_id}/revoke   (JWT admin)
```

This whole system (`shared_api_keys` table, `X-API-Key` header check) is
**independent of AI Tender's own internal API keys** (used for org-scoped
access to AI Tender itself) — revoking one never affects the other.
