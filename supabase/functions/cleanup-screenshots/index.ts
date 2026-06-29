import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cloudinaryCloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME")!;
const cloudinaryApiKey = Deno.env.get("CLOUDINARY_API_KEY")!;
const cloudinaryApiSecret = Deno.env.get("CLOUDINARY_API_SECRET")!;

async function generateSHA1(message: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch old screenshots (older than today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: oldScreenshots, error: fetchError } = await supabase
      .from("employee_screenshots")
      .select("id, image_url")
      .lt("captured_at", today.toISOString());

    if (fetchError) throw fetchError;
    if (!oldScreenshots || oldScreenshots.length === 0) {
      return new Response(JSON.stringify({ message: "No old screenshots to delete." }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let deletedCount = 0;

    // 2. Delete from Cloudinary
    for (const screenshot of oldScreenshots) {
      // Extract public_id from Cloudinary URL
      // Example URL: https://res.cloudinary.com/demo/image/upload/v1234567890/erp-screenshots/screenshot_123.jpg
      const urlParts = screenshot.image_url.split("/");
      const filename = urlParts.pop(); // screenshot_123.jpg
      const folderName = urlParts.pop(); // erp-screenshots
      
      if (!filename || !folderName) continue;

      const publicId = `${folderName}/${filename.split(".")[0]}`;
      const timestamp = Math.floor(Date.now() / 1000).toString();

      // Signature: SHA-1 of public_id=<id>&timestamp=<ts><api_secret>
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

      if (res.ok) {
        // 3. Delete from Supabase Database
        await supabase.from("employee_screenshots").delete().eq("id", screenshot.id);
        deletedCount++;
      }
    }

    return new Response(JSON.stringify({ message: `Successfully deleted ${deletedCount} old screenshots.` }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
