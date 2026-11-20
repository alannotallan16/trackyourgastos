"use client";

import { useMemo, useState } from "react";
import { ChartCard } from "@/components/ui/ChartCard";
import { CategoryPie } from "@/components/DashboardCharts";
import { CHART_COLORS } from "@/lib/chart-colors";
import type { Category, Expense } from "@/lib/types";

type PeriodKey = "this_month" | "last_month" | "last_3_months" | "ytd" | "all_time";

const PERIODS: { key: PeriodKey; label: string; short: string }[] = [
  { key: "this_month", label: "This month", short: "Month" },
  { key: "last_month", label: "Last month", short: "Last mo" },
  { key: "last_3_months", label: "Last 3 months", short: "3 mo" },
  { key: "ytd", label: "Year to date", short: "YTD" },
  { key: "all_time", label: "All time", short: "All" }
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function periodRange(period: PeriodKey): { from: string | null; to: string | null; subtitle: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const last = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  if (period === "this_month") {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0); // last day of this month
    return {
      from: last(start),
      to: last(end),
      subtitle: now.toLocaleString("en-PH", { month: "long", year: "numeric" })
    };
  }
  if (period === "last_month") {
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return {
      from: last(start),
      to: last(end),
      subtitle: start.toLocaleString("en-PH", { month: "long", year: "numeric" })
    };
  }
  if (period === "last_3_months") {
    const start = new Date(y, m - 2, 1);
    const end = new Date(y, m + 1, 0);
    return {
      from: last(start),
      to: last(end),
      subtitle: `${start.toLocaleString("en-PH", { month: "short" })} – ${end.toLocaleString("en-PH", { month: "short", year: "numeric" })}`
    };
  }
  if (period === "ytd") {
    const start = new Date(y, 0, 1);
    const end = new Date(y, m + 1, 0);
    return { from: last(start), to: last(end), subtitle: `Jan – ${now.toLocaleString("en-PH", { month: "short" })} ${y}` };
  }
  // all_time
  return { from: null, to: null, subtitle: "All expenses recorded" };
}

interface Props {
  expenses: Expense[];
  categories: Category[];
}

export function CategoryByPeriodCard({ expenses, categories }: Props) {
  const [period, setPeriod] = useState<PeriodKey>("this_month");

  const { from, to, subtitle } = useMemo(() => periodRange(period), [period]);

  const { catData, catSum } = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of expenses) {
      if (from && e.expense_date < from) continue;
      if (to && e.expense_date > to) continue;
      const cat = categories.find((c) => c.id === e.category_id);
      const name = cat?.name ?? "Other";
      totals.set(name, (totals.get(name) ?? 0) + Number(e.total_amount));
    }
    const data = Array.from(totals.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
    const sum = data.reduce((a, b) => a + b.value, 0);
    return { catData: data, catSum: sum };
  }, [expenses, categories, from, to]);

  return (
    <ChartCard
      title="By category"
      subtitle={subtitle}
      action={
        <select
          aria-label="Period"
          value={period}
          onChange={(e) => setPeriod(e.target.value as PeriodKey)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-brand-navy focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
        >
          {PERIODS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      }
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
        <p className="text-sm text-slate-500 py-8 text-center">No expenses in this period.</p>
      ) : (
        <CategoryPie data={catData} />
      )}
    </ChartCard>
  );
}
