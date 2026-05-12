"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import type {
  Category,
  Expense,
  ExpenseSplit,
  Profile,
  SettlementBatch,
  SettlementBatchResult
} from "@/lib/types";
import type { UserBalance } from "@/lib/balances";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Plus, Users, Wallet } from "@/components/ui/icons";
import { CreateBatchModal } from "./CreateBatchModal";

interface Props {
  profiles: Profile[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  categories: Category[];
  batches: SettlementBatch[];
  batchResults: SettlementBatchResult[];
  balances: UserBalance[];
}

const PERSON_ICON_BG = ["green", "blue", "purple"] as const;

export function SettlementsClient({
  profiles,
  expenses,
  splits,
  categories,
  batches,
  batchResults,
  balances
}: Props) {
  const profilesById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const [open, setOpen] = useState(false);

  // Aggregate results per batch for the list view.
  const resultsByBatch = useMemo(() => {
    const m = new Map<string, SettlementBatchResult[]>();
    for (const r of batchResults) {
      if (!m.has(r.settlement_batch_id)) m.set(r.settlement_batch_id, []);
      m.get(r.settlement_batch_id)!.push(r);
    }
    return m;
  }, [batchResults]);

  function batchTotals(batchId: string) {
    const rs = resultsByBatch.get(batchId) ?? [];
    let total = 0;
    let paid = 0;
    for (const r of rs) {
      total += Number(r.amount);
      paid += Number(r.amount_paid);
    }
    return { total, paid, remaining: Math.max(0, total - paid), count: rs.length };
  }

  const openBatches = batches.filter((b) => b.status === "open" || b.status === "partially_paid");
  const historyBatches = batches.filter((b) => b.status === "paid" || b.status === "cancelled");

  const hasUnsettledExpenses = useMemo(() => {
    const splitsByExpense = new Map<string, ExpenseSplit[]>();
    for (const s of splits) {
      if (!splitsByExpense.has(s.expense_id)) splitsByExpense.set(s.expense_id, []);
      splitsByExpense.get(s.expense_id)!.push(s);
    }
    return expenses.some((e) => {
      const sp = splitsByExpense.get(e.id) ?? [];
      return sp.length > 0 && sp.every((s) => s.settlement_status === "unpaid");
    });
  }, [expenses, splits]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {profiles.map((p, i) => {
          const b = balances.find((x) => x.user_id === p.id);
          const net = b?.net ?? 0;
          return (
            <StatCard
              key={p.id}
              label={`${p.display_name} net`}
              value={formatMoney(net)}
              hint={`Paid ${formatMoney(b?.paid ?? 0)} · Share ${formatMoney(b?.owed ?? 0)}`}
              tone={net > 0 ? "positive" : net < 0 ? "negative" : "default"}
              icon={i === 0 ? Wallet : Users}
              iconBg={PERSON_ICON_BG[i % PERSON_ICON_BG.length]}
            />
          );
        })}
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-brand-navy">Settlements</h2>
            <p className="text-xs text-slate-500">
              Pick a group of expenses and the app generates the minimum set of payments to reconcile them.
            </p>
          </div>
          <button
            className="btn-primary text-sm"
            onClick={() => setOpen(true)}
            disabled={!hasUnsettledExpenses}
            title={hasUnsettledExpenses ? "" : "No unsettled expenses to reconcile"}
          >
            <Plus className="h-4 w-4" />
            Create settlement
          </button>
        </div>
        {!hasUnsettledExpenses && (
          <p className="text-sm text-slate-500">All expenses are already in a settlement or settled.</p>
        )}
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-brand-navy">Open settlements</h2>
        </div>
        {openBatches.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500 text-center">No open settlements.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Ref</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Payments</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Total</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Paid</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Remaining</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Status</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Created</th>
              </tr>
            </thead>
            <tbody>
              {openBatches.map((b) => {
                const t = batchTotals(b.id);
                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="table-cell">
                      <Link className="font-medium text-brand-navy hover:text-brand-green" href={`/settlements/${b.id}`}>
                        {b.settlement_number}
                      </Link>
                    </td>
                    <td className="table-cell text-slate-600">{t.count}</td>
                    <td className="table-cell text-right tabular-nums">{formatMoney(t.total)}</td>
                    <td className="table-cell text-right tabular-nums">{formatMoney(t.paid)}</td>
                    <td className="table-cell text-right tabular-nums font-semibold">{formatMoney(t.remaining)}</td>
                    <td className="table-cell"><BatchStatusBadge status={b.status} /></td>
                    <td className="table-cell text-slate-600">{formatDate(b.created_at.slice(0, 10))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-brand-navy">Settlement history</h2>
        </div>
        {historyBatches.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500 text-center">No closed or cancelled settlements yet.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Ref</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Payments</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Total</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Status</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Created</th>
              </tr>
            </thead>
            <tbody>
              {historyBatches.map((b) => {
                const t = batchTotals(b.id);
                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="table-cell">
                      <Link className="font-medium text-brand-navy hover:text-brand-green" href={`/settlements/${b.id}`}>
                        {b.settlement_number}
                      </Link>
                    </td>
                    <td className="table-cell text-slate-600">{t.count}</td>
                    <td className="table-cell text-right tabular-nums">{formatMoney(t.total)}</td>
                    <td className="table-cell"><BatchStatusBadge status={b.status} /></td>
                    <td className="table-cell text-slate-600">{formatDate(b.created_at.slice(0, 10))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <CreateBatchModal
        open={open}
        onClose={() => setOpen(false)}
        profiles={profiles}
        expenses={expenses}
        splits={splits}
        categories={categories}
      />
    </div>
  );
}

export function BatchStatusBadge({ status }: { status: SettlementBatch["status"] }) {
  const map = {
    open: { color: "orange", label: "Open" },
    partially_paid: { color: "blue", label: "Partially paid" },
    paid: { color: "green", label: "Paid" },
    cancelled: { color: "gray", label: "Cancelled" }
  } as const;
  const cfg = map[status];
  return <Badge color={cfg.color as any}>{cfg.label}</Badge>;
}
