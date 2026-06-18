import React, { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Avatar } from "./ui";
import { isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";

export function ProfilePhotoUpload({
  initials,
  imageUrl,
  onChange,
  disabled = false,
  autoOpen = false,
}: {
  initials: string;
  imageUrl: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  autoOpen?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (autoOpen && !disabled) inputRef.current?.click();
  }, [autoOpen, disabled]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || disabled) return;

    if (!isCloudinaryConfigured()) {
      setError("Cloudinary not configured in .env");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const uploaded = await uploadToCloudinary(file, "base2brand-profiles");
      onChange(uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function openPicker() {
    if (!disabled && !uploading) inputRef.current?.click();
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled || uploading}
        className="relative group rounded-full shrink-0 disabled:cursor-not-allowed"
        title="Upload profile photo"
      >
        <Avatar initials={initials} src={imageUrl || undefined} size="xl" />
        {!uploading && (
          <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity">
            <Camera size={22} className="text-white" />
            <span className="text-[9px] text-white mt-0.5 font-['Geist_Mono']">Change</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
            <Loader2 size={20} className="text-white animate-spin" />
          </div>
        )}
      </button>
      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-['Plus_Jakarta_Sans'] text-indigo-300 bg-indigo-600/15 border border-indigo-500/25 hover:bg-indigo-600/25 disabled:opacity-50"
          >
            <Camera size={13} />
            {imageUrl ? "Change photo" : "Upload photo"}
          </button>
          {imageUrl && (
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => onChange("")}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-[#6b7fa8] hover:text-rose-400 hover:bg-rose-500/10"
            >
              <X size={13} /> Remove
            </button>
          )}
        </div>
        <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">JPG, PNG · saved via Cloudinary</p>
        {error && <p className="text-[10px] text-rose-400">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
