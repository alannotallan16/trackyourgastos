"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Profile, SettlementBatchResult } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { reconcileBatchRows } from "@/app/(app)/settlements/actions";
import { ArrowRight, X } from "@/components/ui/icons";

interface Props {
  batchId: string;
  results: SettlementBatchResult[];
  profiles: Profile[];
  trigger?: React.ReactNode;
}

/**
 * Close batch dialog. Lists every result in the batch with a checkbox for the
 * ones that still have money owed (default: all checked). Reconciling flips
 * each selected row's status to "reconciled" and writes its remaining balance
 * into reconciled_amount — no settlement_payments row is written, so the
 * integrity audit stays truthful.
 */
export function CloseBatchDialog({ batchId, results, profiles, trigger }: Props) {
  const router = useRouter();
  const profilesById = new Map(profiles.map((p) => [p.id, p]));

  const closable = results.filter(
    (r) => r.status === "open" || r.status === "partially_paid"
  );
  const alreadyDone = results.filter((r) => r.status === "paid" || r.status === "reconciled");

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(closable.map((r) => r.id))
  );
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const nothingToClose = closable.length === 0;
  if (nothingToClose && !alreadyDone.length) return null;

  function openDialog() {
    setSelected(new Set(closable.map((r) => r.id)));
    setErr(null);
    setOpen(true);
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function submit() {
    setErr(null);
    if (selected.size === 0) {
      setErr("Select at least one row to close.");
      return;
    }
    start(async () => {
      try {
        await reconcileBatchRows({ batch_id: batchId, result_ids: Array.from(selected) });
        setOpen(false);
        router.refresh();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to reconcile.");
      }
    });
  }

  function labelFor(r: SettlementBatchResult) {
    const f = profilesById.get(r.from_user_id)?.display_name ?? "—";
    const t = profilesById.get(r.to_user_id)?.display_name ?? "—";
    return { from: f, to: t };
  }

  return (
    <>
      {trigger ? (
        <span onClick={openDialog} role="button" className="contents">
          {trigger}
        </span>
      ) : (
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={openDialog}
          disabled={nothingToClose}
          title={nothingToClose ? "Every row is already paid or reconciled" : ""}
        >
          Close batch
        </button>
      )}

      {open && (
        <div className="fixed inset-0 bg-brand-navy/40 flex items-end md:items-center justify-center p-4 z-40">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg text-brand-navy">Close batch</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Closing a row marks its remaining balance as{" "}
              <strong className="text-brand-navy">reconciled</strong> — no payment is recorded, so
              the integrity audit stays accurate. Use this when the debt is already accounted for
              elsewhere.
            </p>

            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
              {closable.map((r) => {
                const { from, to } = labelFor(r);
                const checked = selected.has(r.id);
                return (
                  <li key={r.id}>
                    <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand-green"
                        checked={checked}
                        onChange={() => toggle(r.id)}
                      />
                      <span className="flex items-center gap-1.5 text-sm text-brand-navy min-w-0">
                        <span className="font-medium">{from}</span>
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                        <span className="font-medium">{to}</span>
                      </span>
                      <span className="ml-auto text-sm tabular-nums font-semibold text-brand-navy">
                        {formatMoney(Number(r.remaining_amount), r.currency)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            {alreadyDone.length > 0 && (
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer hover:text-slate-700">
                  Already paid — no action needed ({alreadyDone.length})
                </summary>
                <ul className="mt-1 space-y-0.5 pl-2">
                  {alreadyDone.map((r) => {
                    const { from, to } = labelFor(r);
                    return (
                      <li key={r.id} className="flex items-center gap-2">
                        <span>
                          {from} → {to}
                        </span>
                        <span className="ml-auto tabular-nums">
                          {formatMoney(Number(r.amount), r.currency)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}

            {err && <p className="text-sm text-brand-danger">{err}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={submit}
                disabled={pending || selected.size === 0}
              >
                {pending ? "Closing…" : "Close selected rows"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
