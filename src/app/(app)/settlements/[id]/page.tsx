import { notFound } from "next/navigation";
import Link from "next/link";
import { getCategories, getExpenses, getProfiles, getSettlementDetail } from "@/lib/data";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, colorForCategory } from "@/components/ui/Badge";
import { ChevronLeft, TrendingUp, Wallet, Users } from "@/components/ui/icons";
import { formatDate, formatMoney } from "@/lib/format";
import { SettlementDetailActions } from "./SettlementDetailActions";
import { SettlementStatusBadge } from "../SettlementsClient";

export const dynamic = "force-dynamic";

export default async function SettlementDetailPage({ params }: { params: { id: string } }) {
  const [{ settlement, items, payments }, profiles, expenses, categories] = await Promise.all([
    getSettlementDetail(params.id),
    getProfiles(),
    getExpenses(),
    getCategories()
  ]);
  if (!settlement) notFound();

  const profilesById = new Map(profiles.map((p) => [p.id, p]));
  const expensesById = new Map(expenses.map((e) => [e.id, e]));
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  const fromName = profilesById.get(settlement.from_user_id)?.display_name ?? "—";
  const toName = profilesById.get(settlement.to_user_id)?.display_name ?? "—";
  const canRecordPayment = settlement.status === "open" || settlement.status === "partially_paid";
  const canCancel = settlement.status !== "paid" && settlement.status !== "cancelled";

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <PageHeader
        title={`Settlement ${settlement.settlement_number}`}
        subtitle={`${fromName} → ${toName} · created ${formatDate(settlement.created_at.slice(0, 10))}`}
        actions={
          <Link href="/settlements" className="btn-ghost text-sm">
            <ChevronLeft className="h-4 w-4" />
            All settlements
          </Link>
        }
      />

      <div className="flex items-center gap-3">
        <SettlementStatusBadge status={settlement.status} />
        {settlement.notes && <span className="text-sm text-slate-500">{settlement.notes}</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total"
          value={formatMoney(Number(settlement.total_amount), settlement.currency)}
          icon={TrendingUp}
          iconBg="navy"
        />
        <StatCard
          label="Paid"
          value={formatMoney(Number(settlement.amount_paid), settlement.currency)}
          tone={Number(settlement.amount_paid) > 0 ? "positive" : "default"}
          icon={Wallet}
          iconBg="green"
        />
        <StatCard
          label="Remaining"
          value={formatMoney(Number(settlement.remaining_amount), settlement.currency)}
          tone={Number(settlement.remaining_amount) > 0 ? "negative" : "default"}
          icon={Users}
          iconBg="blue"
        />
      </div>

      <SettlementDetailActions
        settlementId={settlement.id}
        remaining={Number(settlement.remaining_amount)}
        currency={settlement.currency}
        canRecordPayment={canRecordPayment}
        canCancel={canCancel}
      />

      <div className="card overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-brand-navy">Included expenses ({items.length})</h2>
        </div>
        {items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500 text-center">No items.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Date</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Merchant</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Category</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Total</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Share</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const exp = expensesById.get(item.expense_id);
                const cat = exp?.category_id ? categoriesById.get(exp.category_id) : null;
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="table-cell whitespace-nowrap text-slate-600">
                      {exp ? formatDate(exp.expense_date) : "—"}
                    </td>
                    <td className="table-cell font-medium">
                      {exp ? (
                        <Link className="hover:text-brand-green" href={`/expenses/${exp.id}`}>
                          {exp.merchant}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="table-cell">
                      {cat ? <Badge color={colorForCategory(cat.name)}>{cat.name}</Badge> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="table-cell text-right tabular-nums text-slate-600">
                      {exp ? formatMoney(Number(exp.total_amount), exp.currency) : "—"}
                    </td>
                    <td className="table-cell text-right tabular-nums font-medium">
                      {formatMoney(Number(item.amount), settlement.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-brand-navy">Payment history ({payments.length})</h2>
        </div>
        {payments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500 text-center">No payments recorded yet.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Date</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Amount</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Method</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Reference</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Notes</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="table-cell whitespace-nowrap text-slate-600">{formatDate(p.payment_date)}</td>
                  <td className="table-cell text-right tabular-nums font-medium">
                    {formatMoney(Number(p.amount), p.currency)}
                  </td>
                  <td className="table-cell">{p.payment_method ?? "—"}</td>
                  <td className="table-cell text-slate-600">{p.reference_number ?? "—"}</td>
                  <td className="table-cell text-slate-600">{p.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
