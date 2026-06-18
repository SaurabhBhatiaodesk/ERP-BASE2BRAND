import { supabase } from "./supabase";

const BUCKET = "chat-attachments";

export type ChatFileUploadResult = {
  url: string;
  bytes: number;
  storage: "supabase" | "cloudinary";
};

function safeFileName(name: string) {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 120) || "document";
}

/** Upload PDF/DOC and other non-image chat attachments to Supabase Storage. */
export async function uploadChatDocument(file: File): Promise<ChatFileUploadResult> {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const base = safeFileName(file.name.replace(/\.[^.]+$/, ""));
  const path = `${Date.now()}-${crypto.randomUUID()}-${base}${ext ? `.${ext}` : ""}`;

  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });

  if (error) {
    if (error.message.includes("Bucket not found")) {
      throw new Error(
        "Chat file storage not set up. Run supabase/chat_storage.sql in Supabase SQL Editor."
      );
    }
    throw new Error(error.message);
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);

  return {
    url: pub.publicUrl,
    bytes: file.size,
    storage: "supabase",
  };
}

export function isSupabaseStorageUrl(url: string) {
  return /\/storage\/v1\/object\/(?:public|sign)\/chat-attachments\//i.test(url);
}

export function supabaseDownloadUrl(url: string, fileName?: string) {
  if (!isSupabaseStorageUrl(url)) return url;
  const base = url.split("?")[0];
  return `${base}?download=${encodeURIComponent(fileName || "download")}`;
}
