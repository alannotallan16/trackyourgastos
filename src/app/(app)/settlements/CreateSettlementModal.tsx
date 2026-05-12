"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSettlement } from "./actions";
import { findUnpaidShares } from "@/lib/balances";
import { formatDate, formatMoney } from "@/lib/format";
import type { Category, Expense, ExpenseSplit, Profile } from "@/lib/types";
import { Badge, colorForCategory } from "@/components/ui/Badge";
import { X } from "@/components/ui/icons";

interface Props {
  open: boolean;
  onClose: () => void;
  profiles: Profile[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  categories: Category[];
  initialFromUserId?: string;
  initialToUserId?: string;
  suggestedAmount?: number;
}

const ROUND2 = (n: number) => Math.round(n * 100) / 100;

export function CreateSettlementModal({
  open,
  onClose,
  profiles,
  expenses,
  splits,
  categories,
  initialFromUserId,
  initialToUserId,
  suggestedAmount
}: Props) {
  const router = useRouter();

  const profilesById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const initialFrom = initialFromUserId ?? profiles[0]?.id ?? "";
  const initialTo =
    initialToUserId ?? profiles.find((p) => p.id !== initialFrom)?.id ?? profiles[1]?.id ?? "";

  const [fromId, setFromId] = useState(initialFrom);
  const [toId, setToId] = useState(initialTo);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMerchant, setFilterMerchant] = useState("");

  const lastClickedIndexRef = useRef<number | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Sync internal state to incoming props whenever the modal is (re)opened.
  useEffect(() => {
    if (!open) return;
    const f = initialFromUserId ?? profiles[0]?.id ?? "";
    const t = initialToUserId ?? profiles.find((p) => p.id !== f)?.id ?? profiles[1]?.id ?? "";
    setFromId(f);
    setToId(t);
    setNotes("");
    setFilterFrom("");
    setFilterTo("");
    setFilterCategory("");
    setFilterMerchant("");
    setErr(null);
    lastClickedIndexRef.current = null;
    // Pre-select all candidates between (f, t) so the typical "settle
    // everything between these two" case is one click away. The user can
    // clear and re-pick.
    const matches = findUnpaidShares(expenses, splits, f, t);
    setSelected(new Set(matches.map((m) => m.split.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFromUserId, initialToUserId]);

  // When the user changes from/to inside the modal, reset selection.
  function changeFrom(id: string) {
    setFromId(id);
    const matches = findUnpaidShares(expenses, splits, id, toId);
    setSelected(new Set(matches.map((m) => m.split.id)));
    lastClickedIndexRef.current = null;
  }
  function changeTo(id: string) {
    setToId(id);
    const matches = findUnpaidShares(expenses, splits, fromId, id);
    setSelected(new Set(matches.map((m) => m.split.id)));
    lastClickedIndexRef.current = null;
  }

  // Base candidate list (all unpaid shares in the direction).
  const candidateShares = useMemo(
    () => findUnpaidShares(expenses, splits, fromId, toId),
    [expenses, splits, fromId, toId]
  );

  // After in-modal filters.
  const filteredShares = useMemo(() => {
    const merchantLower = filterMerchant.trim().toLowerCase();
    return candidateShares.filter(({ expense }) => {
      if (filterFrom && expense.expense_date < filterFrom) return false;
      if (filterTo && expense.expense_date > filterTo) return false;
      if (filterCategory && expense.category_id !== filterCategory) return false;
      if (merchantLower && !expense.merchant.toLowerCase().includes(merchantLower)) return false;
      return true;
    });
  }, [candidateShares, filterFrom, filterTo, filterCategory, filterMerchant]);

  const selectedTotal = useMemo(() => {
    let sum = 0;
    for (const { split } of candidateShares) {
      if (selected.has(split.id)) sum += Number(split.calculated_amount);
    }
    return ROUND2(sum);
  }, [candidateShares, selected]);

  const visibleSelectedCount = useMemo(
    () => filteredShares.reduce((n, s) => (selected.has(s.split.id) ? n + 1 : n), 0),
    [filteredShares, selected]
  );

  const allVisibleSelected =
    filteredShares.length > 0 && filteredShares.every((s) => selected.has(s.split.id));
  const someVisibleSelected = filteredShares.some((s) => selected.has(s.split.id));
  const hiddenSelectedCount = selected.size - visibleSelectedCount;

  // Selection helpers ------------------------------------------------------

  function applyRange(start: number, end: number, value: boolean) {
    const [a, b] = start <= end ? [start, end] : [end, start];
    setSelected((prev) => {
      const next = new Set(prev);
      for (let i = a; i <= b; i++) {
        const id = filteredShares[i]?.split.id;
        if (!id) continue;
        if (value) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function toggleOne(index: number, shiftKey: boolean) {
    const id = filteredShares[index]?.split.id;
    if (!id) return;
    const wasSelected = selected.has(id);
    const nextValue = !wasSelected;

    if (shiftKey && lastClickedIndexRef.current != null) {
      applyRange(lastClickedIndexRef.current, index, nextValue);
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        if (nextValue) next.add(id);
        else next.delete(id);
        return next;
      });
    }
    lastClickedIndexRef.current = index;
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of filteredShares) next.add(s.split.id);
      return next;
    });
  }
  function clearAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of filteredShares) next.delete(s.split.id);
      return next;
    });
  }
  function invertVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of filteredShares) {
        if (next.has(s.split.id)) next.delete(s.split.id);
        else next.add(s.split.id);
      }
      return next;
    });
  }
  function clearFilters() {
    setFilterFrom("");
    setFilterTo("");
    setFilterCategory("");
    setFilterMerchant("");
  }

  // Submit -----------------------------------------------------------------

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const ids = Array.from(selected);
    if (ids.length === 0) {
      setErr("Pick at least one expense share to include.");
      return;
    }
    start(async () => {
      try {
        const { id } = await createSettlement({
          from_user_id: fromId,
          to_user_id: toId,
          currency: "PHP",
          split_ids: ids,
          notes: notes || null
        });
        onClose();
        router.push(`/settlements/${id}`);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to create settlement.");
      }
    });
  }

  if (!open) return null;

  // Difference vs the suggested amount (if any).
  const diff = suggestedAmount != null ? ROUND2(selectedTotal - suggestedAmount) : null;
  const diffColor =
    diff == null
      ? "text-slate-500"
      : Math.abs(diff) < 0.005
        ? "text-brand-green"
        : "text-amber-700";
  const diffLabel = diff == null ? null : diff === 0 ? "₱0.00" : `${diff > 0 ? "+" : ""}${formatMoney(diff)}`;

  return (
    <div className="fixed inset-0 z-40 flex items-stretch md:items-center md:justify-center md:p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-brand-navy/40"
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        className="relative bg-white shadow-card-hover flex flex-col w-full h-full md:w-[90vw] md:max-w-[1400px] md:h-[88vh] md:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-brand-navy">Create settlement</h2>
            <p className="text-xs text-slate-500">
              Bundle unpaid expense shares from one person to another into a single reconcilable settlement.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 grid grid-cols-2 md:grid-cols-6 gap-2">
          <div>
            <label className="label">From (owes)</label>
            <select className="input" value={fromId} onChange={(e) => changeFrom(e.target.value)}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">To (paid)</label>
            <select className="input" value={toId} onChange={(e) => changeTo(e.target.value)}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From date</label>
            <input className="input" type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">To date</label>
            <input className="input" type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Merchant</label>
            <input
              className="input"
              type="text"
              value={filterMerchant}
              onChange={(e) => setFilterMerchant(e.target.value)}
              placeholder="Search"
            />
          </div>
        </div>

        {/* Sticky summary bar */}
        <div className="px-5 py-2.5 border-b border-slate-200 bg-emerald-50/40 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              <span className="text-slate-500">Selected:</span>{" "}
              <strong className="text-brand-navy tabular-nums">{selected.size}</strong>
              {hiddenSelectedCount > 0 && (
                <span className="text-xs text-slate-500 ml-1">({hiddenSelectedCount} hidden by filters)</span>
              )}
            </span>
            <span>
              <span className="text-slate-500">Total:</span>{" "}
              <strong className="text-brand-navy tabular-nums">{formatMoney(selectedTotal)}</strong>
            </span>
            {suggestedAmount != null && (
              <>
                <span>
                  <span className="text-slate-500">Suggested:</span>{" "}
                  <strong className="text-brand-navy tabular-nums">{formatMoney(suggestedAmount)}</strong>
                </span>
                <span>
                  <span className="text-slate-500">Diff:</span>{" "}
                  <strong className={`tabular-nums ${diffColor}`}>{diffLabel}</strong>
                </span>
              </>
            )}
            {filteredShares.length !== candidateShares.length && (
              <span className="text-xs text-slate-500">
                Showing {filteredShares.length} of {candidateShares.length}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary !py-1 !px-3 text-xs"
              onClick={selectAllVisible}
              disabled={filteredShares.length === 0 || allVisibleSelected}
            >
              Select all visible
            </button>
            <button
              type="button"
              className="btn-secondary !py-1 !px-3 text-xs"
              onClick={clearAllVisible}
              disabled={!someVisibleSelected}
            >
              Clear visible
            </button>
            <button
              type="button"
              className="btn-secondary !py-1 !px-3 text-xs"
              onClick={invertVisible}
              disabled={filteredShares.length === 0}
            >
              Invert
            </button>
            <button
              type="button"
              className="btn-ghost !py-1 !px-3 text-xs"
              onClick={clearFilters}
            >
              Reset filters
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto">
          {filteredShares.length === 0 ? (
            <div className="h-full flex items-center justify-center px-6 py-12">
              <p className="text-sm text-slate-500 text-center">
                {candidateShares.length === 0
                  ? "No unpaid shares between these two people right now."
                  : "No shares match the current filters."}
              </p>
            </div>
          ) : (
            <table className="min-w-full text-sm select-none">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left w-10 border-b border-slate-200">
                    <input
                      type="checkbox"
                      aria-label="Select all visible"
                      ref={(el) => {
                        if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                      }}
                      checked={allVisibleSelected}
                      onChange={(e) => (e.target.checked ? selectAllVisible() : clearAllVisible())}
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">Date</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">Merchant</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">Category</th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">Total</th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">Owed</th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">Paid by</th>
                </tr>
              </thead>
              <tbody>
                {filteredShares.map(({ split, expense }, i) => {
                  const cat = expense.category_id ? categoriesById.get(expense.category_id) : null;
                  const isSelected = selected.has(split.id);
                  return (
                    <tr
                      key={split.id}
                      onClick={(e) => {
                        // Ignore clicks from the checkbox itself — its onChange already handles it.
                        const target = e.target as HTMLElement;
                        if (target.tagName === "INPUT") return;
                        toggleOne(i, e.shiftKey);
                      }}
                      className={
                        isSelected
                          ? "bg-emerald-50 border-l-4 border-brand-green cursor-pointer"
                          : "border-l-4 border-transparent hover:bg-slate-50 cursor-pointer"
                      }
                    >
                      <td className="px-3 py-2 border-b border-slate-100">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(i, false)}
                          onClick={(e) => {
                            // Honour shift+click on the checkbox itself.
                            if (e.shiftKey) {
                              e.preventDefault();
                              toggleOne(i, true);
                            }
                          }}
                          aria-label={`Include ${expense.merchant}`}
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600 border-b border-slate-100">
                        {formatDate(expense.expense_date)}
                      </td>
                      <td className="px-3 py-2 font-medium text-brand-navy border-b border-slate-100">
                        {expense.merchant}
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100">
                        {cat ? <Badge color={colorForCategory(cat.name)}>{cat.name}</Badge> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600 border-b border-slate-100">
                        {formatMoney(Number(expense.total_amount), expense.currency)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold border-b border-slate-100">
                        {formatMoney(Number(split.calculated_amount), expense.currency)}
                      </td>
                      <td className="px-3 py-2 text-slate-600 border-b border-slate-100">
                        {profilesById.get(expense.paid_by_user_id)?.display_name ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-white">
          {err && <p className="text-sm text-brand-danger mb-2">{err}</p>}
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <label className="label">Notes (optional)</label>
              <input
                className="input"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Settlement for January expenses"
              />
            </div>
            <div className="flex items-center gap-2 self-end">
              <span className="hidden md:inline text-xs text-slate-500 mr-2">
                Tip: shift-click to select a range
              </span>
              <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
                Cancel
              </button>
              <button className="btn-primary" disabled={pending || selected.size === 0}>
                {pending ? "Creating…" : `Create settlement (${selected.size})`}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
