"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import type { Category, Expense, ExpenseSplit, Profile, SettlementBatch } from "@/lib/types";
import { Badge, colorForCategory } from "@/components/ui/Badge";
import { ChevronLeft, ChevronRight, Paperclip } from "@/components/ui/icons";
import { ExpenseDetailDrawer } from "@/components/ExpenseDetailDrawer";

interface Props {
  expenses: Expense[];
  splits: ExpenseSplit[];
  profiles: Profile[];
  categories: Category[];
  batches: SettlementBatch[];
}

type ExpenseStatus = "unpaid" | "in_settlement" | "partially_settled" | "settled";

function aggregateStatus(splits: ExpenseSplit[]): ExpenseStatus {
  if (splits.length === 0) return "unpaid";
  if (splits.some((s) => s.settlement_status === "in_settlement")) return "in_settlement";
  const allSettled = splits.every((s) => s.settlement_status === "settled");
  if (allSettled) return "settled";
  const someSettled = splits.some((s) => s.settlement_status === "settled");
  if (someSettled) return "partially_settled";
  return "unpaid";
}

function StatusBadge({ status }: { status: ExpenseStatus }) {
  const map = {
    unpaid: { color: "gray", label: "Unpaid" },
    in_settlement: { color: "orange", label: "In settlement" },
    partially_settled: { color: "blue", label: "Partially settled" },
    settled: { color: "green", label: "Settled" }
  } as const;
  const cfg = map[status];
  return <Badge color={cfg.color as any}>{cfg.label}</Badge>;
}

type SortKey = "date" | "paid_by" | "merchant" | "category" | "total" | `share:${string}`;
type SortDir = "asc" | "desc";
type PageSize = 25 | 50 | 100 | "all";

const PAGE_SIZES: PageSize[] = [25, 50, 100, "all"];

type StatusFilter = "" | ExpenseStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string; color: "gray" | "orange" | "blue" | "green" | "navy" }[] = [
  { key: "", label: "All", color: "navy" },
  { key: "unpaid", label: "Unpaid", color: "gray" },
  { key: "in_settlement", label: "In settlement", color: "orange" },
  { key: "partially_settled", label: "Partially settled", color: "blue" },
  { key: "settled", label: "Settled", color: "green" }
];

export function ExpenseTable({ expenses, splits, profiles, categories, batches }: Props) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [merchant, setMerchant] = useState("");
  const [currency, setCurrency] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [detailExpenseId, setDetailExpenseId] = useState<string | null>(null);

  const profilesById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const splitsByExpense = useMemo(() => {
    const m = new Map<string, ExpenseSplit[]>();
    for (const s of splits) {
      if (!m.has(s.expense_id)) m.set(s.expense_id, []);
      m.get(s.expense_id)!.push(s);
    }
    return m;
  }, [splits]);

  const statusByExpense = useMemo(() => {
    const m = new Map<string, ExpenseStatus>();
    for (const e of expenses) m.set(e.id, aggregateStatus(splitsByExpense.get(e.id) ?? []));
    return m;
  }, [expenses, splitsByExpense]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (from && e.expense_date < from) return false;
      if (to && e.expense_date > to) return false;
      if (paidBy && e.paid_by_user_id !== paidBy) return false;
      if (categoryId && e.category_id !== categoryId) return false;
      if (currency && e.currency !== currency) return false;
      if (merchant && !e.merchant.toLowerCase().includes(merchant.toLowerCase())) return false;
      if (statusFilter && statusByExpense.get(e.id) !== statusFilter) return false;
      return true;
    });
  }, [expenses, from, to, paidBy, categoryId, currency, merchant, statusFilter, statusByExpense]);

  // Counts respect every filter except the status one, so the chip numbers
  // reflect "how many of the rows I'm looking at fall into each bucket"
  // rather than "how many in the whole dataset".
  const statusCounts = useMemo(() => {
    const base = expenses.filter((e) => {
      if (from && e.expense_date < from) return false;
      if (to && e.expense_date > to) return false;
      if (paidBy && e.paid_by_user_id !== paidBy) return false;
      if (categoryId && e.category_id !== categoryId) return false;
      if (currency && e.currency !== currency) return false;
      if (merchant && !e.merchant.toLowerCase().includes(merchant.toLowerCase())) return false;
      return true;
    });
    const counts = { unpaid: 0, in_settlement: 0, partially_settled: 0, settled: 0 } as Record<ExpenseStatus, number>;
    for (const e of base) counts[statusByExpense.get(e.id) ?? "unpaid"]++;
    return { all: base.length, ...counts };
  }, [expenses, from, to, paidBy, categoryId, currency, merchant, statusByExpense]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "date") {
        av = a.expense_date;
        bv = b.expense_date;
      } else if (sortKey === "merchant") {
        av = a.merchant.toLowerCase();
        bv = b.merchant.toLowerCase();
      } else if (sortKey === "total") {
        av = Number(a.total_amount);
        bv = Number(b.total_amount);
      } else if (sortKey === "paid_by") {
        av = profilesById.get(a.paid_by_user_id)?.display_name ?? "";
        bv = profilesById.get(b.paid_by_user_id)?.display_name ?? "";
      } else if (sortKey === "category") {
        av = (a.category_id && categoriesById.get(a.category_id)?.name) || "";
        bv = (b.category_id && categoriesById.get(b.category_id)?.name) || "";
      } else if (sortKey.startsWith("share:")) {
        const uid = sortKey.slice(6);
        av = Number(splitsByExpense.get(a.id)?.find((s) => s.user_id === uid)?.calculated_amount ?? 0);
        bv = Number(splitsByExpense.get(b.id)?.find((s) => s.user_id === uid)?.calculated_amount ?? 0);
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.id < b.id ? -1 : 1;
    });
    return arr;
  }, [filtered, sortKey, sortDir, profilesById, categoriesById, splitsByExpense]);

  const totalRows = sorted.length;
  const effectivePageSize = pageSize === "all" ? Math.max(totalRows, 1) : pageSize;
  const pageCount = Math.max(1, Math.ceil(totalRows / effectivePageSize));
  const safePage = Math.min(page, pageCount);
  const startIdx = (safePage - 1) * effectivePageSize;
  const visible = useMemo(
    () => sorted.slice(startIdx, startIdx + effectivePageSize),
    [sorted, startIdx, effectivePageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [from, to, paidBy, categoryId, merchant, currency, statusFilter, sortKey, sortDir, pageSize]);

  const currencies = useMemo(() => Array.from(new Set(expenses.map((e) => e.currency))), [expenses]);
  const totalAmount = filtered.reduce((a, b) => a + Number(b.total_amount), 0);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "date" || key === "total" || key.startsWith("share:") ? "desc" : "asc");
    }
  };
  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  const sortableHeader = (key: SortKey, label: string, align: "left" | "right" = "left") => (
    <th className={`table-cell text-${align}`}>
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`inline-flex items-center gap-1 font-semibold uppercase text-xs tracking-wide text-slate-600 hover:text-brand-green ${
          align === "right" ? "justify-end w-full" : ""
        }`}
      >
        <span>{label}</span>
        <span className="text-slate-400 text-[10px]">{arrow(key)}</span>
      </button>
    </th>
  );

  const lastVisibleIdx = totalRows === 0 ? 0 : Math.min(startIdx + effectivePageSize, totalRows);
  const firstVisibleIdx = totalRows === 0 ? 0 : startIdx + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.key;
          const count = f.key === "" ? statusCounts.all : statusCounts[f.key];
          return (
            <button
              key={f.key || "all"}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              aria-pressed={active}
              className={
                active
                  ? "inline-flex items-center gap-1.5 rounded-full bg-brand-gradient text-white px-3 py-1 text-xs font-medium shadow-sm"
                  : "inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 text-brand-navy px-3 py-1 text-xs font-medium hover:bg-slate-50"
              }
            >
              <span>{f.label}</span>
              <span className={active ? "bg-white/20 rounded px-1.5 py-0.5 text-[10px]" : "text-slate-500 text-[10px]"}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="card grid grid-cols-2 md:grid-cols-6 gap-2">
        <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
        <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
        <select className="input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
          <option value="">Paid by (any)</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
        <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Category (any)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input className="input" placeholder="Merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
        <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option value="">Currency (any)</option>
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="hidden md:table min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {sortableHeader("date", "Date")}
              {sortableHeader("paid_by", "Paid by")}
              {sortableHeader("merchant", "Merchant")}
              {sortableHeader("category", "Category")}
              {sortableHeader("total", "Total", "right")}
              <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Cur</th>
              <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Status</th>
              {profiles.map((p) => (
                <th key={p.id} className="table-cell text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort(`share:${p.id}` as SortKey)}
                    className="inline-flex items-center justify-end w-full gap-1 font-semibold uppercase text-xs tracking-wide text-slate-600 hover:text-brand-green"
                  >
                    <span>{p.display_name}</span>
                    <span className="text-slate-400 text-[10px]">{arrow(`share:${p.id}` as SortKey)}</span>
                  </button>
                </th>
              ))}
              <th className="table-cell text-center">
                <Paperclip className="h-4 w-4 inline text-slate-400" />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td className="table-cell" colSpan={7 + profiles.length + 1}>
                  <p className="text-slate-500 text-center py-6">No expenses match these filters.</p>
                </td>
              </tr>
            )}
            {visible.map((e) => {
              const sp = splitsByExpense.get(e.id) ?? [];
              const cat = e.category_id ? categoriesById.get(e.category_id) : null;
              return (
                <tr
                  key={e.id}
                  onClick={() => setDetailExpenseId(e.id)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="table-cell whitespace-nowrap">
                    <button
                      type="button"
                      className="text-brand-navy font-medium hover:text-brand-green"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setDetailExpenseId(e.id);
                      }}
                    >
                      {formatDate(e.expense_date)}
                    </button>
                  </td>
                  <td className="table-cell text-slate-700">{profilesById.get(e.paid_by_user_id)?.display_name ?? "—"}</td>
                  <td className="table-cell font-medium">{e.merchant}</td>
                  <td className="table-cell">
                    {cat ? <Badge color={colorForCategory(cat.name)}>{cat.name}</Badge> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="table-cell text-right tabular-nums font-medium">{formatMoney(Number(e.total_amount), e.currency)}</td>
                  <td className="table-cell text-slate-500 text-xs">{e.currency}</td>
                  <td className="table-cell"><StatusBadge status={aggregateStatus(sp)} /></td>
                  {profiles.map((p) => {
                    const s = sp.find((x) => x.user_id === p.id);
                    return (
                      <td key={p.id} className="table-cell text-right tabular-nums text-slate-700">
                        {s ? formatMoney(Number(s.calculated_amount), e.currency) : <span className="text-slate-300">—</span>}
                      </td>
                    );
                  })}
                  <td className="table-cell text-center">
                    {e.receipt_file_id ? <Paperclip className="h-4 w-4 inline text-brand-blue" /> : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-medium">
              <td className="table-cell" colSpan={4}>
                {filtered.length} expense(s)
              </td>
              <td className="table-cell text-right tabular-nums">{formatMoney(totalAmount)}</td>
              <td className="table-cell" colSpan={2 + profiles.length + 1}></td>
            </tr>
          </tfoot>
        </table>

        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-slate-100">
          {visible.length === 0 && (
            <p className="text-slate-500 text-center py-8 text-sm">No expenses match these filters.</p>
          )}
          {visible.map((e) => {
            const sp = splitsByExpense.get(e.id) ?? [];
            const cat = e.category_id ? categoriesById.get(e.category_id) : null;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setDetailExpenseId(e.id)}
                className="block w-full text-left px-4 py-3 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-brand-navy truncate">{e.merchant}</span>
                      {e.receipt_file_id && <Paperclip className="h-3.5 w-3.5 text-brand-blue shrink-0" />}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span>{formatDate(e.expense_date)}</span>
                      <span>·</span>
                      <span>Paid by {profilesById.get(e.paid_by_user_id)?.display_name ?? "—"}</span>
                      {cat && <Badge color={colorForCategory(cat.name)} className="ml-1">{cat.name}</Badge>}
                      <StatusBadge status={aggregateStatus(sp)} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      {profiles.map((p) => {
                        const s = sp.find((x) => x.user_id === p.id);
                        if (!s) return null;
                        return (
                          <span key={p.id} className="tabular-nums">
                            <span className="text-slate-400">{p.display_name}</span>{" "}
                            <span className="text-slate-700">{formatMoney(Number(s.calculated_amount), e.currency)}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold tabular-nums text-brand-navy">
                      {formatMoney(Number(e.total_amount), e.currency)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">{e.currency}</div>
                  </div>
                </div>
              </button>
            );
          })}
          <div className="px-4 py-3 bg-slate-50 flex items-center justify-between text-sm">
            <span className="text-slate-500">{filtered.length} expense(s)</span>
            <span className="font-medium tabular-nums">{formatMoney(totalAmount)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 bg-white">
          <div>
            Showing {firstVisibleIdx}–{lastVisibleIdx} of {totalRows}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Rows</span>
              <select
                className="input !w-auto !py-1.5 !px-2 text-sm"
                value={String(pageSize)}
                onChange={(e) => {
                  const v = e.target.value;
                  setPageSize(v === "all" ? "all" : (Number(v) as PageSize));
                }}
              >
                {PAGE_SIZES.map((s) => (
                  <option key={String(s)} value={String(s)}>
                    {s === "all" ? "All" : s}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn-secondary !py-1.5 !px-2.5 text-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-slate-500">
              Page {safePage} of {pageCount}
            </span>
            <button
              type="button"
              className="btn-secondary !py-1.5 !px-2.5 text-sm"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={safePage >= pageCount}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {detailExpenseId &&
        (() => {
          const e = expenses.find((x) => x.id === detailExpenseId);
          if (!e) return null;
          return (
            <ExpenseDetailDrawer
              expense={e}
              splits={splitsByExpense.get(e.id) ?? []}
              profiles={profiles}
              categories={categories}
              batches={batches}
              onClose={() => setDetailExpenseId(null)}
            />
          );
        })()}
    </div>
  );
}
