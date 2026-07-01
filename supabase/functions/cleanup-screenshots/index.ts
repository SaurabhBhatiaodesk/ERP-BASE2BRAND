import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cloudinaryCloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME")!;
const cloudinaryApiKey = Deno.env.get("CLOUDINARY_API_KEY")!;
const cloudinaryApiSecret = Deno.env.get("CLOUDINARY_API_SECRET")!;

const RETENTION_DAYS = 3;

async function generateSHA1(message: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cloudinaryPublicIdFromUrl(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?((?:erp-screenshots\/)[^/?#]+)/i);
  if (!match) return null;
  return match[1].replace(/\.[^/.]+$/, "");
}

async function destroyCloudinaryAsset(publicId: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const strToSign = `public_id=${publicId}&timestamp=${timestamp}${cloudinaryApiSecret}`;
  const signature = await generateSHA1(strToSign);

  const formData = new FormData();
  formData.append("public_id", publicId);
  formData.append("api_key", cloudinaryApiKey);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/destroy`, {
    method: "POST",
    body: formData,
  });

  return res.ok;
}

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const oldScreenshots: { id: string; image_url: string }[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      const { data, error: fetchError } = await supabase
        .from("employee_screenshots")
        .select("id, image_url")
        .lt("captured_at", cutoff.toISOString())
        .order("captured_at", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (fetchError) throw fetchError;
      if (!data?.length) break;
      oldScreenshots.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    if (oldScreenshots.length === 0) {
      return new Response(
        JSON.stringify({ message: `No screenshots older than ${RETENTION_DAYS} days.` }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    let deletedFromCloudinary = 0;
    let deletedFromDb = 0;
    let cloudinaryErrors = 0;

    for (const screenshot of oldScreenshots) {
      const publicId = cloudinaryPublicIdFromUrl(screenshot.image_url);
      if (publicId) {
        const ok = await destroyCloudinaryAsset(publicId);
        if (ok) deletedFromCloudinary++;
        else cloudinaryErrors++;
      }

      const { error: deleteError } = await supabase
        .from("employee_screenshots")
        .delete()
        .eq("id", screenshot.id);

      if (!deleteError) deletedFromDb++;
    }

    return new Response(
      JSON.stringify({
        message: `Cleanup complete (retention: ${RETENTION_DAYS} days).`,
        scanned: oldScreenshots.length,
        deletedFromDb,
        deletedFromCloudinary,
        cloudinaryErrors,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
