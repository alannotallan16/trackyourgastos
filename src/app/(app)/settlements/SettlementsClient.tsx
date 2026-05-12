"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSettlement, saveSettlement, type SettlementPayload } from "./actions";
import { formatDate, formatMoney } from "@/lib/format";
import type { Profile, Settlement } from "@/lib/types";
import type { DebtSuggestion, UserBalance } from "@/lib/balances";
import { StatCard } from "@/components/ui/StatCard";
import { ArrowRight, Plus, Users, Wallet, X, Trash2 } from "@/components/ui/icons";

interface Props {
  profiles: Profile[];
  settlements: Settlement[];
  balances: UserBalance[];
  suggestions: DebtSuggestion[];
}

const PERSON_ICON_BG = ["green", "blue", "purple"] as const;

export function SettlementsClient({ profiles, settlements, balances, suggestions }: Props) {
  const router = useRouter();
  const profilesById = new Map(profiles.map((p) => [p.id, p]));
  const [editing, setEditing] = useState<Partial<SettlementPayload> | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function openNew(seed?: Partial<SettlementPayload>) {
    setEditing({
      from_user_id: profiles[0]?.id,
      to_user_id: profiles[1]?.id,
      amount: 0,
      currency: "PHP",
      settled_on: new Date().toISOString().slice(0, 10),
      ...seed
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setErr(null);
    try {
      await saveSettlement({
        from_user_id: editing.from_user_id!,
        to_user_id: editing.to_user_id!,
        amount: Number(editing.amount) || 0,
        currency: editing.currency ?? "PHP",
        settled_on: editing.settled_on ?? new Date().toISOString().slice(0, 10),
        notes: editing.notes ?? null
      });
      setEditing(null);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    }
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
          <button className="btn-primary text-sm" onClick={() => openNew()}>
            <Plus className="h-4 w-4" />
            Record payment
          </button>
        </div>
        {suggestions.length === 0 ? (
          <p className="text-sm text-slate-500">All settled.</p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-brand-navy">{profilesById.get(s.from_user_id)?.display_name}</span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-brand-navy">{profilesById.get(s.to_user_id)?.display_name}</span>
                </span>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums font-semibold text-brand-danger">{formatMoney(s.amount)}</span>
                  <button
                    className="btn-secondary text-xs !px-3 !py-1.5"
                    onClick={() => openNew({ from_user_id: s.from_user_id, to_user_id: s.to_user_id, amount: s.amount })}
                  >
                    Mark paid
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-brand-navy">Settlement history</h2>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Date</th>
              <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">From</th>
              <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">To</th>
              <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Amount</th>
              <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Notes</th>
              <th className="table-cell"></th>
            </tr>
          </thead>
          <tbody>
            {settlements.length === 0 && (
              <tr>
                <td className="table-cell text-center text-slate-500 py-6" colSpan={6}>
                  No settlements recorded yet.
                </td>
              </tr>
            )}
            {settlements.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="table-cell">{formatDate(s.settled_on)}</td>
                <td className="table-cell">{profilesById.get(s.from_user_id)?.display_name}</td>
                <td className="table-cell">{profilesById.get(s.to_user_id)?.display_name}</td>
                <td className="table-cell text-right tabular-nums font-medium">{formatMoney(Number(s.amount), s.currency)}</td>
                <td className="table-cell text-slate-600">{s.notes ?? ""}</td>
                <td className="table-cell text-right">
                  <button
                    className="text-brand-danger hover:underline text-xs inline-flex items-center gap-1"
                    onClick={() => {
                      if (confirm("Delete this settlement?")) start(() => deleteSettlement(s.id).then(() => router.refresh()));
                    }}
                    disabled={pending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-brand-navy/40 flex items-end md:items-center justify-center p-4 z-40">
          <form className="bg-white rounded-2xl shadow-card-hover w-full max-w-md p-5 space-y-3" onSubmit={submit}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg text-brand-navy">Record settlement</h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">From</label>
                <select className="input" value={editing.from_user_id ?? ""} onChange={(e) => setEditing({ ...editing, from_user_id: e.target.value })}>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.display_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">To</label>
                <select className="input" value={editing.to_user_id ?? ""} onChange={(e) => setEditing({ ...editing, to_user_id: e.target.value })}>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.display_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Amount</label>
                <input className="input" type="number" step="0.01" min="0" value={editing.amount ?? ""} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} required />
              </div>
              <div>
                <label className="label">Date</label>
                <input className="input" type="date" value={editing.settled_on ?? ""} onChange={(e) => setEditing({ ...editing, settled_on: e.target.value })} required />
              </div>
              <div className="col-span-2">
                <label className="label">Notes</label>
                <textarea className="input" value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
            {err && <p className="text-sm text-brand-danger">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" disabled={pending}>Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
