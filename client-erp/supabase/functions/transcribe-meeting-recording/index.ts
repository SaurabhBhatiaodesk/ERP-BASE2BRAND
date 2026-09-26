import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// This project (client-erp) — auto-injected by the Supabase platform.
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

// Set via: supabase secrets set OPENAI_API_KEY=sk-...
const openaiApiKey = Deno.env.get("OPENAI_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

/**
 * Cloudinary serves a "video" resource under other extensions too — asking
 * for .mp3 gets an on-the-fly audio-only transcode, a much smaller file to
 * send to OpenAI than the full webm (and audio is all Whisper needs anyway).
 */
function audioUrlFromRecording(recordingUrl: string): string {
  return recordingUrl.replace(/\.\w+(\?.*)?$/, ".mp3$1");
}

async function transcribeAudio(audioUrl: string): Promise<string> {
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error(`Couldn't fetch the recording audio (${audioRes.status}).`);
  const audioBlob = await audioRes.blob();

  const form = new FormData();
  form.append("file", audioBlob, "meeting.mp3");
  form.append("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiApiKey}` },
    body: form,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI transcription failed: ${errText}`);
  }
  const data = (await res.json()) as { text: string };
  return data.text;
}

/** Best-effort — a summary failure should never lose the transcript itself. */
async function summarizeTranscript(transcript: string): Promise<{ summary: string | null; decisions: string[] }> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You summarize client project meeting transcripts for a project management tool. " +
              'Respond with strict JSON only: {"summary": string, "decisions": string[]}. ' +
              "summary is 2-4 sentences. decisions is a short list of concrete decisions made in the meeting (empty array if none).",
          },
          { role: "user", content: transcript.slice(0, 15000) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return { summary: null, decisions: [] };
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : null,
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions.filter((d: unknown) => typeof d === "string") : [],
    };
  } catch {
    return { summary: null, decisions: [] };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!openaiApiKey) return json({ error: "OPENAI_API_KEY is not set on this project yet." }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing Authorization header" }, 401);

    // Acts as the calling user, not a service role — DB writes below go
    // through this person's own RLS (meetings_update / project_in_scope),
    // same protection every other client-erp write already relies on.
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Not signed in" }, 401);

    const payload = await req.json().catch(() => ({}));
    const meetingId = payload.meetingId as string | undefined;
    const recordingUrl = payload.recordingUrl as string | undefined;
    if (!meetingId || !recordingUrl) return json({ error: "meetingId and recordingUrl are required" }, 400);

    const transcript = await transcribeAudio(audioUrlFromRecording(recordingUrl));
    const { summary, decisions } = await summarizeTranscript(transcript);

    const { error: updateError } = await callerClient
      .from("meetings")
      .update({ transcript, ai_summary: summary, decisions })
      .eq("id", meetingId);
    if (updateError) throw updateError;

    return json({ transcript, aiSummary: summary, decisions });
  } catch (error) {
    console.error("transcribe-meeting-recording error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
