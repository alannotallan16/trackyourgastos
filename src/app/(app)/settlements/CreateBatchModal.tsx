"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSettlementBatch } from "./actions";
import { computeHouseholdNet, settlementSuggestions } from "@/lib/balances";
import { formatDate, formatMoney } from "@/lib/format";
import type { Category, Expense, ExpenseSplit, Profile } from "@/lib/types";
import { Badge, colorForCategory } from "@/components/ui/Badge";
import { DateField } from "@/components/ui/DateField";
import { ArrowRight, X } from "@/components/ui/icons";

interface Props {
  open: boolean;
  onClose: () => void;
  profiles: Profile[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  categories: Category[];
}

const ROUND2 = (n: number) => Math.round(n * 100) / 100;

export function CreateBatchModal({ open, onClose, profiles, expenses, splits, categories }: Props) {
  const router = useRouter();

  const profilesById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Group splits by expense for fast lookup + status aggregation.
  const splitsByExpense = useMemo(() => {
    const m = new Map<string, ExpenseSplit[]>();
    for (const s of splits) {
      if (!m.has(s.expense_id)) m.set(s.expense_id, []);
      m.get(s.expense_id)!.push(s);
    }
    return m;
  }, [splits]);

  // Only expenses with EVERY split currently "unpaid" can be added to a new
  // batch. (Partially-settled expenses must be cancelled first.)
  const eligibleExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const sp = splitsByExpense.get(e.id) ?? [];
      return sp.length > 0 && sp.every((s) => s.settlement_status === "unpaid");
    });
  }, [expenses, splitsByExpense]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMerchant, setFilterMerchant] = useState("");
  const [filterPayer, setFilterPayer] = useState("");

  const anchorRef = useRef<number | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  // Mobile-only collapsible sections so the expense list has room to breathe.
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [mobileNotesOpen, setMobileNotesOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(eligibleExpenses.map((e) => e.id)));
    setNotes("");
    setFilterFrom("");
    setFilterTo("");
    setFilterCategory("");
    setFilterMerchant("");
    setFilterPayer("");
    setMobileFiltersOpen(false);
    setMobileSummaryOpen(false);
    setMobileNotesOpen(false);
    setErr(null);
    anchorRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    const merchantLower = filterMerchant.trim().toLowerCase();
    return eligibleExpenses.filter((e) => {
      if (filterFrom && e.expense_date < filterFrom) return false;
      if (filterTo && e.expense_date > filterTo) return false;
      if (filterCategory && e.category_id !== filterCategory) return false;
      if (filterPayer && e.paid_by_user_id !== filterPayer) return false;
      if (merchantLower && !e.merchant.toLowerCase().includes(merchantLower)) return false;
      return true;
    });
  }, [eligibleExpenses, filterFrom, filterTo, filterCategory, filterPayer, filterMerchant]);

  // Live household-net preview over the *selected* expenses.
  const preview = useMemo(() => {
    if (selected.size === 0) {
      return { balances: profiles.map((p) => ({ user_id: p.id, paid: 0, owed: 0, net: 0 })), suggestions: [] };
    }
    const selExpenses = eligibleExpenses.filter((e) => selected.has(e.id));
    const selSplits: ExpenseSplit[] = [];
    for (const e of selExpenses) {
      const sp = splitsByExpense.get(e.id) ?? [];
      selSplits.push(...sp);
    }
    const balances = computeHouseholdNet(profiles, selExpenses, selSplits);
    const suggestions = settlementSuggestions(balances);
    return { balances, suggestions };
  }, [selected, eligibleExpenses, splitsByExpense, profiles]);

  // ---------- selection helpers ----------
  function toggleAt(index: number, shiftKey: boolean) {
    const expense = filtered[index];
    if (!expense) return;
    const wasSelected = selected.has(expense.id);
    const nextValue = !wasSelected;

    if (shiftKey && anchorRef.current != null) {
      const [a, b] = anchorRef.current <= index ? [anchorRef.current, index] : [index, anchorRef.current];
      setSelected((prev) => {
        const next = new Set(prev);
        for (let i = a; i <= b; i++) {
          const id = filtered[i]?.id;
          if (!id) continue;
          if (nextValue) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        if (nextValue) next.add(expense.id);
        else next.delete(expense.id);
        return next;
      });
    }
    anchorRef.current = index;
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of filtered) next.add(e.id);
      return next;
    });
  }
  function clearAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of filtered) next.delete(e.id);
      return next;
    });
  }
  function resetFilters() {
    setFilterFrom("");
    setFilterTo("");
    setFilterCategory("");
    setFilterMerchant("");
    setFilterPayer("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (selected.size === 0) {
      setErr("Pick at least one expense to include.");
      return;
    }
    if (preview.suggestions.length === 0) {
      setErr("Selected expenses already reconcile to zero — nothing to settle.");
      return;
    }
    start(async () => {
      try {
        const { id } = await createSettlementBatch({
          expense_ids: Array.from(selected),
          notes: notes || null,
          currency: "PHP"
        });
        onClose();
        router.push(`/settlements/${id}`);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to create settlement.");
      }
    });
  }

  if (!open) return null;

  const visibleSelectedCount = filtered.reduce((n, e) => (selected.has(e.id) ? n + 1 : n), 0);
  const allVisibleSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;
  const hiddenSelected = selected.size - visibleSelectedCount;

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
              Pick the expenses you want to reconcile. The app computes each person's household net and the
              minimum payments to bring everyone to zero.
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

        {/* Mobile-only filter toggle */}
        {(() => {
          const activeFilterCount =
            (filterFrom ? 1 : 0) +
            (filterTo ? 1 : 0) +
            (filterCategory ? 1 : 0) +
            (filterPayer ? 1 : 0) +
            (filterMerchant.trim() ? 1 : 0);
          return (
            <div className="md:hidden flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50/60">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((o) => !o)}
                className="flex-1 inline-flex items-center justify-between rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-brand-navy"
                aria-expanded={mobileFiltersOpen}
              >
                <span className="font-medium">
                  Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
                </span>
                <span className="text-slate-400 text-xs">{mobileFiltersOpen ? "Hide" : "Show"}</span>
              </button>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>
          );
        })()}

        {/* Filters */}
        <div className={`${mobileFiltersOpen ? "" : "hidden"} md:block px-5 py-3 border-b border-slate-100 bg-slate-50/60`}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div>
              <label className="label">From date</label>
              <DateField value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} placeholder="From date" />
            </div>
            <div>
              <label className="label">To date</label>
              <DateField value={filterTo} onChange={(e) => setFilterTo(e.target.value)} placeholder="To date" />
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
              <label className="label">Paid by</label>
              <select className="input" value={filterPayer} onChange={(e) => setFilterPayer(e.target.value)}>
                <option value="">Anyone</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
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
        </div>

        {/* Mobile-only summary toggle */}
        <div className="md:hidden flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-emerald-50/40">
          <button
            type="button"
            onClick={() => setMobileSummaryOpen((o) => !o)}
            className="flex-1 inline-flex items-center justify-between rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-brand-navy"
            aria-expanded={mobileSummaryOpen}
          >
            <span className="font-medium">
              {selected.size} selected · {preview.suggestions.length} payment
              {preview.suggestions.length === 1 ? "" : "s"}
            </span>
            <span className="text-slate-400 text-xs">{mobileSummaryOpen ? "Hide" : "Show"}</span>
          </button>
        </div>

        {/* Sticky summary */}
        <div className={`${mobileSummaryOpen ? "" : "hidden"} md:block px-5 py-3 border-b border-slate-200 bg-emerald-50/40 space-y-2`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Household net (selected)</div>
              {preview.balances.length === 0 ? (
                <p className="text-xs text-slate-500">No participants.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {preview.balances.map((b) => {
                    const p = profilesById.get(b.user_id);
                    const sign = b.net > 0.005 ? "+" : "";
                    const color =
                      b.net > 0.005 ? "text-brand-green" : b.net < -0.005 ? "text-brand-danger" : "text-slate-500";
                    return (
                      <li key={b.user_id} className="flex items-center justify-between gap-3">
                        <span className="font-medium text-brand-navy">{p?.display_name ?? "—"}</span>
                        <span className="text-xs text-slate-500 tabular-nums">
                          Paid {formatMoney(b.paid)} · Share {formatMoney(b.owed)}
                        </span>
                        <span className={`text-sm font-semibold tabular-nums ${color}`}>
                          {sign}{formatMoney(b.net)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Generated payments</div>
              {preview.suggestions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {selected.size === 0
                    ? "Select expenses to preview the settlement plan."
                    : "Already reconciles to zero."}
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {preview.suggestions.map((s, i) => (
                    <li key={i} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium text-brand-navy">{profilesById.get(s.from_user_id)?.display_name}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium text-brand-navy">{profilesById.get(s.to_user_id)?.display_name}</span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-brand-navy">{formatMoney(s.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>

        {/* Bulk action bar — always visible on both desktop and mobile */}
        <div className="px-4 md:px-5 py-2 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="hidden md:flex items-center gap-x-3 text-slate-500 flex-wrap">
            <span>
              Selected:{" "}
              <strong className="text-brand-navy tabular-nums">{selected.size}</strong>
              {hiddenSelected > 0 && (
                <span className="ml-1">({hiddenSelected} hidden by filters)</span>
              )}
            </span>
            <span>
              Showing {filtered.length} of {eligibleExpenses.length} unsettled expense{eligibleExpenses.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 w-full md:w-auto">
            <button
              type="button"
              className="btn-secondary !py-1 !px-2.5 text-xs flex-1 md:flex-none"
              onClick={selectAllVisible}
              disabled={filtered.length === 0 || allVisibleSelected}
            >
              Select all
            </button>
            <button
              type="button"
              className="btn-secondary !py-1 !px-2.5 text-xs flex-1 md:flex-none"
              onClick={clearAllVisible}
              disabled={visibleSelectedCount === 0}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn-ghost !py-1 !px-2.5 text-xs flex-1 md:flex-none"
              onClick={resetFilters}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Expense table (desktop) + card list (mobile) */}
        <div className="flex-1 min-h-0 overflow-auto">
          {filtered.length === 0 ? (
            <div className="h-full flex items-center justify-center px-6 py-12">
              <p className="text-sm text-slate-500 text-center">
                {eligibleExpenses.length === 0
                  ? "No unsettled expenses to reconcile right now."
                  : "No expenses match the current filters."}
              </p>
            </div>
          ) : (
            <>
              <table className="hidden md:table min-w-full text-sm select-none">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left w-10 border-b border-slate-200">
                      <input
                        type="checkbox"
                        aria-label="Select all visible"
                        ref={(el) => {
                          if (el) el.indeterminate = someVisibleSelected;
                        }}
                        checked={allVisibleSelected}
                        onChange={(e) => (e.target.checked ? selectAllVisible() : clearAllVisible())}
                      />
                    </th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">Date</th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">Merchant</th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">Category</th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">Paid by</th>
                    <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, i) => {
                    const cat = e.category_id ? categoriesById.get(e.category_id) : null;
                    const isSelected = selected.has(e.id);
                    return (
                      <tr
                        key={e.id}
                        onClick={(ev) => {
                          const target = ev.target as HTMLElement;
                          if (target.tagName === "INPUT") return;
                          toggleAt(i, ev.shiftKey);
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
                            onChange={() => toggleAt(i, false)}
                            onClick={(ev) => {
                              if (ev.shiftKey) {
                                ev.preventDefault();
                                toggleAt(i, true);
                              }
                            }}
                            aria-label={`Include ${e.merchant}`}
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600 border-b border-slate-100">
                          {formatDate(e.expense_date)}
                        </td>
                        <td className="px-3 py-2 font-medium text-brand-navy border-b border-slate-100">{e.merchant}</td>
                        <td className="px-3 py-2 border-b border-slate-100">
                          {cat ? <Badge color={colorForCategory(cat.name)}>{cat.name}</Badge> : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-600 border-b border-slate-100">
                          {profilesById.get(e.paid_by_user_id)?.display_name ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold border-b border-slate-100">
                          {formatMoney(Number(e.total_amount), e.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile card list — large tap targets, no shift-click needed */}
              <ul className="md:hidden divide-y divide-slate-100 select-none">
                {filtered.map((e, i) => {
                  const cat = e.category_id ? categoriesById.get(e.category_id) : null;
                  const isSelected = selected.has(e.id);
                  return (
                    <li
                      key={e.id}
                      onClick={() => toggleAt(i, false)}
                      className={
                        isSelected
                          ? "flex items-start gap-3 px-4 py-3 bg-emerald-50 border-l-4 border-brand-green active:bg-emerald-100"
                          : "flex items-start gap-3 px-4 py-3 border-l-4 border-transparent hover:bg-slate-50 active:bg-slate-100"
                      }
                    >
                      <span
                        aria-hidden="true"
                        className={
                          isSelected
                            ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-green text-white"
                            : "mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 border-slate-300 bg-white"
                        }
                      >
                        {isSelected && (
                          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 8l3.5 3.5L13 5" />
                          </svg>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-brand-navy truncate">{e.merchant}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <span>{formatDate(e.expense_date)}</span>
                          <span>·</span>
                          <span>Paid by {profilesById.get(e.paid_by_user_id)?.display_name ?? "—"}</span>
                          {cat && <Badge color={colorForCategory(cat.name)}>{cat.name}</Badge>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold tabular-nums text-brand-navy">
                          {formatMoney(Number(e.total_amount), e.currency)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 md:px-5 py-3 border-t border-slate-200 bg-white pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          {err && <p className="text-sm text-brand-danger mb-2">{err}</p>}

          {/* Desktop: inline notes + buttons */}
          <div className="hidden md:flex md:items-end gap-3">
            <div className="flex-1">
              <label className="label">Notes (optional)</label>
              <input
                className="input"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. End-of-month reconciliation"
              />
            </div>
            <div className="flex items-center gap-2 self-end">
              <span className="text-xs text-slate-500 mr-2">
                Tip: shift-click to select a range
              </span>
              <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
                Cancel
              </button>
              <button className="btn-primary" disabled={pending || preview.suggestions.length === 0}>
                {pending
                  ? "Creating…"
                  : preview.suggestions.length === 0
                    ? "Create settlement"
                    : `Create settlement (${preview.suggestions.length} payment${preview.suggestions.length === 1 ? "" : "s"})`}
              </button>
            </div>
          </div>

          {/* Mobile: collapsible notes + stacked buttons */}
          <div className="md:hidden space-y-2">
            {!mobileNotesOpen ? (
              <button
                type="button"
                onClick={() => setMobileNotesOpen(true)}
                className="w-full text-left text-xs text-brand-green font-medium"
              >
                {notes ? `Notes: ${notes}` : "+ Add notes (optional)"}
              </button>
            ) : (
              <input
                className="input"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. End-of-month reconciliation"
                autoFocus
              />
            )}
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={pending}>
                Cancel
              </button>
              <button className="btn-primary flex-1" disabled={pending || preview.suggestions.length === 0}>
                {pending
                  ? "Creating…"
                  : preview.suggestions.length === 0
                    ? "Create"
                    : `Create (${preview.suggestions.length})`}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

// Re-rounding helper exported for the badge math elsewhere (kept here so the
// modal file is the single source of truth for ROUND2).
export const __ROUND2_FOR_TESTS = ROUND2;
