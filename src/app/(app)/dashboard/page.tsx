import Link from "next/link";
import { getCategories, getExpenseSplits, getExpenses, getProfiles, getSettlements } from "@/lib/data";
import { computeBalances, settlementSuggestions } from "@/lib/balances";
import { formatMoney } from "@/lib/format";
import { CategoryPie, MonthlyTrendChart, PaidByBar } from "@/components/DashboardCharts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [profiles, expenses, splits, settlements, categories] = await Promise.all([
    getProfiles(),
    getExpenses(),
    getExpenseSplits(),
    getSettlements(),
    getCategories()
  ]);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthExpenses = expenses.filter((e) => e.expense_date.startsWith(thisMonth));
  const monthTotal = monthExpenses.reduce((a, b) => a + Number(b.total_amount), 0);

  const balances = computeBalances(profiles, expenses, splits, settlements);
  const suggestions = settlementSuggestions(balances);
  const profilesById = new Map(profiles.map((p) => [p.id, p]));

  // Monthly trend (last 6 months)
  const trend: { month: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const total = expenses.filter((e) => e.expense_date.startsWith(key)).reduce((a, b) => a + Number(b.total_amount), 0);
    trend.push({ month: d.toLocaleString("en-PH", { month: "short" }), total: Math.round(total * 100) / 100 });
  }

  // Category breakdown (this month)
  const catTotals = new Map<string, number>();
  for (const e of monthExpenses) {
    const c = categories.find((c) => c.id === e.category_id);
    const name = c?.name ?? "Other";
    catTotals.set(name, (catTotals.get(name) ?? 0) + Number(e.total_amount));
  }
  const catData = Array.from(catTotals.entries()).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));

  // Paid-by bar
  const paidByData = profiles.map((p) => {
    const b = balances.find((x) => x.user_id === p.id);
    return { name: p.display_name, paid: b ? Math.round(b.paid * 100) / 100 : 0, share: b ? Math.round(b.owed * 100) / 100 : 0 };
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Link href="/expenses/new" className="btn-primary text-sm">
          ➕ Add expense
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <SummaryCard label={`${now.toLocaleString("en-PH", { month: "long" })} total`} value={formatMoney(monthTotal)} />
        {profiles.map((p) => {
          const b = balances.find((x) => x.user_id === p.id);
          return (
            <SummaryCard
              key={p.id}
              label={`${p.display_name} net`}
              value={formatMoney(b?.net ?? 0)}
              hint={`Paid ${formatMoney(b?.paid ?? 0)} · Share ${formatMoney(b?.owed ?? 0)}`}
              positive={b ? b.net > 0 : false}
              negative={b ? b.net < 0 : false}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-medium mb-2">Monthly spending trend</h2>
          <MonthlyTrendChart data={trend} />
        </div>
        <div className="card">
          <h2 className="font-medium mb-2">Paid vs Share (all time)</h2>
          <PaidByBar data={paidByData} />
        </div>
        <div className="card">
          <h2 className="font-medium mb-2">This month by category</h2>
          {catData.length === 0 ? <p className="text-sm text-slate-500">No expenses yet this month.</p> : <CategoryPie data={catData} />}
        </div>
        <div className="card">
          <h2 className="font-medium mb-2">Who owes who</h2>
          {suggestions.length === 0 ? (
            <p className="text-sm text-slate-500">All balances settled. 🎉</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {suggestions.map((s, i) => (
                <li key={i} className="flex items-center justify-between border-b border-slate-100 pb-1">
                  <span>
                    <strong>{profilesById.get(s.from_user_id)?.display_name}</strong> → {profilesById.get(s.to_user_id)?.display_name}
                  </span>
                  <span className="tabular-nums font-medium">{formatMoney(s.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/settlements" className="mt-3 inline-block text-sm text-brand underline">
            Record a settlement →
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">Recent expenses</h2>
          <Link href="/expenses" className="text-sm text-brand underline">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-cell text-left">Date</th>
                <th className="table-cell text-left">Merchant</th>
                <th className="table-cell text-left">Paid by</th>
                <th className="table-cell text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {expenses.slice(0, 10).map((e) => (
                <tr key={e.id}>
                  <td className="table-cell whitespace-nowrap">{e.expense_date}</td>
                  <td className="table-cell">
                    <Link className="text-brand-dark underline" href={`/expenses/${e.id}`}>
                      {e.merchant}
                    </Link>
                  </td>
                  <td className="table-cell">{profilesById.get(e.paid_by_user_id)?.display_name}</td>
                  <td className="table-cell text-right tabular-nums">{formatMoney(Number(e.total_amount), e.currency)}</td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td className="table-cell text-center text-slate-500 py-4" colSpan={4}>
                    No expenses yet. <Link href="/expenses/new" className="text-brand underline">Add your first.</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, hint, positive, negative }: { label: string; value: string; hint?: string; positive?: boolean; negative?: boolean }) {
  return (
    <div className="card">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${positive ? "text-emerald-600" : negative ? "text-red-600" : ""}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
