"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createNetSettlement } from "./actions";
import { formatDate, formatMoney } from "@/lib/format";
import type { Category, Expense, ExpenseSplit, Profile, Settlement } from "@/lib/types";
import type { DebtSuggestion, UserBalance } from "@/lib/balances";
import { findUnpaidShares } from "@/lib/balances";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { ArrowRight, Plus, Users, Wallet, X } from "@/components/ui/icons";
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

type Mode = "quick" | "detailed";

interface BilateralDraft {
  participant_a_id?: string;
  participant_b_id?: string;
  suggested_amount?: number;
}

interface QuickDraft {
  from_user_id: string;
  to_user_id: string;
  amount: number;
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
  const router = useRouter();
  const profilesById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const [mode, setMode] = useState<Mode>("quick");
  const [bilateralDraft, setBilateralDraft] = useState<BilateralDraft | null>(null);
  const [quickDraft, setQuickDraft] = useState<QuickDraft | null>(null);
  const [quickNotes, setQuickNotes] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const open = settlements.filter((s) => s.status === "open" || s.status === "partially_paid");
  const history = settlements.filter((s) => s.status === "paid" || s.status === "cancelled");

  function handleSuggestedCreate(s: DebtSuggestion) {
    setErr(null);
    if (mode === "quick") {
      setQuickNotes("");
      setQuickDraft({ from_user_id: s.from_user_id, to_user_id: s.to_user_id, amount: s.amount });
    } else {
      setBilateralDraft({
        participant_a_id: s.from_user_id,
        participant_b_id: s.to_user_id,
        suggested_amount: s.amount
      });
    }
  }

  function submitQuick(e: React.FormEvent) {
    e.preventDefault();
    if (!quickDraft) return;
    setErr(null);
    start(async () => {
      try {
        const { id } = await createNetSettlement({
          from_user_id: quickDraft.from_user_id,
          to_user_id: quickDraft.to_user_id,
          amount: quickDraft.amount,
          currency: "PHP",
          notes: quickNotes || null
        });
        setQuickDraft(null);
        router.push(`/settlements/${id}`);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to create settlement.");
      }
    });
  }

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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-brand-navy">Suggested settlements</h2>
            <p className="text-xs text-slate-500">
              {mode === "quick"
                ? "Minimum-transactions payments across the whole household."
                : "Reconcile expense shares between two people in detail."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle mode={mode} onChange={setMode} />
            {mode === "detailed" && (
              <button className="btn-primary text-sm" onClick={() => setBilateralDraft({})}>
                <Plus className="h-4 w-4" />
                Create settlement
              </button>
            )}
          </div>
        </div>
        {suggestions.length === 0 ? (
          <p className="text-sm text-slate-500">All balances reconciled.</p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s, i) => {
              const candidateCount = findUnpaidShares(expenses, splits, s.from_user_id, s.to_user_id).length;
              return (
                <li
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-brand-navy">{profilesById.get(s.from_user_id)?.display_name}</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                    <span className="font-medium text-brand-navy">{profilesById.get(s.to_user_id)?.display_name}</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-slate-500">
                      <div className="tabular-nums font-semibold text-brand-danger">{formatMoney(s.amount)}</div>
                      {mode === "detailed" && (
                        <div>
                          {candidateCount} unpaid share{candidateCount === 1 ? "" : "s"} between them
                        </div>
                      )}
                    </div>
                    <button
                      className="btn-secondary text-xs !px-3 !py-1.5"
                      onClick={() => handleSuggestedCreate(s)}
                    >
                      {mode === "quick" ? "Create" : "Pick shares…"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {mode === "quick" && (
          <p className="mt-3 text-xs text-slate-500">
            Quick mode creates the settlement at the suggested global-net amount with no expense-share attachment. Recording payment reduces balances directly. Switch to{" "}
            <button type="button" onClick={() => setMode("detailed")} className="text-brand-green underline hover:no-underline">Detailed</button>{" "}
            to pick specific shares.
          </p>
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

      {/* Detailed (bilateral) modal */}
      <CreateSettlementModal
        open={bilateralDraft !== null}
        onClose={() => setBilateralDraft(null)}
        profiles={profiles}
        expenses={expenses}
        splits={splits}
        categories={categories}
        initialParticipantAId={bilateralDraft?.participant_a_id}
        initialParticipantBId={bilateralDraft?.participant_b_id}
        suggestedAmount={bilateralDraft?.suggested_amount}
      />

      {/* Quick (household-net) confirm */}
      {quickDraft && (
        <div className="fixed inset-0 bg-brand-navy/40 flex items-end md:items-center justify-center p-4 z-40">
          <form
            className="bg-white rounded-2xl shadow-card-hover w-full max-w-md p-5 space-y-3"
            onSubmit={submitQuick}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg text-brand-navy">Create settlement</h2>
              <button type="button" onClick={() => setQuickDraft(null)} aria-label="Close">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="rounded-xl bg-emerald-50/60 border border-emerald-200 px-3 py-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-brand-navy">
                  <span className="font-medium">{profilesById.get(quickDraft.from_user_id)?.display_name}</span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                  <span className="font-medium">{profilesById.get(quickDraft.to_user_id)?.display_name}</span>
                </div>
                <div className="text-lg font-semibold tabular-nums text-brand-navy">
                  {formatMoney(quickDraft.amount)}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Household-net settlement. No specific expense shares are attached; recording payment reduces balances directly.
              </p>
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <input
                className="input"
                type="text"
                value={quickNotes}
                onChange={(e) => setQuickNotes(e.target.value)}
                placeholder="e.g. End-of-month reconciliation"
              />
            </div>
            {err && <p className="text-sm text-brand-danger">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setQuickDraft(null)} disabled={pending}>
                Cancel
              </button>
              <button className="btn-primary" disabled={pending}>
                {pending ? "Creating…" : "Create settlement"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs" role="tablist" aria-label="Settlement mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "quick"}
        onClick={() => onChange("quick")}
        className={
          mode === "quick"
            ? "px-3 py-1 rounded-full font-medium bg-brand-gradient text-white shadow-sm"
            : "px-3 py-1 rounded-full text-slate-600 hover:text-brand-navy"
        }
      >
        Quick
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "detailed"}
        onClick={() => onChange("detailed")}
        className={
          mode === "detailed"
            ? "px-3 py-1 rounded-full font-medium bg-brand-gradient text-white shadow-sm"
            : "px-3 py-1 rounded-full text-slate-600 hover:text-brand-navy"
        }
      >
        Detailed
      </button>
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
