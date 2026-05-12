"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRecurring, generateFromRecurring, saveRecurring, toggleRecurringActive, type RecurringPayload } from "./actions";
import { formatMoney, formatDate } from "@/lib/format";
import type { Category, Profile, RecurringExpense, SplitPreset } from "@/lib/types";
import { Badge, colorForCategory } from "@/components/ui/Badge";
import { Plus, X } from "@/components/ui/icons";

interface Props {
  items: RecurringExpense[];
  profiles: Profile[];
  categories: Category[];
  presets: SplitPreset[];
}

export function RecurringClient({ items, profiles, categories, presets }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<RecurringExpense> | null>(null);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function startNew() {
    setEditing({
      merchant: "",
      amount: 0,
      currency: "PHP",
      paid_by_user_id: profiles[0]?.id,
      frequency: "monthly",
      next_due_date: new Date().toISOString().slice(0, 10),
      active: true
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setErr(null);
    const payload: RecurringPayload = {
      id: editing.id,
      merchant: editing.merchant ?? "",
      category_id: editing.category_id ?? null,
      amount: Number(editing.amount) || 0,
      currency: editing.currency ?? "PHP",
      paid_by_user_id: editing.paid_by_user_id ?? profiles[0].id,
      split_preset_id: editing.split_preset_id ?? null,
      frequency: (editing.frequency ?? "monthly") as any,
      next_due_date: editing.next_due_date ?? new Date().toISOString().slice(0, 10),
      active: editing.active ?? true,
      notes: editing.notes ?? null
    };
    startTransition(async () => {
      try {
        await saveRecurring(payload);
        setEditing(null);
        router.refresh();
      } catch (e: any) {
        setErr(e?.message ?? "Save failed");
      }
    });
  }

  const profilesById = new Map(profiles.map((p) => [p.id, p]));
  const catsById = new Map(categories.map((c) => [c.id, c]));
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = items.filter((i) => i.active && i.next_due_date <= addDays(today, 14));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          {upcoming.length > 0 ? `${upcoming.length} due within 14 days.` : "No upcoming recurring expenses."}
        </p>
        <button className="btn-primary text-sm" onClick={startNew}>
          <Plus className="h-4 w-4" />
          New recurring
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Merchant</th>
              <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Category</th>
              <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Amount</th>
              <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Paid by</th>
              <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Frequency</th>
              <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Next due</th>
              <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Status</th>
              <th className="table-cell"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td className="table-cell text-slate-500 py-6 text-center" colSpan={8}>
                  No recurring expenses yet.
                </td>
              </tr>
            )}
            {items.map((r) => {
              const cat = r.category_id ? catsById.get(r.category_id) : null;
              return (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="table-cell font-medium">{r.merchant}</td>
                <td className="table-cell">
                  {cat ? <Badge color={colorForCategory(cat.name)}>{cat.name}</Badge> : <span className="text-slate-400">—</span>}
                </td>
                <td className="table-cell text-right tabular-nums font-medium">{formatMoney(Number(r.amount), r.currency)}</td>
                <td className="table-cell">{profilesById.get(r.paid_by_user_id)?.display_name ?? "—"}</td>
                <td className="table-cell capitalize text-slate-600">{r.frequency}</td>
                <td className="table-cell">{formatDate(r.next_due_date)}</td>
                <td className="table-cell">
                  <Badge color={r.active ? "green" : "gray"}>{r.active ? "active" : "paused"}</Badge>
                </td>
                <td className="table-cell">
                  <div className="flex flex-wrap gap-3 text-xs">
                    <button
                      className="text-brand-green font-medium hover:underline"
                      onClick={() => startTransition(() => generateFromRecurring(r.id))}
                      disabled={pending}
                    >
                      Add now
                    </button>
                    <button className="text-slate-600 hover:underline" onClick={() => setEditing(r)}>
                      Edit
                    </button>
                    <button
                      className="text-slate-600 hover:underline"
                      onClick={() => startTransition(() => toggleRecurringActive(r.id, !r.active))}
                    >
                      {r.active ? "Pause" : "Resume"}
                    </button>
                    <button
                      className="text-brand-danger hover:underline"
                      onClick={() => {
                        if (confirm("Delete this recurring template?")) {
                          startTransition(() => deleteRecurring(r.id));
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-brand-navy/40 flex items-end md:items-center justify-center p-4 z-40">
          <form className="bg-white rounded-2xl shadow-card-hover w-full max-w-lg p-5 space-y-3" onSubmit={submit}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg text-brand-navy">{editing.id ? "Edit recurring" : "New recurring"}</h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Merchant</label>
                <input className="input" value={editing.merchant ?? ""} onChange={(e) => setEditing({ ...editing, merchant: e.target.value })} required />
              </div>
              <div>
                <label className="label">Amount</label>
                <input className="input" type="number" step="0.01" value={editing.amount ?? ""} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} required />
              </div>
              <div>
                <label className="label">Currency</label>
                <input className="input" value={editing.currency ?? "PHP"} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={editing.category_id ?? ""} onChange={(e) => setEditing({ ...editing, category_id: e.target.value || null })}>
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Paid by</label>
                <select className="input" value={editing.paid_by_user_id ?? ""} onChange={(e) => setEditing({ ...editing, paid_by_user_id: e.target.value })}>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.display_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Split preset</label>
                <select className="input" value={editing.split_preset_id ?? ""} onChange={(e) => setEditing({ ...editing, split_preset_id: e.target.value || null })}>
                  <option value="">— Equal —</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Frequency</label>
                <select className="input" value={editing.frequency ?? "monthly"} onChange={(e) => setEditing({ ...editing, frequency: e.target.value as any })}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="label">Next due</label>
                <input className="input" type="date" value={editing.next_due_date ?? ""} onChange={(e) => setEditing({ ...editing, next_due_date: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">Notes</label>
                <textarea className="input" value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                Active
              </label>
            </div>
            {err && <p className="text-sm text-brand-danger">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
