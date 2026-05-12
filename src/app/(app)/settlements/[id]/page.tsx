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
import { DeletePaymentButton } from "./DeletePaymentButton";

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

  // Sign payment attachment URLs server-side.
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
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  // Group payment rows by result.
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
  const hasAnyPayment = totalPaid > 0.005;

  // Unique included expenses, newest first.
  const expenseRows = Array.from(new Set(items.map((i) => i.expense_id)));
  expenseRows.sort((a, b) => {
    const ea = expensesById.get(a);
    const eb = expensesById.get(b);
    if (!ea || !eb) return 0;
    return eb.expense_date.localeCompare(ea.expense_date);
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
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

      {/* Generated payments */}
      <div className="card p-0">
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
              const progressPct =
                Number(r.amount) > 0
                  ? Math.min(100, Math.round((Number(r.amount_paid) / Number(r.amount)) * 100))
                  : 0;
              return (
                <li key={r.id} className="px-5 py-4">
                  {/* Header: From → To · status · totals */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-brand-navy text-base">{fromName}</span>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                      <span className="font-semibold text-brand-navy text-base">{toName}</span>
                      <span className="ml-1">{statusBadge}</span>
                    </div>
                    <div className="flex items-baseline gap-x-4 gap-y-1 flex-wrap text-sm">
                      <span className="whitespace-nowrap">
                        <span className="text-slate-500">Total</span>{" "}
                        <span className="tabular-nums font-medium text-brand-navy">{formatMoney(Number(r.amount), r.currency)}</span>
                      </span>
                      <span className="whitespace-nowrap">
                        <span className="text-slate-500">Paid</span>{" "}
                        <span className="tabular-nums font-medium text-brand-green">{formatMoney(Number(r.amount_paid), r.currency)}</span>
                      </span>
                      <span className="whitespace-nowrap">
                        <span className="text-slate-500">Remaining</span>{" "}
                        <span className="tabular-nums font-semibold text-brand-navy">{formatMoney(Number(r.remaining_amount), r.currency)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Progress bar (visible when partially paid) */}
                  {progressPct > 0 && progressPct < 100 && (
                    <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full bg-brand-gradient"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  )}

                  {/* Payment history */}
                  {rPayments.length > 0 && (
                    <div className="mt-3 rounded-xl border border-slate-100 overflow-hidden">
                      <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Payment history ({rPayments.length})
                      </div>
                      <ul className="divide-y divide-slate-100">
                        {rPayments.map((p) => {
                          const proofUrl = attachmentUrls.get(p.id);
                          return (
                            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs">
                              <span className="text-slate-600 whitespace-nowrap">{formatDate(p.payment_date)}</span>
                              <span className="font-semibold tabular-nums whitespace-nowrap text-brand-navy">
                                {formatMoney(Number(p.amount), p.currency)}
                              </span>
                              {p.payment_method && <span className="text-slate-500 whitespace-nowrap">{p.payment_method}</span>}
                              {p.reference_number && <span className="text-slate-500 whitespace-nowrap">#{p.reference_number}</span>}
                              {p.notes && <span className="text-slate-500 truncate">— {p.notes}</span>}
                              <span className="ml-auto flex items-center gap-3">
                                {proofUrl && (
                                  <a
                                    href={proofUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-brand-green hover:underline"
                                  >
                                    <Paperclip className="h-3.5 w-3.5" />
                                    View
                                  </a>
                                )}
                                <DeletePaymentButton
                                  paymentId={p.id}
                                  amountLabel={formatMoney(Number(p.amount), p.currency)}
                                />
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Record payment action */}
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

      {/* Included expenses — per-profile share columns */}
      <div className="card p-0">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-brand-navy">Included expenses ({expenseRows.length})</h2>
        </div>
        {expenseRows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500 text-center">No expenses linked.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wide text-slate-600 whitespace-nowrap">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wide text-slate-600">Merchant</th>
                  <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wide text-slate-600 whitespace-nowrap">Category</th>
                  <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wide text-slate-600 whitespace-nowrap">Paid by</th>
                  <th className="px-4 py-2.5 text-right text-xs uppercase tracking-wide text-slate-600 whitespace-nowrap">Total</th>
                  {profiles.map((p) => (
                    <th
                      key={p.id}
                      className="px-4 py-2.5 text-right text-xs uppercase tracking-wide text-slate-600 whitespace-nowrap"
                    >
                      {p.display_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenseRows.map((eid) => {
                  const e = expensesById.get(eid);
                  if (!e) return null;
                  const cat = e.category_id ? categoriesById.get(e.category_id) : null;
                  const eItems = items.filter((i) => i.expense_id === eid);
                  const shareByUser = new Map(eItems.map((it) => [it.user_id, it]));
                  return (
                    <tr key={eid} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 border-b border-slate-100">
                        {formatDate(e.expense_date)}
                      </td>
                      <td className="px-4 py-3 font-medium text-brand-navy border-b border-slate-100">
                        <Link className="hover:text-brand-green" href={`/expenses/${e.id}`}>
                          {e.merchant}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border-b border-slate-100">
                        {cat ? <Badge color={colorForCategory(cat.name)}>{cat.name}</Badge> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 border-b border-slate-100">
                        {profilesById.get(e.paid_by_user_id)?.display_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-semibold border-b border-slate-100">
                        {formatMoney(Number(e.total_amount), e.currency)}
                      </td>
                      {profiles.map((p) => {
                        const item = shareByUser.get(p.id);
                        return (
                          <td
                            key={p.id}
                            className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-slate-700 border-b border-slate-100"
                          >
                            {item ? (
                              formatMoney(Number(item.share_amount), e.currency)
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
