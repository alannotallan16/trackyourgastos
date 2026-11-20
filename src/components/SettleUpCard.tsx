"use client";

import Link from "next/link";
import { useState } from "react";
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

const COLLAPSED_ROWS = 2;

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

  // Compact-by-default: show at most COLLAPSED_ROWS rows per section, then a
  // "See all N" toggle. Keeps the card around the same vertical footprint as
  // the old "Who owes who" box.
  const [expandedSuggestions, setExpandedSuggestions] = useState(false);
  const [expandedBatches, setExpandedBatches] = useState(false);
  const shownSuggestions = expandedSuggestions ? suggestions : suggestions.slice(0, COLLAPSED_ROWS);
  // Sort open batches oldest first — those are the ones that need attention first.
  const openBatchesSorted = [...openBatches].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
  const shownBatches = expandedBatches
    ? openBatchesSorted
    : openBatchesSorted.slice(0, COLLAPSED_ROWS);

  // All open or partially-paid batch_results for a from/to pair, oldest first.
  // The Record button links to the first one; the breakdown underneath lists
  // all of them so the user can see what makes up the suggestion.
  function matchingOpenResults(fromId: string, toId: string) {
    return batchResults
      .filter(
        (r) =>
          r.from_user_id === fromId &&
          r.to_user_id === toId &&
          (r.status === "open" || r.status === "partially_paid")
      )
      .map((r) => {
        const batch = batches.find((b) => b.id === r.settlement_batch_id);
        return {
          result: r,
          batch_number: batch?.settlement_number ?? "?",
          created_at: batch?.created_at ?? "9999"
        };
      })
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  return (
    <section className="card p-0 overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-brand-navy">Settle up</h2>
          <p className="text-xs text-slate-500">
            This is everything still owed, including what's left in any open settlement batches.
          </p>
        </div>
        <Link href="/settlements" className="btn-secondary text-sm">
          All settlements
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
                {shownSuggestions.map((s, i) => {
                  const fromName = profilesById.get(s.from_user_id)?.display_name ?? "—";
                  const toName = profilesById.get(s.to_user_id)?.display_name ?? "—";
                  const youFrom = meId && s.from_user_id === meId;
                  const youTo = meId && s.to_user_id === meId;
                  const matches = matchingOpenResults(s.from_user_id, s.to_user_id);
                  const matchedRemaining = matches.reduce(
                    (a, m) => a + Number(m.result.remaining_amount),
                    0
                  );
                  const batchForRecord = matches[0]?.result.settlement_batch_id ?? null;
                  const newExpenses = Math.max(0, s.amount - matchedRemaining);
                  return (
                    <li
                      key={i}
                      className="rounded-xl border border-slate-100 px-3 py-2 space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
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
                          {batchForRecord ? (
                            <Link
                              href={`/settlements/${batchForRecord}`}
                              className="inline-flex items-center rounded-md border border-brand-green bg-brand-green/10 px-2.5 py-1 text-xs font-medium text-brand-green hover:bg-brand-green/20"
                              title="Record against the earliest matching open batch."
                            >
                              Record
                            </Link>
                          ) : (
                            <Link
                              href="/settlements"
                              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              title="No open batch for this pair yet — Create settlement to make one."
                            >
                              Create batch
                            </Link>
                          )}
                        </span>
                      </div>
                      {/* Breakdown: show which open batch_results make up this suggestion. */}
                      {matches.length > 0 && (
                        <p className="text-[11px] text-slate-500">
                          {matches.length === 1
                            ? `${matches[0].batch_number} still shows `
                            : `Open batches `}
                          {matches.map((m, mi) => (
                            <span key={m.result.id} className="tabular-nums">
                              {matches.length > 1 && (
                                <strong className="text-slate-600">{m.batch_number} </strong>
                              )}
                              {formatMoney(Number(m.result.remaining_amount))}
                              {mi < matches.length - 1 ? " · " : ""}
                            </span>
                          ))}
                          {newExpenses > 0.01 && (
                            <> · new since then {formatMoney(newExpenses)}</>
                          )}
                        </p>
                      )}
                      {matches.length === 0 && (
                        <p className="text-[11px] text-slate-500">
                          No open batch for this pair; this is all from unsettled expenses.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              {suggestions.length > COLLAPSED_ROWS && (
                <button
                  type="button"
                  onClick={() => setExpandedSuggestions((v) => !v)}
                  className="mt-2 text-xs font-medium text-brand-green hover:underline"
                >
                  {expandedSuggestions
                    ? "Show fewer"
                    : `See all ${suggestions.length} suggested payments`}
                </button>
              )}
              <details className="mt-3 text-[11px] text-slate-500">
                <summary className="cursor-pointer hover:text-slate-700">
                  How does Record handle the amount?
                </summary>
                <ul className="mt-1.5 list-disc list-inside space-y-1 text-[11px] text-slate-500">
                  <li>
                    <strong>Less than the batch's remaining</strong>: accepted as a partial
                    payment. The batch stays "partially paid."
                  </li>
                  <li>
                    <strong>Equal to the batch's remaining</strong>: accepted. The batch result
                    is marked fully paid, and the batch rolls up to "paid" once every result is.
                  </li>
                  <li>
                    <strong>More than the batch's remaining</strong>: blocked with a
                    "Payment exceeds remaining balance" error. Split the amount across
                    multiple batches, or clear this batch first and create a new one for the
                    remainder.
                  </li>
                </ul>
              </details>
            </section>
          )}

          {/* Open batches */}
          {openBatches.length > 0 && (
            <section className="px-5 py-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Open settlement batches
              </h3>
              <ul className="space-y-1.5">
                {shownBatches.map((b) => {
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
              {openBatches.length > COLLAPSED_ROWS && (
                <button
                  type="button"
                  onClick={() => setExpandedBatches((v) => !v)}
                  className="mt-2 text-xs font-medium text-brand-green hover:underline"
                >
                  {expandedBatches
                    ? "Show fewer"
                    : `See all ${openBatches.length} open batches`}
                </button>
              )}
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
