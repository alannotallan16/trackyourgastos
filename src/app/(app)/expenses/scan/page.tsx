"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";

type Stage = "idle" | "compressing" | "ocr" | "uploading" | "done" | "error";

export default function ScanPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function handleFile(file: File) {
    try {
      setError(null);
      setStage("compressing");
      setProgress(5);
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1800,
        useWebWorker: true,
        initialQuality: 0.85
      });

      setPreviewUrl(URL.createObjectURL(compressed));
      setStage("ocr");
      setProgress(15);

      // Tesseract.js dynamic import (client-only)
      let text = "";
      try {
        const Tesseract = (await import("tesseract.js")).default;
        const result = await Tesseract.recognize(compressed, "eng", {
          logger: (m: any) => {
            if (m.status === "recognizing text") {
              setProgress(15 + Math.round(m.progress * 70));
            }
          }
        });
        text = result?.data?.text ?? "";
      } catch (e) {
        // fallback to OCR.Space if configured
        try {
          const fd = new FormData();
          fd.append("file", compressed, file.name);
          const r = await fetch("/api/ocr", { method: "POST", body: fd });
          const j = await r.json();
          if (r.ok) text = j.text ?? "";
        } catch {
          /* ignore */
        }
      }

      setStage("uploading");
      setProgress(90);
      const fd = new FormData();
      fd.append("file", compressed, file.name);
      fd.append("ocrText", text);
      const res = await fetch("/api/receipts/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");

      setProgress(100);
      setStage("done");
      const q = new URLSearchParams({ receipt: json.receipt.id });
      router.push(`/expenses/review?${q.toString()}`);
    } catch (e: any) {
      setStage("error");
      setError(e?.message ?? "Failed to process receipt");
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Scan receipt</h1>
      <p className="text-sm text-slate-600">
        Take a photo or upload an image. We'll OCR it locally and pre-fill the expense form.
      </p>

      <div className="card flex flex-col gap-3">
        <label className="btn-primary w-full md:w-auto text-center cursor-pointer">
          📷 Take photo
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
        <label className="btn-secondary w-full md:w-auto text-center cursor-pointer">
          🗂️ Upload from device
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
        <button
          type="button"
          className="text-xs text-brand underline self-start"
          onClick={() => router.push("/expenses/new")}
        >
          Skip OCR and enter manually →
        </button>
      </div>

      {stage !== "idle" && (
        <div className="card space-y-2">
          <p className="text-sm">
            <strong>{stageLabel(stage)}</strong>
            {stage !== "error" && stage !== "done" ? "…" : ""}
          </p>
          <div className="w-full bg-slate-200 rounded h-2">
            <div className="bg-brand h-2 rounded transition-all" style={{ width: `${progress}%` }} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {previewUrl && <img src={previewUrl} alt="" className="max-h-72 rounded border border-slate-200" />}
        </div>
      )}
    </div>
  );
}

function stageLabel(s: Stage) {
  switch (s) {
    case "compressing": return "Compressing image";
    case "ocr": return "Reading receipt";
    case "uploading": return "Uploading";
    case "done": return "Done — opening review";
    case "error": return "Error";
    default: return "";
  }
}
