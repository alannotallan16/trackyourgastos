"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSettlement } from "./actions";
import { findUnpaidShares, type UnpaidShare } from "@/lib/balances";
import { formatDate, formatMoney } from "@/lib/format";
import type { Category, Expense, ExpenseSplit, Profile } from "@/lib/types";
import { Badge, colorForCategory } from "@/components/ui/Badge";
import { ArrowRight, X } from "@/components/ui/icons";

interface Props {
  open: boolean;
  onClose: () => void;
  profiles: Profile[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  categories: Category[];
  initialParticipantAId?: string;
  initialParticipantBId?: string;
  suggestedAmount?: number;
}

const ROUND2 = (n: number) => Math.round(n * 100) / 100;

type Section = "AtoB" | "BtoA";

export function CreateSettlementModal({
  open,
  onClose,
  profiles,
  expenses,
  splits,
  categories,
  initialParticipantAId,
  initialParticipantBId,
  suggestedAmount
}: Props) {
  const router = useRouter();
  const profilesById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const defaultA = initialParticipantAId ?? profiles[0]?.id ?? "";
  const defaultB =
    initialParticipantBId ?? profiles.find((p) => p.id !== defaultA)?.id ?? profiles[1]?.id ?? "";

  const [aId, setAId] = useState(defaultA);
  const [bId, setBId] = useState(defaultB);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMerchant, setFilterMerchant] = useState("");
  const [detailed, setDetailed] = useState(true);

  const anchorRefA = useRef<number | null>(null);
  const anchorRefB = useRef<number | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // ----- Candidate sets (both directions) ---------------------------------
  const sharesAtoB = useMemo(
    () => (open ? findUnpaidShares(expenses, splits, aId, bId) : []),
    [open, expenses, splits, aId, bId]
  );
  const sharesBtoA = useMemo(
    () => (open ? findUnpaidShares(expenses, splits, bId, aId) : []),
    [open, expenses, splits, aId, bId]
  );

  // Reset selection & filters whenever the modal opens or A/B changes.
  useEffect(() => {
    if (!open) return;
    setFilterFrom("");
    setFilterTo("");
    setFilterCategory("");
    setFilterMerchant("");
    setNotes("");
    setErr(null);
    anchorRefA.current = null;
    anchorRefB.current = null;
    setSelected(new Set([...sharesAtoB.map((s) => s.split.id), ...sharesBtoA.map((s) => s.split.id)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, aId, bId]);

  // ----- Filters ---------------------------------------------------------
  function applyFilters(rows: UnpaidShare[]) {
    const merchantLower = filterMerchant.trim().toLowerCase();
    return rows.filter(({ expense }) => {
      if (filterFrom && expense.expense_date < filterFrom) return false;
      if (filterTo && expense.expense_date > filterTo) return false;
      if (filterCategory && expense.category_id !== filterCategory) return false;
      if (merchantLower && !expense.merchant.toLowerCase().includes(merchantLower)) return false;
      return true;
    });
  }
  const filteredAtoB = useMemo(
    () => applyFilters(sharesAtoB),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sharesAtoB, filterFrom, filterTo, filterCategory, filterMerchant]
  );
  const filteredBtoA = useMemo(
    () => applyFilters(sharesBtoA),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sharesBtoA, filterFrom, filterTo, filterCategory, filterMerchant]
  );

  // ----- Totals ----------------------------------------------------------
  function sumSelected(rows: UnpaidShare[]) {
    let s = 0;
    for (const r of rows) if (selected.has(r.split.id)) s += Number(r.split.calculated_amount);
    return ROUND2(s);
  }
  const grossAtoB = useMemo(() => sumSelected(sharesAtoB), [sharesAtoB, selected]);
  const grossBtoA = useMemo(() => sumSelected(sharesBtoA), [sharesBtoA, selected]);
  const netSigned = ROUND2(grossAtoB - grossBtoA);
  const netAbs = Math.abs(netSigned);
  const fullyOffset = netAbs < 0.005 && (grossAtoB > 0 || grossBtoA > 0);

  const netDebtorId = netSigned >= 0 ? aId : bId;
  const netCreditorId = netSigned >= 0 ? bId : aId;
  const aName = profilesById.get(aId)?.display_name ?? "A";
  const bName = profilesById.get(bId)?.display_name ?? "B";
  const netDebtorName = profilesById.get(netDebtorId)?.display_name ?? "—";
  const netCreditorName = profilesById.get(netCreditorId)?.display_name ?? "—";

  const totalSelectedCount = selected.size;
  const visibleCount = filteredAtoB.length + filteredBtoA.length;
  const candidateCount = sharesAtoB.length + sharesBtoA.length;

  // ----- Selection helpers ----------------------------------------------
  function applyRange(rows: UnpaidShare[], start: number, end: number, value: boolean) {
    const [a, b] = start <= end ? [start, end] : [end, start];
    setSelected((prev) => {
      const next = new Set(prev);
      for (let i = a; i <= b; i++) {
        const id = rows[i]?.split.id;
        if (!id) continue;
        if (value) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function toggleAt(section: Section, rows: UnpaidShare[], index: number, shiftKey: boolean) {
    const id = rows[index]?.split.id;
    if (!id) return;
    const wasSelected = selected.has(id);
    const nextValue = !wasSelected;
    const anchor = section === "AtoB" ? anchorRefA : anchorRefB;
    if (shiftKey && anchor.current != null) {
      applyRange(rows, anchor.current, index, nextValue);
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        if (nextValue) next.add(id);
        else next.delete(id);
        return next;
      });
    }
    anchor.current = index;
  }

  function selectAllInSection(rows: UnpaidShare[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of rows) next.add(r.split.id);
      return next;
    });
  }
  function clearInSection(rows: UnpaidShare[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of rows) next.delete(r.split.id);
      return next;
    });
  }
  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of [...filteredAtoB, ...filteredBtoA]) next.add(r.split.id);
      return next;
    });
  }
  function clearAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of [...filteredAtoB, ...filteredBtoA]) next.delete(r.split.id);
      return next;
    });
  }
  function resetFilters() {
    setFilterFrom("");
    setFilterTo("");
    setFilterCategory("");
    setFilterMerchant("");
  }

  // ----- Submit ----------------------------------------------------------
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (selected.size === 0) {
      setErr("Pick at least one expense share to include.");
      return;
    }
    if (grossAtoB === 0 && grossBtoA === 0) {
      setErr("Selected shares add up to zero — nothing to reconcile.");
      return;
    }
    start(async () => {
      try {
        const { id } = await createSettlement({
          participant_a_id: aId,
          participant_b_id: bId,
          currency: "PHP",
          split_ids: Array.from(selected),
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

  // Net direction copy
  const netCopy =
    fullyOffset
      ? "Fully offset — no payment needed"
      : netAbs > 0
        ? `${netDebtorName} pays ${netCreditorName}`
        : "No selection yet";
  const diffVsSuggested =
    suggestedAmount != null ? ROUND2(netAbs - suggestedAmount) : null;
  const diffColor =
    diffVsSuggested == null
      ? "text-slate-500"
      : Math.abs(diffVsSuggested) < 0.005
        ? "text-brand-green"
        : "text-amber-700";

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
              Reconcile unpaid expense shares between two people in both directions. The net amount is the only payment that has to change hands.
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

        {/* Filters */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 grid grid-cols-2 md:grid-cols-6 gap-2">
          <div>
            <label className="label">Participant A</label>
            <select className="input" value={aId} onChange={(e) => setAId(e.target.value)}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === bId}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Participant B</label>
            <select className="input" value={bId} onChange={(e) => setBId(e.target.value)}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === aId}>
                  {p.display_name}
                </option>
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

        {/* Netting summary bar */}
        <div className="px-5 py-3 border-b border-slate-200 bg-emerald-50/40">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
            <SummaryStat
              label={`${aName} → ${bName}`}
              value={formatMoney(grossAtoB)}
              hint={`${sharesAtoB.length} unpaid share${sharesAtoB.length === 1 ? "" : "s"} available`}
            />
            <SummaryStat
              label={`${bName} → ${aName}`}
              value={formatMoney(grossBtoA)}
              hint={`${sharesBtoA.length} unpaid share${sharesBtoA.length === 1 ? "" : "s"} available`}
            />
            <div
              className={`rounded-xl border px-3 py-2 ${
                fullyOffset
                  ? "bg-emerald-100/60 border-emerald-200"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Net result</div>
              <div className="mt-0.5 flex items-baseline gap-2 flex-wrap">
                <span className={`text-xl font-semibold tabular-nums ${fullyOffset ? "text-brand-green" : "text-brand-navy"}`}>
                  {fullyOffset ? "₱0.00" : formatMoney(netAbs)}
                </span>
                {!fullyOffset && netAbs > 0 && (
                  <span className="text-sm text-slate-600 inline-flex items-center gap-1">
                    {netDebtorName}
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                    {netCreditorName}
                  </span>
                )}
              </div>
              <div className="text-xs mt-0.5 text-slate-500">{netCopy}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                <span className="text-slate-500">Selected:</span>{" "}
                <strong className="text-brand-navy tabular-nums">{totalSelectedCount}</strong>
                <span className="text-slate-400 ml-1">/ {candidateCount}</span>
              </span>
              {visibleCount !== candidateCount && (
                <span className="text-slate-500">Showing {visibleCount} of {candidateCount} after filters</span>
              )}
              {suggestedAmount != null && (
                <span>
                  <span className="text-slate-500">Suggested net:</span>{" "}
                  <strong className="text-brand-navy tabular-nums">{formatMoney(suggestedAmount)}</strong>
                  {diffVsSuggested != null && (
                    <span className={`ml-1.5 tabular-nums ${diffColor}`}>
                      ({diffVsSuggested === 0 ? "match" : `${diffVsSuggested > 0 ? "+" : ""}${formatMoney(diffVsSuggested)}`})
                    </span>
                  )}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-secondary !py-1 !px-3 text-xs"
                onClick={selectAllVisible}
                disabled={visibleCount === 0}
              >
                Select all visible
              </button>
              <button
                type="button"
                className="btn-secondary !py-1 !px-3 text-xs"
                onClick={clearAllVisible}
                disabled={visibleCount === 0}
              >
                Clear visible
              </button>
              <button
                type="button"
                className="btn-ghost !py-1 !px-3 text-xs"
                onClick={resetFilters}
              >
                Reset filters
              </button>
              <button
                type="button"
                className="btn-ghost !py-1 !px-3 text-xs"
                onClick={() => setDetailed((v) => !v)}
              >
                {detailed ? "Net view" : "Detailed view"}
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto">
          {!detailed ? (
            <div className="p-6 md:p-10 text-sm space-y-4">
              <div className="card max-w-xl mx-auto">
                <h3 className="font-semibold text-brand-navy mb-2">Reconciliation summary</h3>
                <ul className="space-y-1 text-slate-700">
                  <li className="flex justify-between"><span>{aName} owes {bName}</span><span className="tabular-nums">{formatMoney(grossAtoB)}</span></li>
                  <li className="flex justify-between"><span>{bName} owes {aName}</span><span className="tabular-nums">{formatMoney(grossBtoA)}</span></li>
                  <li className="flex justify-between border-t border-slate-200 pt-2 mt-2 font-semibold text-brand-navy">
                    <span>Net</span>
                    <span className="tabular-nums">{fullyOffset ? "₱0.00 (offset)" : formatMoney(netAbs)}</span>
                  </li>
                </ul>
                <p className="mt-3 text-xs text-slate-500">{netCopy}</p>
              </div>
            </div>
          ) : (
            <>
              <BilateralSection
                title={`${aName} owes ${bName}`}
                subtitle="A→B direction"
                rows={filteredAtoB}
                allRows={sharesAtoB}
                selected={selected}
                onToggle={(index, shiftKey) => toggleAt("AtoB", filteredAtoB, index, shiftKey)}
                onSelectAll={() => selectAllInSection(filteredAtoB)}
                onClear={() => clearInSection(filteredAtoB)}
                profilesById={profilesById}
                categoriesById={categoriesById}
              />
              <BilateralSection
                title={`${bName} owes ${aName}`}
                subtitle="B→A direction (offsets)"
                rows={filteredBtoA}
                allRows={sharesBtoA}
                selected={selected}
                onToggle={(index, shiftKey) => toggleAt("BtoA", filteredBtoA, index, shiftKey)}
                onSelectAll={() => selectAllInSection(filteredBtoA)}
                onClear={() => clearInSection(filteredBtoA)}
                profilesById={profilesById}
                categoriesById={categoriesById}
                offsetStyle
              />
            </>
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
                placeholder="e.g. January reconciliation between Mari Len and Alan"
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
                {pending
                  ? "Creating…"
                  : fullyOffset
                    ? "Create settlement (offset)"
                    : `Create settlement (${formatMoney(netAbs)})`}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SummaryStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 truncate">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums text-brand-navy">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

interface SectionProps {
  title: string;
  subtitle: string;
  rows: UnpaidShare[];
  allRows: UnpaidShare[];
  selected: Set<string>;
  onToggle: (index: number, shiftKey: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
  profilesById: Map<string, Profile>;
  categoriesById: Map<string, Category>;
  offsetStyle?: boolean;
}

function BilateralSection({
  title,
  subtitle,
  rows,
  allRows,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  profilesById,
  categoriesById,
  offsetStyle
}: SectionProps) {
  const visibleSelectedCount = rows.reduce((n, r) => (selected.has(r.split.id) ? n + 1 : n), 0);
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.split.id));
  const someChecked = visibleSelectedCount > 0 && !allChecked;
  const subtotal = rows.reduce(
    (s, r) => (selected.has(r.split.id) ? s + Number(r.split.calculated_amount) : s),
    0
  );

  return (
    <section className="border-b border-slate-100 last:border-b-0">
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-5 py-2 ${
          offsetStyle ? "bg-amber-50/60" : "bg-slate-50"
        }`}
      >
        <div>
          <h3 className="text-sm font-semibold text-brand-navy">{title}</h3>
          <p className="text-[11px] text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">
            Selected <strong className="text-brand-navy tabular-nums">{visibleSelectedCount}</strong> / {rows.length}
            {rows.length < allRows.length && (
              <span className="text-slate-400 ml-1">({allRows.length} total)</span>
            )}{" "}
            · <strong className="text-brand-navy tabular-nums">{formatMoney(Math.round(subtotal * 100) / 100)}</strong>
          </span>
          <button
            type="button"
            className="btn-secondary !py-1 !px-2.5 text-[11px]"
            onClick={onSelectAll}
            disabled={rows.length === 0 || allChecked}
          >
            Select all
          </button>
          <button
            type="button"
            className="btn-secondary !py-1 !px-2.5 text-[11px]"
            onClick={onClear}
            disabled={visibleSelectedCount === 0}
          >
            Clear
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">
          {allRows.length === 0
            ? "No unpaid shares in this direction."
            : "No shares match the current filters."}
        </p>
      ) : (
        <table className="min-w-full text-sm select-none">
          <thead className="bg-white">
            <tr>
              <th className="px-3 py-1.5 text-left w-10 border-b border-slate-100">
                <input
                  type="checkbox"
                  aria-label={`Select all in ${title}`}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  checked={allChecked}
                  onChange={() => (allChecked ? onClear() : onSelectAll())}
                />
              </th>
              <th className="px-3 py-1.5 text-left text-xs uppercase tracking-wide text-slate-600 border-b border-slate-100">Date</th>
              <th className="px-3 py-1.5 text-left text-xs uppercase tracking-wide text-slate-600 border-b border-slate-100">Merchant</th>
              <th className="px-3 py-1.5 text-left text-xs uppercase tracking-wide text-slate-600 border-b border-slate-100">Category</th>
              <th className="px-3 py-1.5 text-right text-xs uppercase tracking-wide text-slate-600 border-b border-slate-100">Total</th>
              <th className="px-3 py-1.5 text-right text-xs uppercase tracking-wide text-slate-600 border-b border-slate-100">Owed</th>
              <th className="px-3 py-1.5 text-left text-xs uppercase tracking-wide text-slate-600 border-b border-slate-100">Paid by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ split, expense }, i) => {
              const cat = expense.category_id ? categoriesById.get(expense.category_id) : null;
              const isSelected = selected.has(split.id);
              return (
                <tr
                  key={split.id}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.tagName === "INPUT") return;
                    onToggle(i, e.shiftKey);
                  }}
                  className={
                    isSelected
                      ? `${offsetStyle ? "bg-amber-50" : "bg-emerald-50"} border-l-4 ${offsetStyle ? "border-amber-500" : "border-brand-green"} cursor-pointer`
                      : "border-l-4 border-transparent hover:bg-slate-50 cursor-pointer"
                  }
                >
                  <td className="px-3 py-2 border-b border-slate-100">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(i, false)}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          e.preventDefault();
                          onToggle(i, true);
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
    </section>
  );
}
