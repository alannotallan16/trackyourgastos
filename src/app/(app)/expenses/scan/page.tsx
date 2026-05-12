"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReceiptDropzone } from "@/components/ui/ReceiptDropzone";

type Stage = "idle" | "compressing" | "ocr" | "uploading" | "done" | "error";

export default function ScanPage() {
  const router = useRouter();
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

  const busy = stage !== "idle" && stage !== "error";

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <PageHeader
        title="Scan receipt"
        subtitle="We'll OCR the image locally and pre-fill the expense form."
      />

      <ReceiptDropzone onFile={handleFile} disabled={busy} />

      <div className="text-center">
        <button
          type="button"
          className="text-sm text-slate-500 hover:text-brand-navy underline"
          onClick={() => router.push("/expenses/new")}
        >
          Skip OCR and enter manually
        </button>
      </div>

      {stage !== "idle" && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-brand-navy">
              {stageLabel(stage)}
              {stage !== "error" && stage !== "done" ? "…" : ""}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">{progress}%</span>
          </div>
          <div className="w-full bg-brand-bg rounded-full h-2 overflow-hidden">
            <div className="bg-brand-gradient h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          {error && <p className="text-sm text-brand-danger">{error}</p>}
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Receipt preview" className="max-h-72 rounded-xl border border-slate-200" />
          )}
        </div>
      )}
    </div>
  );
}

function stageLabel(s: Stage) {
  switch (s) {
    case "compressing":
      return "Compressing image";
    case "ocr":
      return "Reading receipt";
    case "uploading":
      return "Uploading";
    case "done":
      return "Done — opening review";
    case "error":
      return "Error";
    default:
      return "";
  }
}
