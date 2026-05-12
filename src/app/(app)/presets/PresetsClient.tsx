"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePreset, savePreset, type PresetPayload } from "./actions";
import type { Profile, SplitPreset, SplitType } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Plus, X } from "@/components/ui/icons";

interface Props {
  profiles: Profile[];
  presets: SplitPreset[];
}

export function PresetsClient({ profiles, presets }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<PresetPayload | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const profilesById = new Map(profiles.map((p) => [p.id, p]));

  function startNew() {
    setEditing({
      name: "",
      description: "",
      split_type: "equal",
      members: profiles.map((p) => ({ user_id: p.id, percentage: null, fixed_amount: null }))
    });
  }

  function startEdit(p: SplitPreset) {
    setEditing({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      split_type: p.split_type,
      members: profiles.map((pr) => {
        const m = p.members.find((mm) => mm.user_id === pr.id);
        return m
          ? { user_id: pr.id, percentage: m.percentage, fixed_amount: m.fixed_amount }
          : { user_id: pr.id, percentage: null, fixed_amount: null };
      })
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setErr(null);
    const members = editing.members.filter((m) => {
      if (editing.split_type === "percentage") return (m.percentage ?? 0) > 0;
      if (editing.split_type === "fixed") return (m.fixed_amount ?? 0) > 0;
      return true; // equal: keep all selected
    });
    if (members.length === 0) {
      setErr("At least one member required.");
      return;
    }
    if (editing.split_type === "percentage") {
      const sum = members.reduce((a, b) => a + (b.percentage ?? 0), 0);
      if (Math.round(sum * 100) !== 10000) {
        setErr(`Percentages must sum to 100 (currently ${sum.toFixed(2)}).`);
        return;
      }
    }
    try {
      await savePreset({ ...editing, members });
      setEditing(null);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary text-sm" onClick={startNew}>
          <Plus className="h-4 w-4" />
          New preset
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {presets.map((p) => (
          <div key={p.id} className="card-hover">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-brand-navy">{p.name}</p>
                <div className="mt-1"><Badge color={p.split_type === "equal" ? "green" : p.split_type === "percentage" ? "blue" : "purple"}>{p.split_type}</Badge></div>
                {p.description && <p className="text-xs text-slate-500 mt-2">{p.description}</p>}
              </div>
              <div className="flex gap-3 text-xs shrink-0">
                <button className="text-slate-600 hover:underline" onClick={() => startEdit(p)}>Edit</button>
                <button
                  className="text-brand-danger hover:underline"
                  onClick={() => {
                    if (confirm(`Delete "${p.name}"?`)) start(async () => { await deletePreset(p.id); router.refresh(); });
                  }}
                  disabled={pending}
                >
                  Delete
                </button>
              </div>
            </div>
            <ul className="text-sm mt-3 space-y-1">
              {p.members.map((m) => (
                <li key={m.user_id} className="flex justify-between border-b border-slate-100 py-1.5">
                  <span className="text-slate-700">{profilesById.get(m.user_id)?.display_name}</span>
                  <span className="text-slate-500 tabular-nums">
                    {p.split_type === "percentage" ? `${m.percentage ?? 0}%` : p.split_type === "fixed" ? m.fixed_amount : "equal"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-brand-navy/40 flex items-end md:items-center justify-center p-4 z-40">
          <form className="bg-white rounded-2xl shadow-card-hover w-full max-w-lg p-5 space-y-3" onSubmit={submit}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg text-brand-navy">{editing.id ? "Edit preset" : "New preset"}</h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Name</label>
                <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
              </div>
              <div>
                <label className="label">Split type</label>
                <select className="input" value={editing.split_type} onChange={(e) => setEditing({ ...editing, split_type: e.target.value as SplitType })}>
                  <option value="equal">Equal</option>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Description</label>
                <input className="input" value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
            </div>
            <div>
              <p className="label">Members</p>
              <div className="space-y-2">
                {editing.members.map((m, i) => (
                  <div key={m.user_id} className="flex items-center gap-2">
                    <span className="min-w-[120px]">{profilesById.get(m.user_id)?.display_name}</span>
                    {editing.split_type === "percentage" && (
                      <input
                        className="input w-24"
                        type="number"
                        step="0.01"
                        value={m.percentage ?? ""}
                        onChange={(e) => {
                          const v = e.target.value ? Number(e.target.value) : null;
                          const next = [...editing.members];
                          next[i] = { ...m, percentage: v };
                          setEditing({ ...editing, members: next });
                        }}
                        placeholder="%"
                      />
                    )}
                    {editing.split_type === "fixed" && (
                      <input
                        className="input w-32"
                        type="number"
                        step="0.01"
                        value={m.fixed_amount ?? ""}
                        onChange={(e) => {
                          const v = e.target.value ? Number(e.target.value) : null;
                          const next = [...editing.members];
                          next[i] = { ...m, fixed_amount: v };
                          setEditing({ ...editing, members: next });
                        }}
                        placeholder="amount"
                      />
                    )}
                  </div>
                ))}
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
