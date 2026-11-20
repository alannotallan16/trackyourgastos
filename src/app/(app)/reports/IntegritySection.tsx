import Link from "next/link";
import type { IntegrityReport } from "@/lib/balance-integrity";
import { formatDate, formatMoney } from "@/lib/format";

/**
 * Full list of expenses with mismatched or missing splits. Anchored at
 * #integrity so the Dashboard banner can deep-link here.
 */
export function IntegritySection({ report }: { report: IntegrityReport }) {
  return (
    <section id="integrity" className="card p-0 overflow-hidden scroll-mt-24">
      <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-brand-navy">Balance integrity</h2>
          <p className="text-xs text-slate-500">
            Each expense's splits should sum to its total. Rows below don't, which is
            why the household's per-person net balances won't add up to zero.
          </p>
        </div>
        {report.hasIssues ? (
          <span className="text-xs tabular-nums text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
            {report.brokenExpenses.length} row{report.brokenExpenses.length === 1 ? "" : "s"} ·{" "}
            {formatMoney(report.totalDiscrepancy)}
          </span>
        ) : (
          <span className="text-xs text-brand-green bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
            All clean
          </span>
        )}
      </div>

      {report.hasIssues ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Date</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Merchant</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Total</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Split sum</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Discrepancy</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Splits</th>
                <th className="table-cell"></th>
              </tr>
            </thead>
            <tbody>
              {report.brokenExpenses.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="table-cell whitespace-nowrap text-slate-600">{formatDate(r.expense_date)}</td>
                  <td className="table-cell">
                    <Link className="font-medium text-brand-navy hover:text-brand-green" href={`/expenses/${r.id}`}>
                      {r.merchant}
                    </Link>
                  </td>
                  <td className="table-cell text-right tabular-nums">{formatMoney(r.total_amount, r.currency)}</td>
                  <td className="table-cell text-right tabular-nums">{formatMoney(r.split_sum, r.currency)}</td>
                  <td
                    className={`table-cell text-right tabular-nums font-semibold ${
                      r.discrepancy > 0 ? "text-brand-danger" : "text-brand-blue"
                    }`}
                  >
                    {r.discrepancy > 0 ? "+" : ""}
                    {formatMoney(r.discrepancy, r.currency)}
                  </td>
                  <td className="table-cell text-right text-xs text-slate-500">{r.split_count}</td>
                  <td className="table-cell text-right">
                    <Link
                      href={`/expenses/${r.id}`}
                      className="text-xs font-medium text-brand-green hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50">
                <td className="table-cell text-xs text-slate-500" colSpan={4}>
                  Signed discrepancy (should match Σ nets): <strong className="tabular-nums">{formatMoney(report.signedDiscrepancy)}</strong>
                </td>
                <td className="table-cell text-right tabular-nums text-xs text-slate-600" colSpan={3}>
                  Σ |diff| {formatMoney(report.totalDiscrepancy)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="px-5 py-6 text-sm text-slate-500 text-center">
          Every expense's splits sum to its total. Per-person nets add up to zero.
        </p>
      )}
    </section>
  );
}
