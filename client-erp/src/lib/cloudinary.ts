export function isCloudinaryConfigured() {
  return Boolean(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME && import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
}

/**
 * Client-side unsigned upload of a meeting recording (webm, video+audio).
 * Uploaded as Cloudinary's "video" resource type, which also serves audio-only
 * derived URLs (e.g. appending .mp3) — transcribe-meeting-recording uses that
 * to send OpenAI a much smaller audio-only file instead of the full video.
 */
export async function uploadMeetingRecording(blob: Blob, meetingId: string): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;
  if (!cloudName || !preset) {
    throw new Error("Cloudinary not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to .env");
  }

  const form = new FormData();
  form.append("file", blob, `meeting-${meetingId}.webm`);
  form.append("upload_preset", preset);
  form.append("folder", "base2brand-meeting-recordings");

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Recording upload failed.");
  }

  const data = (await res.json()) as { secure_url: string };
  return data.secure_url;
}
