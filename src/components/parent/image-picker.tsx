"use client";

import { useRef } from "react";

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  className?: string;
}

export function ImagePicker({ value, onChange, placeholder, className }: ImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDataUrl = value.startsWith("data:");

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") {
        onChange(result);
      }
    };
    reader.readAsDataURL(file);

    // reset so the same file can be re-selected
    event.target.value = "";
  }

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <input
        value={isDataUrl ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isDataUrl ? "Image uploaded" : (placeholder ?? "Image URL")}
        className="min-w-0 flex-1 rounded-lg border-2 border-black px-3 py-2"
        readOnly={isDataUrl}
      />
      {isDataUrl ? (
        <button
          type="button"
          title="Remove uploaded image"
          onClick={() => onChange("")}
          className="shrink-0 rounded-lg border-2 border-black bg-zinc-100 px-2 py-2 text-xs font-bold uppercase text-black"
        >
          ✕
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="shrink-0 rounded-lg border-2 border-black bg-zinc-100 px-2 py-2 text-xs font-bold uppercase text-black"
        title="Upload image file"
      >
        Upload
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
