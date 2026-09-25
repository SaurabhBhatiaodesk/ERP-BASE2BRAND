import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

// Set via: supabase secrets set CLIENT_ERP_PORTAL_URL=https://your-deployed-client-erp-url
// Left unset until you have a real deployed/custom domain — never guessed here.
const portalUrl = Deno.env.get("CLIENT_ERP_PORTAL_URL") || null;

// Set via: supabase secrets set GMAIL_SMTP_USER=... GMAIL_SMTP_APP_PASSWORD=...
// (a Gmail Account > Security > App Passwords value, not the normal Gmail password).
// Until these are set, the function still succeeds — it just reports emailSent:false
// so the credentials can be shared manually from the main ERP's UI.
const smtpUser = Deno.env.get("GMAIL_SMTP_USER") || "";
const smtpPass = Deno.env.get("GMAIL_SMTP_APP_PASSWORD") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

async function requireAdmin(req: Request): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401, message: "Missing Authorization header" };

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user?.email) return { ok: false, status: 401, message: "Not signed in" };

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

function initialsFromName(name: string): string {
  return name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join("");
}

async function sendCredentialsEmail(to: string, name: string, password: string): Promise<{ sent: boolean; reason?: string }> {
  if (!smtpUser || !smtpPass) {
    return { sent: false, reason: "Gmail SMTP not configured yet (set GMAIL_SMTP_USER / GMAIL_SMTP_APP_PASSWORD secrets)." };
  }
  try {
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: smtpUser, password: smtpPass },
      },
    });
    const portalLine = portalUrl
      ? `<p>Portal: <a href="${portalUrl}">${portalUrl}</a></p>`
      : `<p>Ask your Base2Brand contact for the portal link.</p>`;
    await client.send({
      from: smtpUser,
      to,
      subject: "Your Base2Brand Client Portal access",
      content: "auto",
      html: `
        <p>Hi ${name},</p>
        <p>Your Base2Brand Client Portal is ready. You can log in with:</p>
        <p><strong>Email:</strong> ${to}<br/><strong>Password:</strong> ${password}</p>
        ${portalLine}
        <p>For security, please change your password after your first login.</p>
      `,
    });
    await client.close();
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return json({ error: auth.message }, auth.status);

    const payload = await req.json().catch(() => ({}));
    const leadId = payload.leadId;
    if (!leadId) return json({ error: "leadId is required" }, 400);

    const { data: lead, error: leadError } = await supabaseService
      .from("leads")
      .select("id, name, contact, email")
      .eq("id", leadId)
      .maybeSingle();
    if (leadError) throw leadError;
    if (!lead) return json({ error: "Client not found" }, 404);
    if (!lead.email?.trim()) {
      return json({ error: "This client has no email on file — add one before enabling portal access." }, 400);
    }
    const email = lead.email.trim().toLowerCase();
    const contactName = lead.contact?.trim() || lead.name;

    // 1. Org — same upsert key (source_lead_id) as sync-project-to-client-portal,
    // so a client enabled here and a client synced via a project always land on
    // the same organization row.
    const { data: org, error: orgError } = await clientErp
      .from("organizations")
      .upsert({ source_lead_id: String(lead.id), name: lead.name }, { onConflict: "source_lead_id" })
      .select("id")
      .single();
    if (orgError) throw orgError;
    const organizationId = org.id as string;

    // 2. Password + Auth user — reset the password if this email already has
    // an account (e.g. re-enabling after a reset request), create one otherwise.
    const password = generatePassword();
    const { data: usersPage, error: listError } = await clientErp.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;
    let authUserId = usersPage.users.find(u => u.email?.toLowerCase() === email)?.id ?? null;

    if (authUserId) {
      const { error: updateAuthError } = await clientErp.auth.admin.updateUserById(authUserId, { password });
      if (updateAuthError) throw updateAuthError;
    } else {
      const { data: created, error: createAuthError } = await clientErp.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: contactName },
      });
      if (createAuthError) throw createAuthError;
      authUserId = created.user.id;
    }

    // 3. Person — link (or create) the client-erp contact for this org/email.
    const { data: existingPerson } = await clientErp
      .from("people")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .maybeSingle();

    if (existingPerson) {
      const { error: updatePersonError } = await clientErp
        .from("people")
        .update({ full_name: contactName, initials: initialsFromName(contactName), auth_user_id: authUserId })
        .eq("id", existingPerson.id);
      if (updatePersonError) throw updatePersonError;
    } else {
      const { error: personError } = await clientErp.from("people").insert({
        kind: "client",
        organization_id: organizationId,
        auth_user_id: authUserId,
        full_name: contactName,
        email,
        initials: initialsFromName(contactName),
        role: "Client Admin",
      });
      if (personError) throw personError;
    }

    const emailResult = await sendCredentialsEmail(email, contactName, password);

    return json({
      email,
      password,
      portalUrl,
      emailSent: emailResult.sent,
      emailError: emailResult.sent ? undefined : emailResult.reason,
    });
  } catch (error) {
    console.error("enable-client-portal-access error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
