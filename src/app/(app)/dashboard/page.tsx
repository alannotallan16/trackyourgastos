import Link from "next/link";
import { getCategories, getExpenseSplits, getExpenses, getProfiles, getSettlements } from "@/lib/data";
import { computeBalances, settlementSuggestions } from "@/lib/balances";
import { formatMoney, formatDate } from "@/lib/format";
import { CategoryPie, CHART_COLORS, MonthlyTrendChart, PaidByBar } from "@/components/DashboardCharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { Badge, colorForCategory } from "@/components/ui/Badge";
import { ArrowRight, Plus, TrendingUp, Users, Wallet } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

const PERSON_ICON_BG = ["green", "blue", "purple"] as const;

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
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  const trend: { month: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const total = expenses.filter((e) => e.expense_date.startsWith(key)).reduce((a, b) => a + Number(b.total_amount), 0);
    trend.push({ month: d.toLocaleString("en-PH", { month: "short" }), total: Math.round(total * 100) / 100 });
  }

  const catTotals = new Map<string, number>();
  for (const e of monthExpenses) {
    const c = categories.find((c) => c.id === e.category_id);
    const name = c?.name ?? "Other";
    catTotals.set(name, (catTotals.get(name) ?? 0) + Number(e.total_amount));
  }
  const catData = Array.from(catTotals.entries())
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);
  const catSum = catData.reduce((a, b) => a + b.value, 0);

  const paidByData = profiles.map((p) => {
    const b = balances.find((x) => x.user_id === p.id);
    return { name: p.display_name, paid: b ? Math.round(b.paid * 100) / 100 : 0, share: b ? Math.round(b.owed * 100) / 100 : 0 };
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={`${now.toLocaleString("en-PH", { month: "long", year: "numeric" })}`}
        actions={
          <Link href="/expenses/new" className="btn-primary text-sm">
            <Plus className="h-4 w-4" />
            Add expense
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label={`Total expenses (${now.toLocaleString("en-PH", { month: "short" })})`}
          value={formatMoney(monthTotal)}
          hint={`${monthExpenses.length} expense${monthExpenses.length === 1 ? "" : "s"} this month`}
          icon={TrendingUp}
          iconBg="green"
        />
        {profiles.map((p, i) => {
          const b = balances.find((x) => x.user_id === p.id);
          const net = b?.net ?? 0;
          return (
            <StatCard
              key={p.id}
              label={`${p.display_name} net`}
              value={formatMoney(net)}
              hint={`Paid ${formatMoney(b?.paid ?? 0)} · Share ${formatMoney(b?.owed ?? 0)}`}
              tone={net > 0 ? "positive" : net < 0 ? "negative" : "default"}
              icon={i === 0 ? Wallet : Users}
              iconBg={PERSON_ICON_BG[i % PERSON_ICON_BG.length]}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Monthly spending trend" subtitle="Last 6 months">
          <MonthlyTrendChart data={trend} />
        </ChartCard>

        <ChartCard title="Paid vs Share (all time)">
          <PaidByBar data={paidByData} />
        </ChartCard>

        <ChartCard
          title="This month by category"
          legend={
            catData.length === 0 ? null : (
              <ul className="space-y-1.5 text-sm">
                {catData.map((d, i) => (
                  <li key={d.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="truncate text-slate-600">{d.name}</span>
                    </span>
                    <span className="tabular-nums text-xs text-slate-500">
                      {catSum > 0 ? `${Math.round((d.value / catSum) * 100)}%` : "0%"}
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        >
          {catData.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No expenses yet this month.</p>
          ) : (
            <CategoryPie data={catData} />
          )}
        </ChartCard>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-brand-navy">Who owes who</h2>
            <Link href="/settlements" className="text-xs font-medium text-brand-green hover:underline inline-flex items-center gap-1">
              Settle <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {suggestions.length === 0 ? (
            <p className="text-sm text-slate-500">All balances settled.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {suggestions.map((s, i) => (
                <li key={i} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-brand-navy">{profilesById.get(s.from_user_id)?.display_name}</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                    <span className="font-medium text-brand-navy">{profilesById.get(s.to_user_id)?.display_name}</span>
                  </span>
                  <span className="tabular-nums font-semibold text-brand-danger">{formatMoney(s.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-brand-navy">Recent expenses</h2>
          <Link href="/expenses" className="text-xs font-medium text-brand-green hover:underline inline-flex items-center gap-1">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-cell text-left">Date</th>
                <th className="table-cell text-left">Merchant</th>
                <th className="table-cell text-left">Category</th>
                <th className="table-cell text-left">Paid by</th>
                <th className="table-cell text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {expenses.slice(0, 10).map((e) => {
                const cat = e.category_id ? categoriesById.get(e.category_id) : null;
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="table-cell whitespace-nowrap text-slate-600">{formatDate(e.expense_date)}</td>
                    <td className="table-cell">
                      <Link className="text-brand-navy font-medium hover:text-brand-green" href={`/expenses/${e.id}`}>
                        {e.merchant}
                      </Link>
                    </td>
                    <td className="table-cell">
                      {cat ? <Badge color={colorForCategory(cat.name)}>{cat.name}</Badge> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="table-cell text-slate-600">{profilesById.get(e.paid_by_user_id)?.display_name}</td>
                    <td className="table-cell text-right tabular-nums font-medium">{formatMoney(Number(e.total_amount), e.currency)}</td>
                  </tr>
                );
              })}
              {expenses.length === 0 && (
                <tr>
                  <td className="table-cell text-center text-slate-500 py-4" colSpan={5}>
                    No expenses yet. <Link href="/expenses/new" className="text-brand-green underline">Add your first.</Link>
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
