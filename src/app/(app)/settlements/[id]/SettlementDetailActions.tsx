"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelSettlement, recordPayment } from "../actions";
import { formatMoney } from "@/lib/format";
import { Plus, X } from "@/components/ui/icons";

interface Props {
  settlementId: string;
  remaining: number;
  currency: string;
  canRecordPayment: boolean;
  canCancel: boolean;
}

export function SettlementDetailActions({ settlementId, remaining, currency, canRecordPayment, canCancel }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [payment, setPayment] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    amount: remaining,
    payment_method: "",
    reference_number: "",
    notes: "",
    allow_overpay: false
  });

  function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      try {
        await recordPayment({
          settlement_id: settlementId,
          payment_date: payment.payment_date,
          amount: Number(payment.amount) || 0,
          payment_method: payment.payment_method || null,
          reference_number: payment.reference_number || null,
          notes: payment.notes || null,
          allow_overpay: payment.allow_overpay
        });
        setOpen(false);
        router.refresh();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to record payment.");
      }
    });
  }

  function onCancel() {
    if (!confirm("Cancel this settlement? Included expense shares will return to unpaid.")) return;
    start(async () => {
      try {
        await cancelSettlement(settlementId);
        router.refresh();
      } catch (e: any) {
        alert(e?.message ?? "Failed to cancel.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="btn-primary text-sm"
        onClick={() => setOpen(true)}
        disabled={!canRecordPayment || pending}
      >
        <Plus className="h-4 w-4" />
        Record payment
      </button>
      {canCancel && (
        <button className="btn-secondary text-sm" onClick={onCancel} disabled={pending}>
          Cancel settlement
        </button>
      )}

      {open && (
        <div className="fixed inset-0 bg-brand-navy/40 flex items-end md:items-center justify-center p-4 z-40">
          <form className="bg-white rounded-2xl shadow-card-hover w-full max-w-md p-5 space-y-3" onSubmit={submitPayment}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg text-brand-navy">Record payment</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">
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
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
