"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import type { Category, Expense, ExpenseSplit, Profile, Settlement } from "@/lib/types";
import type { DebtSuggestion, UserBalance } from "@/lib/balances";
import { findUnpaidShares } from "@/lib/balances";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { ArrowRight, Plus, Users, Wallet } from "@/components/ui/icons";
import { CreateSettlementModal } from "./CreateSettlementModal";

interface Props {
  profiles: Profile[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  categories: Category[];
  settlements: Settlement[];
  balances: UserBalance[];
  suggestions: DebtSuggestion[];
}

const PERSON_ICON_BG = ["green", "blue", "purple"] as const;

interface DraftSeed {
  participant_a_id?: string;
  participant_b_id?: string;
  suggested_amount?: number;
}

export function SettlementsClient({
  profiles,
  expenses,
  splits,
  categories,
  settlements,
  balances,
  suggestions
}: Props) {
  const profilesById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const [draftSeed, setDraftSeed] = useState<DraftSeed | null>(null);

  const open = settlements.filter((s) => s.status === "open" || s.status === "partially_paid");
  const history = settlements.filter((s) => s.status === "paid" || s.status === "cancelled");

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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-brand-navy">Suggested settlements</h2>
          <button className="btn-primary text-sm" onClick={() => setDraftSeed({})}>
            <Plus className="h-4 w-4" />
            Create settlement
          </button>
        </div>
        {suggestions.length === 0 ? (
          <p className="text-sm text-slate-500">All balances reconciled.</p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s, i) => {
              const candidateCount = findUnpaidShares(expenses, splits, s.from_user_id, s.to_user_id).length;
              return (
                <li key={i} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-brand-navy">{profilesById.get(s.from_user_id)?.display_name}</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                    <span className="font-medium text-brand-navy">{profilesById.get(s.to_user_id)?.display_name}</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-slate-500">
                      <div className="tabular-nums font-semibold text-brand-danger">{formatMoney(s.amount)}</div>
                      <div>{candidateCount} unpaid share{candidateCount === 1 ? "" : "s"}</div>
                    </div>
                    <button
                      className="btn-secondary text-xs !px-3 !py-1.5"
                      onClick={() =>
                        setDraftSeed({
                          participant_a_id: s.from_user_id,
                          participant_b_id: s.to_user_id,
                          suggested_amount: s.amount
                        })
                      }
                    >
                      Create settlement
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-brand-navy">Open settlements</h2>
        </div>
        {open.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500 text-center">No open settlements.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Ref</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">From → To</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Total</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Paid</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Remaining</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Status</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Created</th>
              </tr>
            </thead>
            <tbody>
              {open.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="table-cell">
                    <Link className="font-medium text-brand-navy hover:text-brand-green" href={`/settlements/${s.id}`}>
                      {s.settlement_number}
                    </Link>
                  </td>
                  <td className="table-cell">
                    {profilesById.get(s.from_user_id)?.display_name} → {profilesById.get(s.to_user_id)?.display_name}
                  </td>
                  <td className="table-cell text-right tabular-nums">{formatMoney(Number(s.total_amount), s.currency)}</td>
                  <td className="table-cell text-right tabular-nums">{formatMoney(Number(s.amount_paid), s.currency)}</td>
                  <td className="table-cell text-right tabular-nums font-semibold">{formatMoney(Number(s.remaining_amount), s.currency)}</td>
                  <td className="table-cell"><SettlementStatusBadge status={s.status} /></td>
                  <td className="table-cell text-slate-600">{formatDate(s.created_at.slice(0, 10))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-brand-navy">Settlement history</h2>
        </div>
        {history.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500 text-center">No closed or cancelled settlements yet.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Ref</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">From → To</th>
                <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Total</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Status</th>
                <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Created</th>
              </tr>
            </thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="table-cell">
                    <Link className="font-medium text-brand-navy hover:text-brand-green" href={`/settlements/${s.id}`}>
                      {s.settlement_number}
                    </Link>
                  </td>
                  <td className="table-cell">
                    {profilesById.get(s.from_user_id)?.display_name} → {profilesById.get(s.to_user_id)?.display_name}
                  </td>
                  <td className="table-cell text-right tabular-nums">{formatMoney(Number(s.total_amount), s.currency)}</td>
                  <td className="table-cell"><SettlementStatusBadge status={s.status} /></td>
                  <td className="table-cell text-slate-600">{formatDate(s.created_at.slice(0, 10))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateSettlementModal
        open={draftSeed !== null}
        onClose={() => setDraftSeed(null)}
        profiles={profiles}
        expenses={expenses}
        splits={splits}
        categories={categories}
        initialParticipantAId={draftSeed?.participant_a_id}
        initialParticipantBId={draftSeed?.participant_b_id}
        suggestedAmount={draftSeed?.suggested_amount}
      />
    </div>
  );
}

export function SettlementStatusBadge({ status }: { status: Settlement["status"] }) {
  const map = {
    open: { color: "orange", label: "Open" },
    partially_paid: { color: "blue", label: "Partially paid" },
    paid: { color: "green", label: "Paid" },
    cancelled: { color: "gray", label: "Cancelled" }
  } as const;
  const cfg = map[status];
  return <Badge color={cfg.color as any}>{cfg.label}</Badge>;
}
