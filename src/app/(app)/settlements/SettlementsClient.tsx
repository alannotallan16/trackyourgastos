"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSettlement } from "./actions";
import { formatDate, formatMoney } from "@/lib/format";
import type { Category, Expense, ExpenseSplit, Profile, Settlement } from "@/lib/types";
import type { DebtSuggestion, UserBalance } from "@/lib/balances";
import { findUnpaidShares } from "@/lib/balances";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, colorForCategory } from "@/components/ui/Badge";
import { ArrowRight, Plus, Users, Wallet, X } from "@/components/ui/icons";

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

interface DraftState {
  from_user_id: string;
  to_user_id: string;
  selected: Set<string>;
  notes: string;
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
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const open = settlements.filter((s) => s.status === "open" || s.status === "partially_paid");
  const history = settlements.filter((s) => s.status === "paid" || s.status === "cancelled");

  const candidateShares = useMemo(() => {
    if (!draft) return [];
    return findUnpaidShares(expenses, splits, draft.from_user_id, draft.to_user_id);
  }, [draft, expenses, splits]);

  const draftTotal = useMemo(() => {
    if (!draft) return 0;
    return candidateShares.reduce(
      (sum, s) => (draft.selected.has(s.split.id) ? sum + Number(s.split.calculated_amount) : sum),
      0
    );
  }, [candidateShares, draft]);

  function openCreate(seed?: { from_user_id?: string; to_user_id?: string }) {
    const from = seed?.from_user_id ?? profiles[0]?.id ?? "";
    const to = seed?.to_user_id ?? profiles.find((p) => p.id !== from)?.id ?? "";
    setErr(null);
    setDraft({
      from_user_id: from,
      to_user_id: to,
      selected: new Set(),
      notes: ""
    });
  }

  // Pre-select all candidates when from/to changes
  function onPickDirection(field: "from_user_id" | "to_user_id", value: string) {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, [field]: value, selected: new Set<string>() };
      const matches = findUnpaidShares(expenses, splits, next.from_user_id, next.to_user_id);
      for (const m of matches) next.selected.add(m.split.id);
      return next;
    });
  }

  function toggleSelect(id: string) {
    setDraft((d) => {
      if (!d) return d;
      const next = new Set(d.selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...d, selected: next };
    });
  }

  function submitDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setErr(null);
    const ids = Array.from(draft.selected);
    if (ids.length === 0) {
      setErr("Pick at least one expense share to include.");
      return;
    }
    start(async () => {
      try {
        const { id } = await createSettlement({
          from_user_id: draft.from_user_id,
          to_user_id: draft.to_user_id,
          currency: "PHP",
          split_ids: ids,
          notes: draft.notes || null
        });
        setDraft(null);
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-brand-navy">Suggested settlements</h2>
          <button className="btn-primary text-sm" onClick={() => openCreate()}>
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
                      onClick={() => openCreate({ from_user_id: s.from_user_id, to_user_id: s.to_user_id })}
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

      {/* Create settlement modal */}
      {draft && (
        <div className="fixed inset-0 bg-brand-navy/40 flex items-end md:items-center justify-center p-3 z-40">
          <form
            className="bg-white rounded-2xl shadow-card-hover w-full max-w-2xl max-h-[90vh] flex flex-col"
            onSubmit={submitDraft}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-lg text-brand-navy">Create settlement</h2>
              <button type="button" onClick={() => setDraft(null)} aria-label="Close">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">From (owes)</label>
                  <select
                    className="input"
                    value={draft.from_user_id}
                    onChange={(e) => onPickDirection("from_user_id", e.target.value)}
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.display_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">To (paid)</label>
                  <select
                    className="input"
                    value={draft.to_user_id}
                    onChange={(e) => onPickDirection("to_user_id", e.target.value)}
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.display_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <p className="label mb-2">Unpaid expense shares</p>
                {candidateShares.length === 0 ? (
                  <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center">
                    No unpaid shares between these two people right now.
                  </p>
                ) : (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="table-cell text-left w-8">
                            <input
                              type="checkbox"
                              aria-label="Select all"
                              checked={candidateShares.length > 0 && candidateShares.every((s) => draft.selected.has(s.split.id))}
                              onChange={(e) => {
                                setDraft((d) => {
                                  if (!d) return d;
                                  const next = new Set<string>();
                                  if (e.target.checked) {
                                    for (const s of candidateShares) next.add(s.split.id);
                                  }
                                  return { ...d, selected: next };
                                });
                              }}
                            />
                          </th>
                          <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Date</th>
                          <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Merchant</th>
                          <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Category</th>
                          <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Total</th>
                          <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Owed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidateShares.map(({ split, expense }) => {
                          const cat = expense.category_id ? categoriesById.get(expense.category_id) : null;
                          const selected = draft.selected.has(split.id);
                          return (
                            <tr key={split.id} className={selected ? "bg-emerald-50/40" : "hover:bg-slate-50"}>
                              <td className="table-cell">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleSelect(split.id)}
                                  aria-label={`Include ${expense.merchant}`}
                                />
                              </td>
                              <td className="table-cell whitespace-nowrap text-slate-600">{formatDate(expense.expense_date)}</td>
                              <td className="table-cell font-medium">{expense.merchant}</td>
                              <td className="table-cell">
                                {cat ? <Badge color={colorForCategory(cat.name)}>{cat.name}</Badge> : <span className="text-slate-400">—</span>}
                              </td>
                              <td className="table-cell text-right tabular-nums text-slate-600">
                                {formatMoney(Number(expense.total_amount), expense.currency)}
                              </td>
                              <td className="table-cell text-right tabular-nums font-medium">
                                {formatMoney(Number(split.calculated_amount), expense.currency)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input"
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => (d ? { ...d, notes: e.target.value } : d))}
                  placeholder="Optional"
                />
              </div>
              {err && <p className="text-sm text-brand-danger">{err}</p>}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <span className="text-slate-500">Selected total:</span>{" "}
                <span className="font-semibold tabular-nums text-brand-navy">{formatMoney(draftTotal)}</span>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => setDraft(null)}>Cancel</button>
                <button className="btn-primary" disabled={pending || draft.selected.size === 0}>
                  {pending ? "Creating…" : "Create settlement"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
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
