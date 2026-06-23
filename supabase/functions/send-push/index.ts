import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import admin from "npm:firebase-admin@11.10.1";

// Ensure we only initialize the Firebase app once
if (!admin.apps.length) {
  const serviceAccountKey = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!serviceAccountKey) {
    console.error("Missing FIREBASE_SERVICE_ACCOUNT environment variable.");
  } else {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("Firebase Admin initialized successfully.");
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT:", e);
    }
  }
}

serve(async (req) => {
  try {
    // 1. Parse the Webhook Payload
    // The payload comes from Supabase Database Webhook (INSERT on notifications table)
    const payload = await req.json();
    console.log("Webhook payload received:", payload);

    const record = payload.record; // The newly inserted notification row
    if (!record || !record.recipient_id) {
      return new Response(JSON.stringify({ error: "No record or recipient_id found" }), { status: 400 });
    }

    // 2. Initialize Supabase Client to fetch user tokens
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Fetch the recipient's FCM tokens
    const { data: profile, error } = await supabase
      .from("employee_profiles")
      .select("fcm_token, web_fcm_token")
      .eq("id", record.recipient_id)
      .single();

    if (error || !profile) {
      console.error("Error fetching profile or profile not found:", error);
      return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404 });
    }

    // 4. Collect both Web and Mobile tokens
    const tokens: string[] = [];
    if (profile.fcm_token) tokens.push(profile.fcm_token); // Mobile App Token
    if (profile.web_fcm_token) tokens.push(profile.web_fcm_token); // Web App Token

    if (tokens.length === 0) {
      console.log(`User ${record.recipient_id} has no FCM tokens.`);
      return new Response(JSON.stringify({ message: "No FCM tokens found for user" }), { status: 200 });
    }

    // 5. Send Multicast Push Notification via Firebase
    const message = {
      notification: {
        title: record.title || "New Notification",
        body: record.message || "You have a new notification",
      },
      data: {
        type: record.type || "general",
        reference_id: record.reference_id || "",
        notification_id: record.id || "",
      },
      tokens: tokens, // Array of both tokens!
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`Successfully sent message to ${response.successCount} devices`);
    if (response.failureCount > 0) {
      console.error(`Failed to send to ${response.failureCount} devices`);
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Error for token ${tokens[idx]}:`, resp.error);
        }
      });
    }

    return new Response(
      JSON.stringify({
        message: "Push notification sent",
        successCount: response.successCount,
        failureCount: response.failureCount,
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error sending push notification:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
