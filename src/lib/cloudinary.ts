import {
  isSupabaseStorageUrl,
  supabaseDownloadUrl,
  uploadChatDocument,
  type ChatFileUploadResult,
} from "./chatStorage";

export type CloudinaryUploadResult = {
  url: string;
  resourceType: string;
  bytes: number;
  format: string;
};

export type ChatAttachmentUploadResult = ChatFileUploadResult & {
  resourceType?: string;
  format?: string;
};

export function isCloudinaryConfigured() {
  return Boolean(
    import.meta.env.VITE_CLOUDINARY_CLOUD_NAME &&
      import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  );
}

const FILE_EXT_RE = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|txt|csv|rtf)(\?|#|$)/i;
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|#|$)/i;
const URL_ONLY_RE = /^https?:\/\/\S+$/i;

function isImageMime(type: string) {
  return type.startsWith("image/");
}

function uploadResourceType(file: File) {
  return isImageMime(file.type) ? "image" : "raw";
}

/** True when a PDF was uploaded via image/upload (breaks inline browser viewer). */
function isLegacyCloudinaryDoc(url: string) {
  return (
    url.includes("cloudinary.com") &&
    /\/image\/upload\//i.test(url) &&
    FILE_EXT_RE.test(url)
  );
}

/**
 * New uploads return /raw/upload/ from the API. Do not rewrite image→raw for
 * old messages — that path 404s because the asset only exists as image type.
 */
export function normalizeCloudinaryDeliveryUrl(url: string) {
  return url;
}

/** Client-side upload via unsigned preset — images as image, documents as raw. */
export async function uploadToCloudinary(
  file: File,
  folder = "base2brand-chat"
): Promise<CloudinaryUploadResult> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

  if (!cloudName || !preset) {
    throw new Error(
      "Cloudinary not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to .env"
    );
  }

  const resourceType = uploadResourceType(file);

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", preset);
  form.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    { method: "POST", body: form }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Cloudinary upload failed");
  }

  const data = (await res.json()) as {
    secure_url: string;
    resource_type: string;
    bytes: number;
    format: string;
  };

  return {
    url: normalizeCloudinaryDeliveryUrl(data.secure_url),
    resourceType: data.resource_type,
    bytes: data.bytes,
    format: data.format,
  };
}

/** Open / download URL for documents (attachment flag for download). */
export function fileDownloadUrl(url: string, fileName?: string) {
  const normalized = normalizeCloudinaryDeliveryUrl(url);
  if (!normalized) return normalized;
  if (isSupabaseStorageUrl(normalized)) {
    return supabaseDownloadUrl(normalized, fileName);
  }
  if (normalized.includes("cloudinary.com") && normalized.includes("/upload/")) {
    if (normalized.includes("/upload/fl_attachment/")) return normalized;
    return normalized.replace("/upload/", "/upload/fl_attachment/");
  }
  return normalized;
}

/** Inline open — Supabase URLs work directly; Cloudinary PDFs need dashboard setting enabled. */
export function fileOpenUrl(url: string) {
  const normalized = normalizeCloudinaryDeliveryUrl(url);
  if (!normalized) return normalized;
  if (isSupabaseStorageUrl(normalized)) return normalized;
  if (isLegacyCloudinaryDoc(normalized)) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(normalized)}`;
  }
  return normalized;
}

/** Images → Cloudinary. PDF/DOC/other files → Supabase (Cloudinary free blocks PDF delivery). */
export async function uploadChatAttachment(file: File): Promise<ChatAttachmentUploadResult> {
  if (isImageMime(file.type)) {
    const uploaded = await uploadToCloudinary(file);
    return {
      url: uploaded.url,
      bytes: uploaded.bytes,
      storage: "cloudinary",
      resourceType: uploaded.resourceType,
      format: uploaded.format,
    };
  }
  return uploadChatDocument(file);
}

export function isHttpUrl(text: string) {
  return URL_ONLY_RE.test(text.trim());
}

export function isFileUrl(url: string) {
  if (isSupabaseStorageUrl(url)) return true;
  if (FILE_EXT_RE.test(url)) return true;
  if (url.includes("cloudinary.com") && /\/raw\/upload\//i.test(url)) return true;
  return false;
}

export function isImageUrl(url: string) {
  if (FILE_EXT_RE.test(url)) return false;
  if (IMAGE_EXT_RE.test(url)) return true;
  return /\/image\/upload\//i.test(url);
}

export function fileNameFromUrl(url: string) {
  try {
    const path = new URL(url).pathname;
    const name = decodeURIComponent(path.split("/").pop() || "download");
    return name.includes(".") ? name : `${name}.file`;
  } catch {
    return "download";
  }
}

/** Cloudinary destroy API public_id, e.g. erp-screenshots/screenshot_123 */
export function cloudinaryPublicIdFromUrl(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?((?:erp-screenshots\/)[^/?#]+)/i);
  if (!match) return null;
  return match[1].replace(/\.[^/.]+$/, "");
}
