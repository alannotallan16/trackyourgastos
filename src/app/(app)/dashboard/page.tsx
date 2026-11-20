import Link from "next/link";
import {
  getCategories,
  getExpenseSplits,
  getExpenses,
  getProfiles,
  getSettlementBatchResults,
  getSettlementBatches,
  getSettlementPayments
} from "@/lib/data";
import { computeBalances, settlementSuggestions } from "@/lib/balances";
import { auditBalanceIntegrity } from "@/lib/balance-integrity";
import { formatMoney, formatDate } from "@/lib/format";
import { syncDueRecurring } from "@/lib/recurring-sync";
import { createClient } from "@/lib/supabase/server";
import { MonthlyTrendChart, PaidByBar } from "@/components/DashboardCharts";
import { CategoryByPeriodCard } from "@/components/CategoryByPeriodCard";
import { BalanceIntegrityBanner } from "@/components/BalanceIntegrityBanner";
import { YourBalanceHero } from "@/components/YourBalanceHero";
import { SettleUpCard } from "@/components/SettleUpCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { NavButton } from "@/components/ui/NavButton";
import { Badge, colorForCategory } from "@/components/ui/Badge";
import { ArrowRight, Plus, TrendingUp, Users, Wallet } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

const PERSON_ICON_BG = ["green", "blue", "purple"] as const;

export default async function DashboardPage() {
  // Catch up any recurring templates whose next_due_date is past before we
  // read expenses, so newly-generated rows show up in the dashboard totals.
  await syncDueRecurring();

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const [profiles, expenses, splits, batches, batchResults, payments, categories] = await Promise.all([
    getProfiles(),
    getExpenses(),
    getExpenseSplits(),
    getSettlementBatches(),
    getSettlementBatchResults(),
    getSettlementPayments(),
    getCategories()
  ]);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthExpenses = expenses.filter((e) => e.expense_date.startsWith(thisMonth));
  const monthTotal = monthExpenses.reduce((a, b) => a + Number(b.total_amount), 0);

  const balances = computeBalances(
    profiles,
    expenses,
    splits,
    payments,
    batchResults.map((r) => ({ id: r.id, from_user_id: r.from_user_id, to_user_id: r.to_user_id }))
  );
  const suggestions = settlementSuggestions(balances);
  const integrity = auditBalanceIntegrity(expenses, splits);
  const profilesById = new Map(profiles.map((p) => [p.id, p]));
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  // ---------------------------------------------------------------------------
  // Signed-in user → profile (for the hero).
  // ---------------------------------------------------------------------------
  const me = user ? profiles.find((p) => p.id === user.id) ?? null : null;
  const others = me ? profiles.filter((p) => p.id !== me.id) : [];

  // Household-level unsettled snapshot for the Settle Up card's nudge.
  const splitsByExpense = new Map<string, typeof splits>();
  for (const s of splits) {
    if (!splitsByExpense.has(s.expense_id)) splitsByExpense.set(s.expense_id, []);
    splitsByExpense.get(s.expense_id)!.push(s);
  }
  let unsettledCount = 0;
  let unsettledTotal = 0;
  let unsettledSince: string | null = null;
  for (const e of expenses) {
    const sp = splitsByExpense.get(e.id) ?? [];
    if (sp.length === 0) continue;
    if (!sp.every((s) => s.settlement_status === "unpaid")) continue;
    unsettledCount++;
    unsettledTotal += Number(e.total_amount);
    if (!unsettledSince || e.expense_date < unsettledSince) unsettledSince = e.expense_date;
  }

  // ---------------------------------------------------------------------------
  // Charts — unchanged logic.
  // ---------------------------------------------------------------------------
  const trend: { month: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const total = expenses
      .filter((e) => e.expense_date.startsWith(key))
      .reduce((a, b) => a + Number(b.total_amount), 0);
    trend.push({ month: d.toLocaleString("en-PH", { month: "short" }), total: Math.round(total * 100) / 100 });
  }

  const paidByData = profiles.map((p) => {
    const b = balances.find((x) => x.user_id === p.id);
    return {
      name: p.display_name,
      paid: b ? Math.round(b.paid * 100) / 100 : 0,
      share: b ? Math.round(b.owed * 100) / 100 : 0
    };
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={`${now.toLocaleString("en-PH", { month: "long", year: "numeric" })}`}
        actions={
          <NavButton href="/expenses/new" loadingLabel="Opening…">
            <Plus className="h-4 w-4" />
            Add expense
          </NavButton>
        }
      />

      <BalanceIntegrityBanner report={integrity} />

      {me ? (
        <YourBalanceHero me={me} others={others} balances={balances} />
      ) : (
        // Fallback when the signed-in auth user isn't linked to a profile yet.
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
      )}

      <SettleUpCard
        suggestions={suggestions}
        batches={batches}
        batchResults={batchResults}
        profiles={profiles}
        householdBalances={balances}
        unsettledCount={unsettledCount}
        unsettledTotal={Math.round(unsettledTotal * 100) / 100}
        unsettledSince={unsettledSince}
        meId={me?.id}
      />

      {/* Month total + charts */}
      {me && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label={`Total this month`}
            value={formatMoney(monthTotal)}
            hint={`${monthExpenses.length} expense${monthExpenses.length === 1 ? "" : "s"} · ${now.toLocaleString("en-PH", { month: "long" })}`}
            icon={TrendingUp}
            iconBg="green"
          />
          {others.map((p, i) => {
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
                iconBg={PERSON_ICON_BG[(i + 1) % PERSON_ICON_BG.length]}
              />
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Monthly spending trend" subtitle="Last 6 months">
          <MonthlyTrendChart data={trend} />
        </ChartCard>

        <ChartCard title="Paid vs Share (all time)">
          <PaidByBar data={paidByData} />
        </ChartCard>

        <div className="lg:col-span-2">
          <CategoryByPeriodCard expenses={expenses} categories={categories} />
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-brand-navy">Recent expenses</h2>
          <Link href="/expenses" className="text-xs font-medium text-brand-green hover:underline inline-flex items-center gap-1">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="hidden md:block overflow-x-auto">
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

        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-slate-100 -mx-5 -mb-5">
          {expenses.length === 0 && (
            <p className="px-5 py-6 text-center text-sm text-slate-500">
              No expenses yet.{" "}
              <Link href="/expenses/new" className="text-brand-green underline">
                Add your first.
              </Link>
            </p>
          )}
          {expenses.slice(0, 10).map((e) => {
            const cat = e.category_id ? categoriesById.get(e.category_id) : null;
            return (
              <Link
                key={e.id}
                href={`/expenses/${e.id}`}
                className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-slate-50 active:bg-slate-100"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-brand-navy truncate">{e.merchant}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span>{formatDate(e.expense_date)}</span>
                    <span>·</span>
                    <span>Paid by {profilesById.get(e.paid_by_user_id)?.display_name ?? "—"}</span>
                    {cat && <Badge color={colorForCategory(cat.name)}>{cat.name}</Badge>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums text-brand-navy">
                    {formatMoney(Number(e.total_amount), e.currency)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">{e.currency}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
