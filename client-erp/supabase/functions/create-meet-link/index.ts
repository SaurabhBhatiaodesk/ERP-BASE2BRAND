import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Auto-injected by the Supabase platform for the project this function is deployed to.
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Google service account with domain-wide delegation, impersonating a real
// Workspace user (the Meet API needs a real human account behind the space —
// see supabase secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
// / GOOGLE_IMPERSONATE_USER on the CLIENT-ERP project.
const googleServiceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")!;
const googlePrivateKeyPem = (Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");
const googleImpersonateUser = Deno.env.get("GOOGLE_IMPERSONATE_USER")!;

const MEET_SCOPE = "https://www.googleapis.com/auth/meetings.space.created";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** JWT-bearer flow for a Google service account, impersonating a Workspace user via domain-wide delegation. */
async function getGoogleAccessToken(): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: googleServiceAccountEmail,
    scope: MEET_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
    sub: googleImpersonateUser,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  const pemContents = googlePrivateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64url(new Uint8Array(signature))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token exchange failed: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

async function createMeetSpace(): Promise<string> {
  const accessToken = await getGoogleAccessToken();
  const res = await fetch("https://meet.googleapis.com/v2/spaces", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: "{}",
  });
  const space = await res.json();
  if (!res.ok) throw new Error(`Google Meet API error: ${JSON.stringify(space)}`);
  return space.meetingUri as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: corsHeaders });

    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: corsHeaders });
    }

    const { data: person, error: personErr } = await supabase
      .from("people")
      .select("kind, organization_id")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();
    if (personErr) throw personErr;
    if (!person) return new Response(JSON.stringify({ error: "No matching person record" }), { status: 403, headers: corsHeaders });

    const isAdmin = person.kind === "admin";
    const body = await req.json();
    const mode = body.mode as "scheduled" | "instant";

    if (mode === "scheduled") {
      const meetingId = body.meetingId as string | undefined;
      if (!meetingId) return new Response(JSON.stringify({ error: "meetingId is required" }), { status: 400, headers: corsHeaders });

      const { data: meeting, error: meetingErr } = await supabase
        .from("meetings")
        .select("id, meet_link, projects(organization_id)")
        .eq("id", meetingId)
        .maybeSingle();
      if (meetingErr) throw meetingErr;
      if (!meeting) return new Response(JSON.stringify({ error: "Meeting not found" }), { status: 404, headers: corsHeaders });

      const projectOrgId = (meeting.projects as unknown as { organization_id: string } | null)?.organization_id;
      if (!isAdmin && projectOrgId !== person.organization_id) {
        return new Response(JSON.stringify({ error: "Not authorized for this meeting" }), { status: 403, headers: corsHeaders });
      }

      if (meeting.meet_link) {
        return new Response(JSON.stringify({ meetLink: meeting.meet_link }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const meetLink = await createMeetSpace();
      const { error: updateErr } = await supabase.from("meetings").update({ meet_link: meetLink }).eq("id", meetingId);
      if (updateErr) throw updateErr;

      return new Response(JSON.stringify({ meetLink }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Instant, ad-hoc meeting — a fresh space every time, nothing persisted.
    const organizationId = body.organizationId as string | undefined;
    if (!isAdmin) {
      if (!organizationId || organizationId !== person.organization_id) {
        return new Response(JSON.stringify({ error: "Not authorized for this organization" }), { status: 403, headers: corsHeaders });
      }
    }

    const meetLink = await createMeetSpace();
    return new Response(JSON.stringify({ meetLink }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("create-meet-link error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: corsHeaders });
  }
});
