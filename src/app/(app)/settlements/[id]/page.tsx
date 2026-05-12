import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getBatchDetail,
  getCategories,
  getExpenseSplits,
  getExpenses,
  getProfiles
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, colorForCategory } from "@/components/ui/Badge";
import { ArrowRight, ChevronLeft, Paperclip, TrendingUp, Wallet, Users } from "@/components/ui/icons";
import { formatDate, formatMoney } from "@/lib/format";
import { BatchDetailActions } from "./BatchDetailActions";
import { BatchStatusBadge } from "../SettlementsClient";

export const dynamic = "force-dynamic";

const RECEIPTS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_RECEIPTS_BUCKET || "receipts";

export default async function BatchDetailPage({ params }: { params: { id: string } }) {
  const [{ batch, items, results, payments }, profiles, expenses, splits, categories] = await Promise.all([
    getBatchDetail(params.id),
    getProfiles(),
    getExpenses(),
    getExpenseSplits(),
    getCategories()
  ]);
  if (!batch) notFound();

  const supabase = createClient();
  const attachmentUrls = new Map<string, string>();
  await Promise.all(
    payments
      .filter((p) => p.attachment_path)
      .map(async (p) => {
        const { data } = await supabase.storage
          .from(RECEIPTS_BUCKET)
          .createSignedUrl(p.attachment_path as string, 60 * 30);
        if (data?.signedUrl) attachmentUrls.set(p.id, data.signedUrl);
      })
  );

  const profilesById = new Map(profiles.map((p) => [p.id, p]));
  const expensesById = new Map(expenses.map((e) => [e.id, e]));
  const splitsById = new Map(splits.map((s) => [s.id, s]));
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  // Group payment rows by result for easier rendering.
  const paymentsByResult = new Map<string, typeof payments>();
  for (const p of payments) {
    if (!paymentsByResult.has(p.settlement_batch_result_id)) {
      paymentsByResult.set(p.settlement_batch_result_id, []);
    }
    paymentsByResult.get(p.settlement_batch_result_id)!.push(p);
  }

  const totalAmount = results.reduce((s, r) => s + Number(r.amount), 0);
  const totalPaid = results.reduce((s, r) => s + Number(r.amount_paid), 0);
  const totalRemaining = Math.max(0, totalAmount - totalPaid);

  const canCancel = batch.status === "open" || batch.status === "partially_paid";
  // Cancel is blocked at the server level if any payment exists, but reflect
  // it client-side too so the button stays disabled when it would fail.
  const hasAnyPayment = totalPaid > 0.005;

  // Group items by expense for the "Included expenses" table.
  const expenseRows = Array.from(new Set(items.map((i) => i.expense_id)));
  expenseRows.sort((a, b) => {
    const ea = expensesById.get(a);
    const eb = expensesById.get(b);
    if (!ea || !eb) return 0;
    return eb.expense_date.localeCompare(ea.expense_date);
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <PageHeader
        title={`Settlement ${batch.settlement_number}`}
        subtitle={`${expenseRows.length} expense${expenseRows.length === 1 ? "" : "s"} · ${results.length} payment${results.length === 1 ? "" : "s"} · created ${formatDate(batch.created_at.slice(0, 10))}`}
        actions={
          <Link href="/settlements" className="btn-ghost text-sm">
            <ChevronLeft className="h-4 w-4" />
            All settlements
          </Link>
        }
      />

      <div className="flex items-center gap-3 flex-wrap">
        <BatchStatusBadge status={batch.status} />
        {batch.notes && <span className="text-sm text-slate-500">{batch.notes}</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total to settle"
          value={formatMoney(totalAmount)}
          icon={TrendingUp}
          iconBg="navy"
        />
        <StatCard
          label="Paid so far"
          value={formatMoney(totalPaid)}
          tone={totalPaid > 0 ? "positive" : "default"}
          icon={Wallet}
          iconBg="green"
        />
        <StatCard
          label="Remaining"
          value={formatMoney(totalRemaining)}
          tone={totalRemaining > 0 ? "negative" : "default"}
          icon={Users}
          iconBg="blue"
        />
      </div>

      <BatchDetailActions batchId={batch.id} canCancel={canCancel} hasAnyPayment={hasAnyPayment} />

      {/* Generated payments (one per result) */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-brand-navy">Generated payments ({results.length})</h2>
        </div>
        {results.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500 text-center">No payments generated.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {results.map((r) => {
              const fromName = profilesById.get(r.from_user_id)?.display_name ?? "—";
              const toName = profilesById.get(r.to_user_id)?.display_name ?? "—";
              const rPayments = paymentsByResult.get(r.id) ?? [];
              const statusBadge =
                r.status === "paid"
                  ? <Badge color="green">Paid</Badge>
                  : r.status === "partially_paid"
                    ? <Badge color="blue">Partially paid</Badge>
                    : <Badge color="orange">Open</Badge>;
              return (
                <li key={r.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-brand-navy">{fromName}</span>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                      <span className="font-medium text-brand-navy">{toName}</span>
                      <span className="ml-2">{statusBadge}</span>
                    </div>
                    <div className="flex items-baseline gap-3 text-sm">
                      <span className="text-slate-500">Total</span>
                      <span className="tabular-nums text-brand-navy">{formatMoney(Number(r.amount), r.currency)}</span>
                      <span className="text-slate-500">Paid</span>
                      <span className="tabular-nums">{formatMoney(Number(r.amount_paid), r.currency)}</span>
                      <span className="text-slate-500">Remaining</span>
                      <span className="tabular-nums font-semibold">{formatMoney(Number(r.remaining_amount), r.currency)}</span>
                    </div>
                  </div>

                  {/* Payment history per result */}
                  {rPayments.length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs">
                      {rPayments.map((p) => {
                        const proofUrl = attachmentUrls.get(p.id);
                        return (
                          <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-1.5">
                            <span className="text-slate-600">{formatDate(p.payment_date)}</span>
                            <span className="font-medium tabular-nums">{formatMoney(Number(p.amount), p.currency)}</span>
                            {p.payment_method && <span className="text-slate-500">{p.payment_method}</span>}
                            {p.reference_number && <span className="text-slate-500">#{p.reference_number}</span>}
                            {p.notes && <span className="text-slate-500">— {p.notes}</span>}
                            {proofUrl && (
                              <a
                                href={proofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-brand-green hover:underline ml-auto"
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                                View
                              </a>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {/* Record-payment action lives on the actions row above; for
                       per-result granularity, surface a Record button inline
                       when this result still has remaining. */}
                  {r.status !== "paid" && batch.status !== "cancelled" && (
                    <div className="mt-3">
                      <BatchDetailActions
                        batchId={batch.id}
                        resultId={r.id}
                        remaining={Number(r.remaining_amount)}
                        currency={r.currency}
                        canCancel={false}
                        hasAnyPayment={false}
                        inline
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Included expenses */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-brand-navy">Included expenses ({expenseRows.length})</h2>
        </div>
        {expenseRows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500 text-center">No expenses linked.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Date</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Merchant</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Category</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Paid by</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Total</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Shares</th>
              </tr>
            </thead>
            <tbody>
              {expenseRows.map((eid) => {
                const e = expensesById.get(eid);
                if (!e) return null;
                const cat = e.category_id ? categoriesById.get(e.category_id) : null;
                const eItems = items.filter((i) => i.expense_id === eid);
                return (
                  <tr key={eid} className="hover:bg-slate-50">
                    <td className="table-cell whitespace-nowrap text-slate-600">{formatDate(e.expense_date)}</td>
                    <td className="table-cell font-medium">
                      <Link className="hover:text-brand-green" href={`/expenses/${e.id}`}>
                        {e.merchant}
                      </Link>
                    </td>
                    <td className="table-cell">
                      {cat ? <Badge color={colorForCategory(cat.name)}>{cat.name}</Badge> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="table-cell text-slate-600">
                      {profilesById.get(e.paid_by_user_id)?.display_name ?? "—"}
                    </td>
                    <td className="table-cell text-right tabular-nums font-medium">
                      {formatMoney(Number(e.total_amount), e.currency)}
                    </td>
                    <td className="table-cell text-xs text-slate-600">
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {eItems.map((it) => {
                          const u = profilesById.get(it.user_id);
                          return (
                            <span key={it.id}>
                              <span className="text-slate-400">{u?.short_name ?? "?"}</span>{" "}
                              <span className="tabular-nums">{formatMoney(Number(it.share_amount), e.currency)}</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
