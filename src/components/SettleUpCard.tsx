"use client";

import Link from "next/link";
import type { Profile, SettlementBatch, SettlementBatchResult } from "@/lib/types";
import type { DebtSuggestion } from "@/lib/balances";
import { formatDate, formatMoney } from "@/lib/format";
import { ArrowRight } from "@/components/ui/icons";

interface Props {
  suggestions: DebtSuggestion[];
  batches: SettlementBatch[];
  batchResults: SettlementBatchResult[];
  profiles: Profile[];
  /** Count of expenses with every split still `unpaid` (not yet in a batch). */
  unsettledCount: number;
  /** Total value of those unsettled expenses. */
  unsettledTotal: number;
  /** Earliest date among unsettled expenses — "since Oct 21". */
  unsettledSince: string | null;
  /** The signed-in user's id, for "<You>" phrasing. Optional. */
  meId?: string;
}

/**
 * The next-step card. Combines three overlapping concerns the old dashboard
 * split across different spots:
 *
 *   1. The greedy "who owes who" suggestion (unchanged logic).
 *   2. Open settlement batches — ref, how much is still remaining, age.
 *   3. A nudge to create a new batch when there's enough unsettled.
 */
export function SettleUpCard({
  suggestions,
  batches,
  batchResults,
  profiles,
  unsettledCount,
  unsettledTotal,
  unsettledSince,
  meId
}: Props) {
  const profilesById = new Map(profiles.map((p) => [p.id, p]));
  const openBatches = batches.filter((b) => b.status === "open" || b.status === "partially_paid");

  // Aggregate per batch for the "₱X left · N days" line.
  const resultsByBatch = new Map<string, SettlementBatchResult[]>();
  for (const r of batchResults) {
    if (!resultsByBatch.has(r.settlement_batch_id)) resultsByBatch.set(r.settlement_batch_id, []);
    resultsByBatch.get(r.settlement_batch_id)!.push(r);
  }

  const today = new Date();

  // Nothing pending — show the "all caught up" state.
  const nothingPending =
    suggestions.length === 0 && openBatches.length === 0 && unsettledCount === 0;

  return (
    <section className="card p-0 overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-brand-navy">Settle up</h2>
          <p className="text-xs text-slate-500">
            Suggested payments, open settlement batches, and unsettled expenses — in one place.
          </p>
        </div>
        <Link href="/settlements" className="btn-primary text-sm">
          Open settlements
        </Link>
      </header>

      {nothingPending ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          Everyone's square and nothing new is sitting unsettled.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {/* Suggested payments */}
          {suggestions.length > 0 && (
            <section className="px-5 py-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Suggested payments
              </h3>
              <ul className="space-y-1.5">
                {suggestions.map((s, i) => {
                  const fromName = profilesById.get(s.from_user_id)?.display_name ?? "—";
                  const toName = profilesById.get(s.to_user_id)?.display_name ?? "—";
                  const youFrom = meId && s.from_user_id === meId;
                  const youTo = meId && s.to_user_id === meId;
                  return (
                    <li
                      key={i}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2"
                    >
                      <span className="flex items-center gap-2 min-w-0 text-sm">
                        <span className="font-medium text-brand-navy">
                          {youFrom ? "You" : fromName}
                        </span>
                        <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="font-medium text-brand-navy">
                          {youTo ? "You" : toName}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="tabular-nums font-semibold text-brand-navy">
                          {formatMoney(s.amount)}
                        </span>
                        <Link
                          href="/settlements"
                          className="text-xs font-medium text-brand-green hover:underline"
                        >
                          Record
                        </Link>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Open batches */}
          {openBatches.length > 0 && (
            <section className="px-5 py-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Open settlement batches
              </h3>
              <ul className="space-y-1.5">
                {openBatches.map((b) => {
                  const rs = resultsByBatch.get(b.id) ?? [];
                  const total = rs.reduce((a, r) => a + Number(r.amount), 0);
                  const paid = rs.reduce((a, r) => a + Number(r.amount_paid), 0);
                  const remaining = Math.max(0, total - paid);
                  const ageDays = Math.max(
                    0,
                    Math.floor((today.getTime() - new Date(b.created_at).getTime()) / 86_400_000)
                  );
                  return (
                    <li key={b.id}>
                      <Link
                        href={`/settlements/${b.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 hover:bg-slate-50"
                      >
                        <span className="flex items-center gap-2 min-w-0 text-sm">
                          <strong className="font-semibold text-brand-navy">
                            {b.settlement_number}
                          </strong>
                          <span className="text-xs text-slate-500">
                            · {ageDays === 0 ? "today" : `${ageDays} day${ageDays === 1 ? "" : "s"}`}
                          </span>
                          {b.status === "partially_paid" && (
                            <span className="text-xs rounded-full bg-blue-50 text-blue-700 px-2 py-0.5">
                              partially paid
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-3 shrink-0 text-xs text-slate-500">
                          <span>
                            Left{" "}
                            <strong className="tabular-nums text-brand-navy">
                              {formatMoney(remaining)}
                            </strong>
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Unsettled expenses nudge */}
          {unsettledCount > 0 && (
            <section className="px-5 py-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Unsettled expenses
                </h3>
                <p className="text-sm text-brand-navy">
                  <strong className="tabular-nums">{unsettledCount}</strong> expense
                  {unsettledCount === 1 ? "" : "s"} · total{" "}
                  <strong className="tabular-nums">{formatMoney(unsettledTotal)}</strong>
                  {unsettledSince && (
                    <span className="text-slate-500"> · since {formatDate(unsettledSince)}</span>
                  )}
                </p>
              </div>
              <Link href="/settlements" className="btn-secondary text-sm">
                Create settlement
              </Link>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
