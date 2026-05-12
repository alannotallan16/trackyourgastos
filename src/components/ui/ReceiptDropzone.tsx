"use client";

import { useRef } from "react";
import { Camera, Upload } from "./icons";

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function ReceiptDropzone({ onFile, disabled }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-10 text-center transition ${
        disabled ? "opacity-60" : "hover:border-brand-green hover:bg-emerald-50/30"
      }`}
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-brand-green">
        <Camera className="h-7 w-7" />
      </div>
      <button
        type="button"
        className="mt-4 block w-full text-base font-semibold text-brand-navy hover:text-brand-green"
        onClick={() => cameraRef.current?.click()}
        disabled={disabled}
      >
        Tap to take photo
      </button>
      <button
        type="button"
        className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-navy"
        onClick={() => galleryRef.current?.click()}
        disabled={disabled}
      >
        <Upload className="h-4 w-4" />
        or upload from gallery
      </button>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
