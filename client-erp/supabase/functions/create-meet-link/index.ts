import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Auto-injected by the Supabase platform for the project this function is deployed to.
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Standard OAuth refresh-token flow for a single Google account (no Workspace
// admin / domain-wide delegation needed — works with a plain gmail.com account).
// That account authorized this app once via Google's consent screen; we
// exchange its long-lived refresh token for a fresh access token on every
// call. See supabase secrets set GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET
// / GOOGLE_OAUTH_REFRESH_TOKEN on the CLIENT-ERP project.
const googleOAuthClientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
const googleOAuthClientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
const googleOAuthRefreshToken = Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getGoogleAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleOAuthClientId,
      client_secret: googleOAuthClientSecret,
      refresh_token: googleOAuthRefreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token refresh failed: ${JSON.stringify(data)}`);
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

    // Instant, ad-hoc meeting. Whoever clicks "Start Meeting" first today creates
    // the room and a real `meetings` row for it; whoever clicks it next (or clicks
    // "Join" on that same row once it shows up in their list) gets the SAME link —
    // never a fresh throwaway room per click. This is what makes the client and
    // the team land in the same call without ever exchanging a URL.
    const organizationId = body.organizationId as string | undefined;
    if (!isAdmin) {
      if (!organizationId || organizationId !== person.organization_id) {
        return new Response(JSON.stringify({ error: "Not authorized for this organization" }), { status: 403, headers: corsHeaders });
      }
    }
    if (!organizationId) return new Response(JSON.stringify({ error: "organizationId is required" }), { status: 400, headers: corsHeaders });

    const { data: orgProjects, error: orgProjectsErr } = await supabase
      .from("projects")
      .select("id, status")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false });
    if (orgProjectsErr) throw orgProjectsErr;
    const project = (orgProjects ?? []).find(p => p.status === "active") ?? orgProjects?.[0];
    if (!project) return new Response(JSON.stringify({ error: "No project found for this organization" }), { status: 404, headers: corsHeaders });

    const todayDate = new Date().toISOString().slice(0, 10);
    const recentCutoff = new Date(Date.now() - 4 * 3600000).toISOString();

    const { data: existingInstant, error: existingErr } = await supabase
      .from("meetings")
      .select("id, meet_link")
      .eq("project_id", project.id)
      .eq("title", "Instant Meeting")
      .eq("meeting_date", todayDate)
      .gte("created_at", recentCutoff)
      .not("meet_link", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingErr) throw existingErr;

    if (existingInstant?.meet_link) {
      return new Response(JSON.stringify({ meetLink: existingInstant.meet_link }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const meetLink = await createMeetSpace();
    const { error: insertErr } = await supabase.from("meetings").insert({
      project_id: project.id,
      title: "Instant Meeting",
      meeting_date: todayDate,
      start_time: new Date().toISOString().slice(11, 19),
      meet_link: meetLink,
    });
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ meetLink }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("create-meet-link error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: corsHeaders });
  }
});
