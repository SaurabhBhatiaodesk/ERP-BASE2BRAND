import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEV_OTP = "1234";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp, password } = await req.json();

    if (!email || !otp || !password) {
      return new Response(JSON.stringify({ error: "Email, OTP and password are required." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (String(otp).trim() !== DEV_OTP) {
      return new Response(JSON.stringify({ error: "Invalid OTP." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (String(password).trim().length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const normalizedEmail = String(email).trim().toLowerCase();
    const { data: listed, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const user = listed.users.find(u => u.email?.toLowerCase() === normalizedEmail);
    if (!user) {
      return new Response(JSON.stringify({ error: "No account found with this email." }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: String(password).trim(),
    });
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Password reset failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
