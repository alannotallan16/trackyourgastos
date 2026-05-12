import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getCategories,
  getExpenseSplits,
  getExpenses,
  getProfiles,
  getSettlementDetail
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, colorForCategory } from "@/components/ui/Badge";
import { ArrowRight, ChevronLeft, Paperclip, TrendingUp, Wallet, Users } from "@/components/ui/icons";
import { formatDate, formatMoney } from "@/lib/format";
import { SettlementDetailActions } from "./SettlementDetailActions";
import { SettlementStatusBadge } from "../SettlementsClient";

export const dynamic = "force-dynamic";

const RECEIPTS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_RECEIPTS_BUCKET || "receipts";

export default async function SettlementDetailPage({ params }: { params: { id: string } }) {
  const [{ settlement, items, payments }, profiles, expenses, splits, categories] = await Promise.all([
    getSettlementDetail(params.id),
    getProfiles(),
    getExpenses(),
    getExpenseSplits(),
    getCategories()
  ]);
  if (!settlement) notFound();

  // Sign attachment URLs server-side for any payments that have proof-of-payment files.
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

  const fromName = profilesById.get(settlement.from_user_id)?.display_name ?? "—";
  const toName = profilesById.get(settlement.to_user_id)?.display_name ?? "—";

  // Settlements with no attached items are "household-net" settlements —
  // they represent the optimized cross-household payment without specific
  // expense-share attribution.
  const isNetSettlement = items.length === 0;
  // Detect bilateral: any item whose owner ≠ settlement.from_user_id means
  // this settlement has offsetting items (going the other direction).
  const isBilateral = items.some((item) => {
    const split = splitsById.get(item.expense_split_id);
    return split != null && split.user_id !== settlement.from_user_id;
  });
  const fullyOffset = Number(settlement.total_amount) <= 0.005;
  const canRecordPayment = settlement.status === "open" || settlement.status === "partially_paid";
  const canCancel = settlement.status !== "paid" && settlement.status !== "cancelled";

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <PageHeader
        title={`Settlement ${settlement.settlement_number}`}
        subtitle={
          fullyOffset
            ? `${fromName} ↔ ${toName} · fully offset · created ${formatDate(settlement.created_at.slice(0, 10))}`
            : `${fromName} → ${toName} · created ${formatDate(settlement.created_at.slice(0, 10))}`
        }
        actions={
          <Link href="/settlements" className="btn-ghost text-sm">
            <ChevronLeft className="h-4 w-4" />
            All settlements
          </Link>
        }
      />

      <div className="flex items-center gap-3 flex-wrap">
        <SettlementStatusBadge status={settlement.status} />
        {isNetSettlement ? <Badge color="green">Household net</Badge> : isBilateral && <Badge color="blue">Bilateral netting</Badge>}
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
          <h2 className="text-sm font-semibold text-brand-navy">
            {isNetSettlement ? "Reconciliation" : `Included expenses (${items.length})`}
          </h2>
        </div>
        {isNetSettlement ? (
          <div className="px-5 py-6 text-sm space-y-2">
            <p className="text-slate-700">
              <strong className="text-brand-navy">Household-net settlement.</strong> This is the optimized payment that reduces the overall household balance — no specific expense shares are attached.
            </p>
            <p className="text-slate-500 text-xs">
              When you record payment here, balances update directly. The underlying expense shares stay tagged as their original status; switch to <strong>Detailed</strong> mode on the settlements page when you want share-level reconciliation.
            </p>
          </div>
        ) : items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500 text-center">No items.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Date</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Merchant</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Category</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Direction</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Total</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Share</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const exp = expensesById.get(item.expense_id);
                const split = splitsById.get(item.expense_split_id);
                const cat = exp?.category_id ? categoriesById.get(exp.category_id) : null;
                const owerName = split ? profilesById.get(split.user_id)?.display_name ?? "—" : "—";
                const payerName = exp ? profilesById.get(exp.paid_by_user_id)?.display_name ?? "—" : "—";
                // An item is "offsetting" relative to the settlement's net direction
                // when its debtor isn't the settlement's from_user_id.
                const isOffset = split != null && split.user_id !== settlement.from_user_id;
                return (
                  <tr key={item.id} className={isOffset ? "bg-amber-50/40 hover:bg-amber-50" : "hover:bg-slate-50"}>
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
                    <td className="table-cell text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <span className={isOffset ? "text-amber-700 font-medium" : "font-medium"}>{owerName}</span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span className={isOffset ? "text-amber-700 font-medium" : "font-medium"}>{payerName}</span>
                        {isOffset && <Badge color="orange" className="ml-1">offset</Badge>}
                      </span>
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
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Proof</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const proofUrl = attachmentUrls.get(p.id);
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="table-cell whitespace-nowrap text-slate-600">{formatDate(p.payment_date)}</td>
                    <td className="table-cell text-right tabular-nums font-medium">
                      {formatMoney(Number(p.amount), p.currency)}
                    </td>
                    <td className="table-cell">{p.payment_method ?? "—"}</td>
                    <td className="table-cell text-slate-600">{p.reference_number ?? "—"}</td>
                    <td className="table-cell text-slate-600">{p.notes ?? ""}</td>
                    <td className="table-cell">
                      {proofUrl ? (
                        <a
                          href={proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-brand-green hover:underline text-xs font-medium"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          View
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
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
