"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category, Expense, MerchantRule, Profile, SplitPreset, SplitType } from "@/lib/types";
import { saveExpense, type ExpensePayload } from "@/app/(app)/expenses/actions";
import { suggestFromMerchant } from "@/lib/categorize";
import { calculateSplits, presetToSplitInputs, equalSplitInputs } from "@/lib/splits";
import { formatMoney } from "@/lib/format";

export interface DuplicateCandidate {
  id: string;
  merchant: string;
  expense_date: string;
  total_amount: number;
}

interface Props {
  profiles: Profile[];
  categories: Category[];
  presets: SplitPreset[];
  merchantRules: MerchantRule[];
  duplicates?: DuplicateCandidate[];
  initial?: Partial<Expense> & { splits?: { user_id: string; split_type: SplitType; percentage: number | null; fixed_amount: number | null }[]; receipt_file_id?: string | null };
  receiptFileId?: string | null;
  receiptPreviewUrl?: string | null;
}

export function ExpenseForm({
  profiles,
  categories,
  presets,
  merchantRules,
  duplicates = [],
  initial,
  receiptFileId,
  receiptPreviewUrl
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [date, setDate] = useState(initial?.expense_date ?? new Date().toISOString().slice(0, 10));
  const [merchant, setMerchant] = useState(initial?.merchant ?? "");
  const [total, setTotal] = useState<string>(initial?.total_amount ? String(initial.total_amount) : "");
  const [currency, setCurrency] = useState(initial?.currency ?? "PHP");
  const [exchangeRate, setExchangeRate] = useState<string>(initial?.exchange_rate ? String(initial.exchange_rate) : "");
  const [categoryId, setCategoryId] = useState<string>(initial?.category_id ?? "");
  const [paidBy, setPaidBy] = useState<string>(initial?.paid_by_user_id ?? profiles[0]?.id ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [presetId, setPresetId] = useState<string>(initial?.split_preset_id ?? "");
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [perUser, setPerUser] = useState<Record<string, { selected: boolean; percentage: string; fixed: string }>>(
    () => {
      const seed: Record<string, { selected: boolean; percentage: string; fixed: string }> = {};
      for (const p of profiles) seed[p.id] = { selected: true, percentage: "", fixed: "" };
      if (initial?.splits?.length) {
        for (const p of profiles) seed[p.id].selected = false;
        for (const s of initial.splits) {
          seed[s.user_id] = {
            selected: true,
            percentage: s.percentage != null ? String(s.percentage) : "",
            fixed: s.fixed_amount != null ? String(s.fixed_amount) : ""
          };
        }
        setSplitType(initial.splits[0].split_type);
      }
      return seed;
    }
  );
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [showDupes, setShowDupes] = useState(true);

  // Auto-suggest category + preset from merchant
  useEffect(() => {
    if (!merchant.trim() || initial?.id) return;
    const s = suggestFromMerchant(merchant, merchantRules);
    if (s.category_id && !categoryId) setCategoryId(s.category_id);
    if (s.split_preset_id && !presetId) setPresetId(s.split_preset_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant]);

  // Apply preset when selected
  function applyPreset(id: string) {
    setPresetId(id);
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    setSplitType(preset.split_type);
    const memberIds = new Set(preset.members.map((m) => m.user_id));
    setPerUser((cur) => {
      const next = { ...cur };
      for (const p of profiles) {
        const member = preset.members.find((m) => m.user_id === p.id);
        next[p.id] = {
          selected: memberIds.has(p.id),
          percentage: member?.percentage != null ? String(member.percentage) : "",
          fixed: member?.fixed_amount != null ? String(member.fixed_amount) : ""
        };
      }
      return next;
    });
  }

  const totalNum = Number(total) || 0;

  const splitsForCalc = useMemo(() => {
    const selected = profiles.filter((p) => perUser[p.id]?.selected);
    return selected.map((p) => ({
      user_id: p.id,
      split_type: splitType,
      percentage: perUser[p.id].percentage ? Number(perUser[p.id].percentage) : null,
      fixed_amount: perUser[p.id].fixed ? Number(perUser[p.id].fixed) : null
    }));
  }, [profiles, perUser, splitType]);

  const calculated = useMemo(() => calculateSplits(totalNum, splitsForCalc), [totalNum, splitsForCalc]);

  const sumCalc = calculated.reduce((a, b) => a + b.calculated_amount, 0);
  const sumPct = splitsForCalc.reduce((a, b) => a + (b.percentage ?? 0), 0);
  const sumFixed = splitsForCalc.reduce((a, b) => a + (b.fixed_amount ?? 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitErr(null);
    if (splitsForCalc.length === 0) {
      setSubmitErr("Select at least one person in the split.");
      return;
    }
    if (splitType === "percentage" && Math.round(sumPct * 100) !== 10000) {
      setSubmitErr(`Percentages must sum to 100% (currently ${sumPct.toFixed(2)}%).`);
      return;
    }
    if (splitType === "fixed" && Math.round(sumFixed * 100) !== Math.round(totalNum * 100)) {
      setSubmitErr(`Fixed amounts must sum to total (${formatMoney(totalNum, currency)}). Currently ${formatMoney(sumFixed, currency)}.`);
      return;
    }
    const payload: ExpensePayload = {
      id: initial?.id,
      expense_date: date,
      merchant: merchant.trim(),
      total_amount: totalNum,
      currency,
      exchange_rate: exchangeRate ? Number(exchangeRate) : null,
      category_id: categoryId || null,
      paid_by_user_id: paidBy,
      split_preset_id: presetId || null,
      receipt_file_id: receiptFileId ?? initial?.receipt_file_id ?? null,
      notes: notes || null,
      splits: splitsForCalc
    };
    startTransition(async () => {
      try {
        await saveExpense(payload);
        router.push("/expenses");
        router.refresh();
      } catch (e: any) {
        setSubmitErr(e?.message ?? "Save failed");
      }
    });
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      {duplicates.length > 0 && showDupes && (
        <div className="card border-amber-300 bg-amber-50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-amber-800">Possible duplicate detected</p>
              <ul className="mt-1 text-xs text-amber-700 list-disc list-inside">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    {d.expense_date} · {d.merchant} · {formatMoney(d.total_amount)}
                  </li>
                ))}
              </ul>
            </div>
            <button type="button" className="text-amber-700 text-xs underline" onClick={() => setShowDupes(false)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="label">Merchant</label>
          <input
            className="input"
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="e.g. Landers, Netflix, Pelco"
            required
          />
        </div>
        <div>
          <label className="label">Total amount</label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Currency</label>
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="PHP">PHP</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="JPY">JPY</option>
            <option value="SGD">SGD</option>
          </select>
        </div>
        {currency !== "PHP" && (
          <div>
            <label className="label">Exchange rate (1 {currency} = ? PHP)</label>
            <input
              className="input"
              type="number"
              step="0.0001"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              placeholder="optional"
            />
            {exchangeRate && totalNum > 0 && (
              <p className="text-xs text-slate-500 mt-1">≈ {formatMoney(totalNum * Number(exchangeRate), "PHP")}</p>
            )}
          </div>
        )}
        <div>
          <label className="label">Category</label>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— Select —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Paid by</label>
          <select className="input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} required>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Split preset</label>
          <select className="input" value={presetId} onChange={(e) => applyPreset(e.target.value)}>
            <option value="">— Custom —</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
          <p className="font-medium">Split between</p>
          <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs">
            {(["equal", "percentage", "fixed"] as SplitType[]).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setSplitType(t)}
                className={`px-3 py-1 rounded-full font-medium capitalize transition ${
                  splitType === t
                    ? "bg-brand-gradient text-white shadow-sm"
                    : "text-slate-600 hover:text-brand-navy"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {profiles.map((p) => {
            const row = perUser[p.id];
            const calc = calculated.find((c) => c.user_id === p.id)?.calculated_amount ?? 0;
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-2">
                <label className="flex items-center gap-2 min-w-[120px]">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={(e) => setPerUser({ ...perUser, [p.id]: { ...row, selected: e.target.checked } })}
                  />
                  <span>{p.display_name}</span>
                </label>
                {row.selected && splitType === "percentage" && (
                  <div className="flex items-center gap-1">
                    <input
                      className="input w-24"
                      type="number"
                      step="0.01"
                      value={row.percentage}
                      onChange={(e) => setPerUser({ ...perUser, [p.id]: { ...row, percentage: e.target.value } })}
                      placeholder="%"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                )}
                {row.selected && splitType === "fixed" && (
                  <input
                    className="input w-32"
                    type="number"
                    step="0.01"
                    value={row.fixed}
                    onChange={(e) => setPerUser({ ...perUser, [p.id]: { ...row, fixed: e.target.value } })}
                    placeholder="amount"
                  />
                )}
                {row.selected && (
                  <span className="ml-auto text-sm font-medium tabular-nums">{formatMoney(calc, currency)}</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <button
            type="button"
            className="underline"
            onClick={() => {
              const ids = profiles.map((p) => p.id);
              const next: typeof perUser = {};
              for (const p of profiles) next[p.id] = { selected: true, percentage: "", fixed: "" };
              setPerUser(next);
              setSplitType("equal");
              setPresetId("");
              void equalSplitInputs(ids); // referenced to satisfy import-tree
            }}
          >
            Reset to equal 3-way
          </button>
          <span>
            Total split: <strong>{formatMoney(sumCalc, currency)}</strong> / {formatMoney(totalNum, currency)}
          </span>
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input min-h-[60px]" value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {receiptPreviewUrl && (
        <div className="card">
          <p className="text-xs uppercase font-semibold tracking-wide text-slate-500 mb-2">Attached receipt</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={receiptPreviewUrl} alt="receipt" className="max-h-64 rounded-xl border border-slate-200" />
        </div>
      )}

      {submitErr && <p className="text-sm text-brand-danger">{submitErr}</p>}

      <div className="flex gap-3">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : initial?.id ? "Update expense" : "Save expense"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancel
        </button>
      </div>

      {/* preset import reference (no-op) */}
      <span className="hidden">{presets.length}{presetToSplitInputs.length}</span>
    </form>
  );
}
