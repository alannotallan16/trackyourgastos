"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Profile, SettlementBatchResult } from "@/lib/types";
import {
  recordPaymentForPair,
  type PairAllocationRow
} from "@/app/(app)/settlements/actions";
import { PAYMENT_METHODS_DATALIST_ID, PaymentMethodsDatalist } from "@/lib/payment-methods";
import { formatMoney } from "@/lib/format";
import { ArrowRight, ChevronLeft, Paperclip, X } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";

const RECEIPTS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_RECEIPTS_BUCKET || "receipts";

interface Props {
  open: boolean;
  onClose: () => void;
  profiles: Profile[];
  batchResults: SettlementBatchResult[];
  /** When present, the pair is fixed and the picker is hidden. */
  lockedPair?: { from_user_id: string; to_user_id: string };
  /** Pre-fill amount; clamped at the pair's open total. */
  suggestedAmount?: number;
}

/**
 * Two-step Record payment modal. Step 1 is the form; step 2 is the preview
 * served by record_payment_for_pair({preview_only: true}). Confirm calls the
 * same RPC with preview_only: false — so the running app never calls the TS
 * allocator and the preview always matches server behavior.
 */
export function RecordPaymentForPairModal({
  open,
  onClose,
  profiles,
  batchResults,
  lockedPair,
  suggestedAmount
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // Open (not reconciled / cancelled / paid) rows per pair — same filter the
  // RPC applies. Client-side only drives the picker UI and pair_open pre-fill;
  // the RPC re-reads and locks for update.
  const openRowsByPair = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of batchResults) {
      if (r.status !== "open" && r.status !== "partially_paid") continue;
      const k = `${r.from_user_id}→${r.to_user_id}`;
      m.set(k, (m.get(k) ?? 0) + Number(r.remaining_amount));
    }
    return m;
  }, [batchResults]);

  function openForPair(from: string, to: string) {
    return openRowsByPair.get(`${from}→${to}`) ?? 0;
  }

  const [fromId, setFromId] = useState(lockedPair?.from_user_id ?? "");
  const [toId, setToId] = useState(lockedPair?.to_user_id ?? "");
  const pairOpen = fromId && toId ? openForPair(fromId, toId) : 0;

  const [amount, setAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [step, setStep] = useState<1 | 2>(1);
  const [preview, setPreview] = useState<{
    pair_open: number;
    allocation: PairAllocationRow[];
    amount: number;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Reset on open/close.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setPreview(null);
    setErr(null);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setFromId(lockedPair?.from_user_id ?? "");
    setToId(lockedPair?.to_user_id ?? "");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setMethod("");
    setReference("");
    setNotes("");
    if (lockedPair) {
      const po = openForPair(lockedPair.from_user_id, lockedPair.to_user_id);
      const seed = suggestedAmount != null ? Math.min(po, suggestedAmount) : po;
      setAmount(seed > 0 ? seed.toFixed(2) : "");
    } else {
      setAmount("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // When the picker changes pair, reset the amount to pair_open.
  useEffect(() => {
    if (!open || lockedPair) return;
    const po = fromId && toId ? openForPair(fromId, toId) : 0;
    setAmount(po > 0 ? po.toFixed(2) : "");
  }, [open, lockedPair, fromId, toId, openRowsByPair]);

  if (!open) return null;

  const amountNum = Number(amount);
  const amountValid =
    fromId && toId && fromId !== toId && amountNum > 0 && amountNum <= pairOpen + 0.005;
  const amountOverCap = amountNum > pairOpen + 0.005;
  const samePerson = fromId && toId && fromId === toId;
  const pairHasNoDebt = Boolean(fromId && toId && !samePerson && pairOpen < 0.005);

  async function submitPreview() {
    setErr(null);
    start(async () => {
      try {
        const r = await recordPaymentForPair({
          from_user_id: fromId,
          to_user_id: toId,
          amount: amountNum,
          payment_date: paymentDate,
          payment_method: method || null,
          notes: notes || null,
          reference_number: reference || null,
          attachment_path: null,
          preview_only: true
        });
        setPreview({ pair_open: r.pair_open, allocation: r.allocation, amount: r.amount });
        setStep(2);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to compute preview.");
      }
    });
  }

  async function submitConfirm() {
    setErr(null);
    let attachment_path: string | null = null;
    if (file) {
      try {
        setUploading(true);
        const supabase = createClient();
        const cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `settlement-payments/pair/${Date.now()}-${cleanName}`;
        const { error: upErr } = await supabase.storage
          .from(RECEIPTS_BUCKET)
          .upload(path, file, {
            upsert: false,
            contentType: file.type || "application/octet-stream"
          });
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
        await recordPaymentForPair({
          from_user_id: fromId,
          to_user_id: toId,
          amount: amountNum,
          payment_date: paymentDate,
          payment_method: method || null,
          notes: notes || null,
          reference_number: reference || null,
          attachment_path,
          preview_only: false
        });
        onClose();
        router.refresh();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to record payment.");
      }
    });
  }

  const fromName = profiles.find((p) => p.id === fromId)?.display_name;
  const toName = profiles.find((p) => p.id === toId)?.display_name;
  const busy = pending || uploading;

  return (
    <div className="fixed inset-0 bg-brand-navy/40 flex items-end md:items-center justify-center p-4 z-40">
      <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg text-brand-navy">
            {step === 1 ? "Record payment" : "Confirm payment"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {step === 1 && (
          <>
            {/* Pair chip or picker */}
            {lockedPair ? (
              <div className="flex items-center gap-2 text-sm text-brand-navy bg-slate-50 rounded-xl px-3 py-2">
                <span className="font-medium">{fromName ?? "—"}</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
                <span className="font-medium">{toName ?? "—"}</span>
                <span className="ml-auto text-xs text-slate-500 tabular-nums">
                  open {formatMoney(pairOpen)}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Payer</label>
                  <select
                    className="input"
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Payee</label>
                  <select
                    className="input"
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id} disabled={p.id === fromId}>
                        {p.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {samePerson && (
              <p className="text-sm text-brand-danger">Payer and payee must differ.</p>
            )}
            {pairHasNoDebt && (
              <p className="text-sm text-brand-danger">
                No open obligation for {fromName} → {toName}. Create a settlement first.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Payment date</label>
                <input
                  type="date"
                  className="input"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Amount</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className="input"
                  value={amount}
                  disabled={!fromId || !toId || samePerson || pairHasNoDebt}
                  onChange={(e) => setAmount(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                />
                {fromId && toId && !samePerson && (
                  <p
                    className={`mt-1 text-[11px] ${
                      amountOverCap ? "text-brand-danger" : "text-slate-500"
                    }`}
                  >
                    Max {formatMoney(pairOpen)} (pair's open total)
                  </p>
                )}
              </div>
              <div>
                <label className="label">Method</label>
                <input
                  className="input"
                  list={PAYMENT_METHODS_DATALIST_ID}
                  placeholder="Bank transfer, GCash, cash…"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                />
                <PaymentMethodsDatalist />
              </div>
              <div>
                <label className="label">Reference #</label>
                <input
                  className="input"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className="label">Notes</label>
                <textarea
                  className="input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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
                      {file.name}
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
            </div>

            {err && <p className="text-sm text-brand-danger">{err}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={submitPreview}
                disabled={busy || !amountValid}
              >
                {pending ? "Checking…" : "Preview allocation"}
              </button>
            </div>
          </>
        )}

        {step === 2 && preview && (
          <>
            <div className="flex items-center gap-2 text-sm text-brand-navy bg-slate-50 rounded-xl px-3 py-2">
              <span className="font-medium">{fromName ?? "—"}</span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
              <span className="font-medium">{toName ?? "—"}</span>
              <span className="ml-auto text-xs text-slate-500 tabular-nums">
                {formatMoney(preview.amount)} of {formatMoney(preview.pair_open)} open
              </span>
            </div>

            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
              {preview.allocation.map((a) => (
                <li key={a.result_id} className="px-3 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-brand-navy">{a.batch_number}</strong>
                    <span className="tabular-nums font-semibold text-brand-navy">
                      apply {formatMoney(a.apply_amount)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    was {formatMoney(a.was_remaining)} → will leave {formatMoney(a.will_leave)}
                  </p>
                </li>
              ))}
            </ul>

            {err && <p className="text-sm text-brand-danger">{err}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStep(1)}
                disabled={busy}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={submitConfirm}
                disabled={busy}
              >
                {uploading ? "Uploading…" : pending ? "Saving…" : "Confirm & record"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
