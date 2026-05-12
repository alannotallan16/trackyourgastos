"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSettlement, saveSettlement, type SettlementPayload } from "./actions";
import { formatDate, formatMoney } from "@/lib/format";
import type { Profile, Settlement } from "@/lib/types";
import type { DebtSuggestion, UserBalance } from "@/lib/balances";

interface Props {
  profiles: Profile[];
  settlements: Settlement[];
  balances: UserBalance[];
  suggestions: DebtSuggestion[];
}

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
        {profiles.map((p) => {
          const b = balances.find((x) => x.user_id === p.id);
          return (
            <div key={p.id} className="card">
              <p className="text-xs uppercase text-slate-500">{p.display_name}</p>
              <p className={`text-2xl font-semibold tabular-nums ${b && b.net > 0 ? "text-emerald-600" : b && b.net < 0 ? "text-red-600" : ""}`}>
                {formatMoney(b?.net ?? 0)}
              </p>
              <p className="text-xs text-slate-500">Paid {formatMoney(b?.paid ?? 0)} · Share {formatMoney(b?.owed ?? 0)}</p>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">Suggested settlements</h2>
          <button className="btn-primary text-sm" onClick={() => openNew()}>
            ➕ Record payment
          </button>
        </div>
        {suggestions.length === 0 ? (
          <p className="text-sm text-slate-500">All settled. 🎉</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <span>
                  <strong>{profilesById.get(s.from_user_id)?.display_name}</strong> → {profilesById.get(s.to_user_id)?.display_name}
                </span>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums font-medium">{formatMoney(s.amount)}</span>
                  <button
                    className="btn-secondary text-xs"
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

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="table-cell text-left">Date</th>
              <th className="table-cell text-left">From</th>
              <th className="table-cell text-left">To</th>
              <th className="table-cell text-right">Amount</th>
              <th className="table-cell text-left">Notes</th>
              <th className="table-cell"></th>
            </tr>
          </thead>
          <tbody>
            {settlements.length === 0 && (
              <tr>
                <td className="table-cell text-center text-slate-500 py-4" colSpan={6}>
                  No settlements recorded yet.
                </td>
              </tr>
            )}
            {settlements.map((s) => (
              <tr key={s.id}>
                <td className="table-cell">{formatDate(s.settled_on)}</td>
                <td className="table-cell">{profilesById.get(s.from_user_id)?.display_name}</td>
                <td className="table-cell">{profilesById.get(s.to_user_id)?.display_name}</td>
                <td className="table-cell text-right tabular-nums">{formatMoney(Number(s.amount), s.currency)}</td>
                <td className="table-cell text-slate-600">{s.notes ?? ""}</td>
                <td className="table-cell text-right">
                  <button
                    className="text-red-600 text-xs underline"
                    onClick={() => {
                      if (confirm("Delete this settlement?")) start(() => deleteSettlement(s.id).then(() => router.refresh()));
                    }}
                    disabled={pending}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center p-4 z-40">
          <form className="bg-white rounded-lg shadow-lg w-full max-w-md p-5 space-y-3" onSubmit={submit}>
            <h2 className="font-semibold text-lg">Record settlement</h2>
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
            {err && <p className="text-sm text-red-600">{err}</p>}
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
