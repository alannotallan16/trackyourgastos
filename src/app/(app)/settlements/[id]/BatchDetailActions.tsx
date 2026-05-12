"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelBatch, recordPayment } from "../actions";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { Paperclip, Plus, X } from "@/components/ui/icons";

interface Props {
  batchId: string;
  /** If provided, the modal records a payment specifically against this result. */
  resultId?: string;
  remaining?: number;
  currency?: string;
  canCancel: boolean;
  hasAnyPayment: boolean;
  /** If true, render only the "Record payment" button (no cancel) and use a smaller button. */
  inline?: boolean;
}

const RECEIPTS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_RECEIPTS_BUCKET || "receipts";

export function BatchDetailActions({
  batchId,
  resultId,
  remaining = 0,
  currency = "PHP",
  canCancel,
  hasAnyPayment,
  inline
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [payment, setPayment] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    amount: remaining,
    payment_method: "",
    reference_number: "",
    notes: "",
    allow_overpay: false
  });

  function reset() {
    setOpen(false);
    setFile(null);
    setErr(null);
    setPayment({
      payment_date: new Date().toISOString().slice(0, 10),
      amount: remaining,
      payment_method: "",
      reference_number: "",
      notes: "",
      allow_overpay: false
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!resultId) {
      setErr("This payment is missing a target result.");
      return;
    }

    let attachment_path: string | null = null;
    if (file) {
      try {
        setUploading(true);
        const supabase = createClient();
        const cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `settlement-payments/${batchId}/${Date.now()}-${cleanName}`;
        const { error: upErr } = await supabase.storage
          .from(RECEIPTS_BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
        if (upErr) throw upErr;
        attachment_path = path;
      } catch (e: any) {
        setUploading(false);
        setErr(e?.message ?? "Failed to upload proof of payment.");
        return;
      }
      setUploading(false);
    }

    start(async () => {
      try {
        await recordPayment({
          settlement_batch_result_id: resultId,
          payment_date: payment.payment_date,
          amount: Number(payment.amount) || 0,
          payment_method: payment.payment_method || null,
          reference_number: payment.reference_number || null,
          notes: payment.notes || null,
          attachment_path,
          allow_overpay: payment.allow_overpay
        });
        reset();
        router.refresh();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to record payment.");
      }
    });
  }

  function onCancel() {
    if (!confirm("Cancel this settlement? Included expenses will return to Unsettled.")) return;
    start(async () => {
      try {
        await cancelBatch(batchId);
        router.refresh();
      } catch (e: any) {
        alert(e?.message ?? "Failed to cancel.");
      }
    });
  }

  const busy = pending || uploading;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {resultId && (
        <button
          className={inline ? "btn-secondary !py-1.5 !px-3 text-xs" : "btn-primary text-sm"}
          onClick={() => setOpen(true)}
          disabled={busy || remaining <= 0.005}
        >
          <Plus className="h-4 w-4" />
          Record payment
        </button>
      )}
      {canCancel && !inline && (
        <button
          className="btn-secondary text-sm"
          onClick={onCancel}
          disabled={busy || hasAnyPayment}
          title={hasAnyPayment ? "Refund recorded payments first" : ""}
        >
          Cancel settlement
        </button>
      )}

      {open && resultId && (
        <div className="fixed inset-0 bg-brand-navy/40 flex items-end md:items-center justify-center p-4 z-40">
          <form className="bg-white rounded-2xl shadow-card-hover w-full max-w-md p-5 space-y-3" onSubmit={submit}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg text-brand-navy">Record payment</h2>
              <button type="button" onClick={reset} aria-label="Close">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Remaining balance: <span className="font-semibold text-brand-navy">{formatMoney(remaining, currency)}</span>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Payment date</label>
                <input
                  className="input"
                  type="date"
                  required
                  value={payment.payment_date}
                  onChange={(e) => setPayment({ ...payment, payment_date: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Amount</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={payment.amount}
                  onChange={(e) => setPayment({ ...payment, amount: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Method</label>
                <input
                  className="input"
                  placeholder="GCash, bank, cash…"
                  value={payment.payment_method}
                  onChange={(e) => setPayment({ ...payment, payment_method: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Reference #</label>
                <input
                  className="input"
                  value={payment.reference_number}
                  onChange={(e) => setPayment({ ...payment, reference_number: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="label">Notes</label>
                <textarea
                  className="input"
                  value={payment.notes}
                  onChange={(e) => setPayment({ ...payment, notes: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="label">Proof of payment</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-secondary !py-2 text-sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4" />
                    {file ? "Replace file" : "Attach file"}
                  </button>
                  {file && (
                    <span className="text-xs text-slate-600 truncate flex-1">
                      {file.name}{" "}
                      <button
                        type="button"
                        className="ml-1 text-brand-danger hover:underline"
                        onClick={() => {
                          setFile(null);
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                      >
                        remove
                      </button>
                    </span>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Optional. Image or PDF.</p>
              </div>
              <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={payment.allow_overpay}
                  onChange={(e) => setPayment({ ...payment, allow_overpay: e.target.checked })}
                />
                Allow overpayment (amount &gt; remaining)
              </label>
            </div>

            {err && <p className="text-sm text-brand-danger">{err}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={reset} disabled={busy}>
                Cancel
              </button>
              <button className="btn-primary" disabled={busy}>
                {uploading ? "Uploading…" : pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
