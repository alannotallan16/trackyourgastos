"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import type { Category, Expense, ExpenseSplit, Profile } from "@/lib/types";

interface Props {
  expenses: Expense[];
  splits: ExpenseSplit[];
  profiles: Profile[];
  categories: Category[];
}

export function ExpenseTable({ expenses, splits, profiles, categories }: Props) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [merchant, setMerchant] = useState("");
  const [currency, setCurrency] = useState("");

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

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (from && e.expense_date < from) return false;
      if (to && e.expense_date > to) return false;
      if (paidBy && e.paid_by_user_id !== paidBy) return false;
      if (categoryId && e.category_id !== categoryId) return false;
      if (currency && e.currency !== currency) return false;
      if (merchant && !e.merchant.toLowerCase().includes(merchant.toLowerCase())) return false;
      return true;
    });
  }, [expenses, from, to, paidBy, categoryId, currency, merchant]);

  const currencies = useMemo(() => Array.from(new Set(expenses.map((e) => e.currency))), [expenses]);
  const totalAmount = filtered.reduce((a, b) => a + Number(b.total_amount), 0);

  return (
    <div className="space-y-3">
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

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="table-cell text-left">Date</th>
              <th className="table-cell text-left">Paid by</th>
              <th className="table-cell text-left">Merchant</th>
              <th className="table-cell text-left">Category</th>
              <th className="table-cell text-right">Total</th>
              <th className="table-cell text-left">Cur</th>
              {profiles.map((p) => (
                <th key={p.id} className="table-cell text-right">
                  {p.display_name}
                </th>
              ))}
              <th className="table-cell text-center">📎</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td className="table-cell" colSpan={6 + profiles.length + 1}>
                  <p className="text-slate-500 text-center py-6">No expenses match these filters.</p>
                </td>
              </tr>
            )}
            {filtered.map((e) => {
              const sp = splitsByExpense.get(e.id) ?? [];
              const cat = e.category_id ? categoriesById.get(e.category_id) : null;
              return (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="table-cell whitespace-nowrap">
                    <Link href={`/expenses/${e.id}`} className="text-brand-dark underline">
                      {formatDate(e.expense_date)}
                    </Link>
                  </td>
                  <td className="table-cell">{profilesById.get(e.paid_by_user_id)?.display_name ?? "—"}</td>
                  <td className="table-cell">{e.merchant}</td>
                  <td className="table-cell">{cat?.name ?? "—"}</td>
                  <td className="table-cell text-right tabular-nums">{formatMoney(Number(e.total_amount), e.currency)}</td>
                  <td className="table-cell">{e.currency}</td>
                  {profiles.map((p) => {
                    const s = sp.find((x) => x.user_id === p.id);
                    return (
                      <td key={p.id} className="table-cell text-right tabular-nums">
                        {s ? formatMoney(Number(s.calculated_amount), e.currency) : "—"}
                      </td>
                    );
                  })}
                  <td className="table-cell text-center">{e.receipt_file_id ? "📎" : ""}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-medium">
              <td className="table-cell" colSpan={4}>
                {filtered.length} expense(s)
              </td>
              <td className="table-cell text-right">{formatMoney(totalAmount)}</td>
              <td className="table-cell" colSpan={1 + profiles.length + 1}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
