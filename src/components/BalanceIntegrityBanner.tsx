"use client";

import Link from "next/link";
import { useState } from "react";
import type { IntegrityReport } from "@/lib/balance-integrity";
import { formatDate, formatMoney } from "@/lib/format";

interface Props {
  report: IntegrityReport;
  /** Where "View all" should link — defaults to the Reports integrity section. */
  detailsHref?: string;
  /** Rows shown collapsed before "Show more". */
  previewRows?: number;
}

/**
 * Amber banner shown on the Dashboard when some expense's splits don't sum
 * to its total. Collapsed by default; expand to see the first few rows and
 * link each to its edit screen. Full list lives in Reports.
 */
export function BalanceIntegrityBanner({
  report,
  detailsHref = "/reports#integrity",
  previewRows = 5
}: Props) {
  const [open, setOpen] = useState(false);
  if (!report.hasIssues) return null;

  const rows = report.brokenExpenses.slice(0, previewRows);
  const extra = Math.max(0, report.brokenExpenses.length - rows.length);

  return (
    <div
      role="alert"
      className="rounded-2xl border border-amber-300 bg-amber-50 text-amber-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-start gap-2 min-w-0">
          <span aria-hidden="true" className="mt-0.5 text-amber-600">⚠︎</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {report.brokenExpenses.length} expense
              {report.brokenExpenses.length === 1 ? "" : "s"} with mismatched or missing splits
            </p>
            <p className="text-xs">
              Total discrepancy{" "}
              <strong className="tabular-nums">{formatMoney(report.totalDiscrepancy)}</strong>.
              This is why the per-person net balances don't add up to zero.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-md border border-amber-300 bg-white/50 px-2.5 py-1 text-xs font-medium hover:bg-white"
          aria-expanded={open}
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open && (
        <div className="border-t border-amber-200/80 px-4 py-3">
          <ul className="divide-y divide-amber-200/70">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/expenses/${r.id}`}
                    className="font-medium text-amber-900 hover:underline"
                  >
                    {r.merchant}
                  </Link>{" "}
                  <span className="text-amber-700">· {formatDate(r.expense_date)}</span>
                  <div className="mt-0.5 text-amber-800/80 tabular-nums">
                    total {formatMoney(r.total_amount, r.currency)} · split sum{" "}
                    {formatMoney(r.split_sum, r.currency)}
                    {r.split_count === 0 ? " (no splits)" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="tabular-nums font-semibold">
                    {r.discrepancy > 0 ? "+" : ""}
                    {formatMoney(r.discrepancy, r.currency)}
                  </span>
                  <Link
                    href={`/expenses/${r.id}`}
                    className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {extra > 0 && (
            <div className="mt-2 text-xs">
              <Link href={detailsHref} className="font-medium underline hover:no-underline">
                View all {report.brokenExpenses.length} in Reports →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
