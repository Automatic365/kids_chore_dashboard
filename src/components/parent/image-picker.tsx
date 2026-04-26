"use client";

import { useRef, useState } from "react";

import {
  createSignedParentMediaUpload,
  isRemoteApiEnabled,
  uploadParentMedia,
} from "@/lib/client-api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  className?: string;
  uploadKind?: "avatar" | "mission";
}

export function ImagePicker({
  value,
  onChange,
  placeholder,
  className,
  uploadKind = "mission",
}: ImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isDataUrl = value.startsWith("data:");
  const hasValue = value.trim().length > 0;

  function toUploadError(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      if (error.message.includes("UNAUTHORIZED")) {
        return "Parent session expired. Re-enter parent mode and try again.";
      }
      return error.message;
    }
    return "Image upload failed";
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (isRemoteApiEnabled()) {
      setIsUploading(true);
      setUploadError(null);
      try {
        const signed = await createSignedParentMediaUpload({
          kind: uploadKind,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });

        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          const { error: uploadError } = await supabase.storage
            .from(signed.bucket)
            .uploadToSignedUrl(signed.path, signed.token, file, {
              upsert: false,
              contentType: file.type,
            });

          if (uploadError) {
            throw new Error(uploadError.message);
          }

          onChange(signed.url);
        } else {
          const uploadedUrl = await uploadParentMedia(file, uploadKind);
          onChange(uploadedUrl);
        }
      } catch (error) {
        setUploadError(toUploadError(error));
      } finally {
        setIsUploading(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") {
          setUploadError(null);
          onChange(result);
        }
      };
      reader.readAsDataURL(file);
    }

    // reset so the same file can be re-selected
    event.target.value = "";
  }

  return (
    <div className={`grid gap-1 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <input
          value={isDataUrl ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            isUploading
              ? "Uploading image..."
              : isDataUrl
                ? "Image uploaded"
                : (placeholder ?? "Image URL")
          }
          className="min-w-0 flex-1 rounded-lg border-2 border-black px-3 py-2"
          readOnly={isDataUrl || isUploading}
          autoComplete="off"
          data-1p-ignore
          data-bwignore="true"
          data-lpignore="true"
        />
        {hasValue ? (
          <button
            type="button"
            title="Remove selected image"
            onClick={() => {
              setUploadError(null);
              onChange("");
            }}
            className="shrink-0 rounded-lg border-2 border-black bg-zinc-100 px-2 py-2 text-xs font-bold uppercase text-black"
          >
            ✕
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="shrink-0 rounded-lg border-2 border-black bg-zinc-100 px-2 py-2 text-xs font-bold uppercase text-black disabled:opacity-60"
          title="Upload image file"
        >
          {isUploading ? "Uploading..." : "Upload"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
          autoComplete="off"
          data-1p-ignore
          data-bwignore="true"
          data-lpignore="true"
        />
      </div>
      {uploadError ? (
        <p className="text-xs font-bold uppercase text-red-700">{uploadError}</p>
      ) : null}
    </div>
  );
}
