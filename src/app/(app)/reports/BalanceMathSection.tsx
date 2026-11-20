import Link from "next/link";
import type { BalanceMathReport } from "@/lib/balance-math";
import { formatMoney } from "@/lib/format";

/**
 * A plain breakdown of how each person's net is composed:
 *
 *   paid    = expenses_paid     + settlement_sent
 *   owed    = share_of_expenses + settlement_received
 *   net     = paid − owed
 *
 * Settlement impact is shown as the last column: how much each user's net
 * moves because of settlement payments. If this column is non-zero, the
 * code IS counting settlement payments. If it's zero everywhere, either no
 * payments were recorded or the computeBalances step is skipping them.
 *
 * A separate section lists any batch whose claimed amount_paid doesn't
 * match the sum of settlement_payments rows attached to its results — the
 * "marked paid without recording a payment" case.
 */
export function BalanceMathSection({ report }: { report: BalanceMathReport }) {
  const anyBatchMismatch = report.batch_payment_mismatches.length > 0;

  return (
    <section id="balance-math" className="card p-0 overflow-hidden scroll-mt-24">
      <div className="px-5 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-brand-navy">Balance math audit</h2>
        <p className="text-xs text-slate-500">
          Each person's net, decomposed. Settlement sent and received are what we add on
          top of the expense-side numbers to arrive at the displayed net.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Member</th>
              <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Expenses paid</th>
              <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">+ Settlement sent</th>
              <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">= Paid</th>
              <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Share of expenses</th>
              <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">+ Settlement received</th>
              <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">= Owed</th>
              <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Net</th>
              <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">
                Settlement impact
                <span className="block font-normal normal-case tracking-normal text-slate-400">
                  (sent − received)
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {report.users.map((u) => {
              const impact = report.settlement_impact.find((s) => s.user_id === u.user_id);
              return (
                <tr key={u.user_id} className="hover:bg-slate-50">
                  <td className="table-cell font-medium text-brand-navy">{u.display_name}</td>
                  <td className="table-cell text-right tabular-nums text-slate-700">{formatMoney(u.expenses_paid)}</td>
                  <td className="table-cell text-right tabular-nums text-brand-blue">+ {formatMoney(u.settlement_sent)}</td>
                  <td className="table-cell text-right tabular-nums font-semibold text-brand-navy">{formatMoney(u.paid)}</td>
                  <td className="table-cell text-right tabular-nums text-slate-700">{formatMoney(u.share_of_expenses)}</td>
                  <td className="table-cell text-right tabular-nums text-brand-blue">+ {formatMoney(u.settlement_received)}</td>
                  <td className="table-cell text-right tabular-nums font-semibold text-brand-navy">{formatMoney(u.owed)}</td>
                  <td className={`table-cell text-right tabular-nums font-semibold ${u.net > 0.005 ? "text-emerald-700" : u.net < -0.005 ? "text-red-600" : "text-slate-600"}`}>
                    {u.net > 0.005 ? "+" : ""}
                    {formatMoney(u.net)}
                  </td>
                  <td
                    className={`table-cell text-right tabular-nums ${
                      Math.abs(impact?.delta ?? 0) < 0.01 ? "text-slate-400" : "text-brand-navy"
                    }`}
                  >
                    {Math.abs(impact?.delta ?? 0) < 0.01 ? "₱0.00" : (impact!.delta > 0 ? "+" : "") + formatMoney(impact!.delta)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 text-xs text-slate-600">
              <td className="table-cell font-medium">Household</td>
              <td className="table-cell text-right tabular-nums">{formatMoney(report.expenses_total)}</td>
              <td className="table-cell text-right tabular-nums">{formatMoney(report.settlement_payments_total)}</td>
              <td className="table-cell text-right tabular-nums font-semibold">{formatMoney(report.sum_paid)}</td>
              <td className="table-cell text-right tabular-nums">{formatMoney(report.expenses_total)}</td>
              <td className="table-cell text-right tabular-nums">{formatMoney(report.settlement_payments_total)}</td>
              <td className="table-cell text-right tabular-nums font-semibold">{formatMoney(report.sum_share)}</td>
              <td className={`table-cell text-right tabular-nums font-semibold ${Math.abs(report.sum_net) < 0.01 ? "text-brand-green" : "text-red-600"}`}>
                {formatMoney(report.sum_net)}
              </td>
              <td className="table-cell text-right tabular-nums">—</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
        <p>
          <strong>Reading this table:</strong> if the <em>Settlement impact</em> column is non-zero for anyone,
          the dashboard's net IS counting their settlement payments. If a person had ₱X in payments
          sent and ₱Y received, impact = X − Y, and that's exactly how much their net differs from
          the "ignore all settlements" counterfactual.
        </p>
        <p>
          <strong>Batches by status:</strong>{" "}
          {Object.entries(report.batches_by_status)
            .map(([k, v]) => `${k} ${v}`)
            .join(" · ") || "no batches"}
        </p>
      </div>

      {/* Batch mismatch panel */}
      <div className="border-t border-slate-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-brand-navy">Batch payment integrity</h3>
        <p className="text-xs text-slate-500">
          For each batch, do the recorded payments (settlement_payments rows) sum to what the
          batch_results claim as amount_paid?
        </p>
        {anyBatchMismatch ? (
          <table className="mt-2 min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Ref</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Status</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Claimed paid</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Recorded paid</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Discrepancy</th>
                <th className="table-cell"></th>
              </tr>
            </thead>
            <tbody>
              {report.batch_payment_mismatches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="table-cell">
                    <Link
                      href={`/settlements/${b.id}`}
                      className="font-medium text-brand-navy hover:text-brand-green"
                    >
                      {b.settlement_number}
                    </Link>
                  </td>
                  <td className="table-cell text-slate-600">{b.status}</td>
                  <td className="table-cell text-right tabular-nums">{formatMoney(b.claimed_paid)}</td>
                  <td className="table-cell text-right tabular-nums">{formatMoney(b.recorded_paid)}</td>
                  <td className={`table-cell text-right tabular-nums font-semibold ${b.discrepancy > 0 ? "text-brand-danger" : "text-brand-blue"}`}>
                    {b.discrepancy > 0 ? "+" : ""}
                    {formatMoney(b.discrepancy)}
                  </td>
                  <td className="table-cell text-right">
                    <Link href={`/settlements/${b.id}`} className="text-xs text-brand-green hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-sm text-brand-green">
            Every batch's claimed amount_paid matches the sum of its recorded payment rows.
          </p>
        )}
      </div>

      {/* Unsettled-expense effect per person */}
      <div className="border-t border-slate-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-brand-navy">
          Unsettled expense effect per person
        </h3>
        <p className="text-xs text-slate-500">
          Restricted to expenses whose <em>every</em> split is still{" "}
          <code>unpaid</code> — i.e. not yet included in any batch. Sum of
          nets must be zero (expenses redistribute money inside the household).
        </p>
        <table className="mt-2 min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">
                Member
              </th>
              <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">
                Paid
              </th>
              <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">
                Share
              </th>
              <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">
                Net
              </th>
            </tr>
          </thead>
          <tbody>
            {report.users.map((u) => (
              <tr key={u.user_id} className="hover:bg-slate-50">
                <td className="table-cell font-medium text-brand-navy">{u.display_name}</td>
                <td className="table-cell text-right tabular-nums text-slate-700">
                  {formatMoney(u.unsettled_paid)}
                </td>
                <td className="table-cell text-right tabular-nums text-slate-700">
                  {formatMoney(u.unsettled_share)}
                </td>
                <td
                  className={`table-cell text-right tabular-nums font-semibold ${
                    u.unsettled_net > 0.005
                      ? "text-emerald-700"
                      : u.unsettled_net < -0.005
                        ? "text-red-600"
                        : "text-slate-600"
                  }`}
                >
                  {u.unsettled_net > 0.005 ? "+" : ""}
                  {formatMoney(u.unsettled_net)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 text-xs text-slate-600">
              <td className="table-cell font-medium">Sum of nets</td>
              <td className="table-cell"></td>
              <td className="table-cell"></td>
              <td
                className={`table-cell text-right tabular-nums font-semibold ${
                  Math.abs(report.unsettled_sum_net) < 0.01 ? "text-brand-green" : "text-red-600"
                }`}
              >
                {formatMoney(report.unsettled_sum_net)}
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-2 text-xs text-slate-500">
          Mixed-status expenses excluded:{" "}
          <strong>
            {report.mixed_status_expenses_count === 0
              ? "None"
              : report.mixed_status_expenses_count}
          </strong>
          {report.mixed_status_expenses_count > 0 && (
            <>
              {" "}
              <span className="text-slate-400">
                (some splits unpaid, others in a batch or settled — these are
                skipped because partial inclusion would break the per-person
                sum-to-zero check).
              </span>
            </>
          )}
        </p>
      </div>

      {/* Write-side check: can we rederive each batch's results from its items? */}
      <div className="border-t border-slate-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-brand-navy">Batch creation integrity</h3>
        <p className="text-xs text-slate-500">
          For each batch, do the stored <code>settlement_batch_results</code> match what
          <code> createSettlementBatch</code> would generate right now from its items snapshot?
          A mismatch here means either the batch was created by an older (buggy) code path or
          its results were edited by hand.
        </p>
        {report.batch_recompute_issues.length === 0 ? (
          <p className="mt-2 text-sm text-brand-green">
            Every batch's stored results match what we'd regenerate from its items.
          </p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {report.batch_recompute_issues.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 text-sm text-amber-900">
                  <Link
                    href={`/settlements/${row.id}`}
                    className="font-semibold hover:underline"
                  >
                    {row.settlement_number}
                  </Link>
                  <span className="text-xs text-amber-700">{row.status}</span>
                </div>
                <ul className="mt-1 list-disc list-inside text-xs text-amber-900/90 space-y-0.5">
                  {row.issues.map((i, k) => (
                    <li key={k}>
                      <span className="uppercase text-[10px] tracking-wide font-semibold mr-1 text-amber-700">
                        {i.kind.replace(/_/g, " ")}
                      </span>
                      {i.note}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
