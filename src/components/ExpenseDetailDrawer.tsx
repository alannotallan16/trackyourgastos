"use client";

import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/format";
import type { Category, Expense, ExpenseSplit, Profile, SettlementBatch } from "@/lib/types";
import { Badge, colorForCategory } from "@/components/ui/Badge";
import { ArrowRight, Pencil, X } from "@/components/ui/icons";

interface Props {
  expense: Expense;
  splits: ExpenseSplit[];
  profiles: Profile[];
  categories: Category[];
  batches: SettlementBatch[];
  onClose: () => void;
}

const STATUS_BADGE = {
  unpaid: { color: "gray", label: "Unpaid" },
  in_settlement: { color: "orange", label: "In settlement" },
  settled: { color: "green", label: "Settled" }
} as const;

export function ExpenseDetailDrawer({
  expense,
  splits,
  profiles,
  categories,
  batches,
  onClose
}: Props) {
  const profilesById = new Map(profiles.map((p) => [p.id, p]));
  const batchesById = new Map(batches.map((b) => [b.id, b]));
  const category = expense.category_id ? categories.find((c) => c.id === expense.category_id) : null;
  const paidBy = profilesById.get(expense.paid_by_user_id);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end md:items-stretch md:justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Expense details for ${expense.merchant}`}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-brand-navy/40"
        onClick={onClose}
      />
      <div className="relative w-full md:w-[28rem] max-h-[90vh] md:max-h-none md:h-screen bg-white rounded-t-2xl md:rounded-none shadow-card-hover flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-brand-navy truncate">{expense.merchant}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatDate(expense.expense_date)} · paid by {paidBy?.display_name ?? "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-2xl font-semibold tabular-nums text-brand-navy">
              {formatMoney(Number(expense.total_amount), expense.currency)}
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {category && <Badge color={colorForCategory(category.name)}>{category.name}</Badge>}
              <span className="text-xs uppercase tracking-wide text-slate-400">{expense.currency}</span>
            </div>
          </div>

          {expense.notes && (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="block text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">Notes</span>
              {expense.notes}
            </div>
          )}

          <div>
            <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-2">
              Split by person
            </h3>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              {profiles.map((p) => {
                const s = splits.find((x) => x.user_id === p.id);
                if (!s) return null;
                const batch = s.settlement_batch_id ? batchesById.get(s.settlement_batch_id) : null;
                const badge = STATUS_BADGE[s.settlement_status];
                return (
                  <li key={p.id} className="px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-brand-navy">{p.display_name}</div>
                        <div className="text-xs text-slate-500 tabular-nums">
                          {formatMoney(Number(s.calculated_amount), expense.currency)}
                        </div>
                      </div>
                      <Badge color={badge.color as any}>{badge.label}</Badge>
                    </div>
                    {batch && (
                      <Link
                        href={`/settlements/${batch.id}`}
                        onClick={onClose}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-green hover:underline"
                      >
                        {batch.settlement_number}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
          <button type="button" className="btn-ghost text-sm" onClick={onClose}>
            Close
          </button>
          <Link href={`/expenses/${expense.id}`} className="btn-primary text-sm">
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </div>
      </div>
    </div>
  );
}
