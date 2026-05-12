import { getCategories, getExpenseSplits, getExpenses, getProfiles, getSettlements } from "@/lib/data";
import { computeBalances } from "@/lib/balances";
import { ReportsClient } from "./ReportsClient";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [profiles, expenses, splits, settlements, categories] = await Promise.all([
    getProfiles(),
    getExpenses(),
    getExpenseSplits(),
    getSettlements(),
    getCategories()
  ]);
  const balances = computeBalances(profiles, expenses, splits, settlements);
  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Reports & exports" subtitle="Filter, summarize, and download your data." />
      <ReportsClient
        profiles={profiles}
        expenses={expenses}
        splits={splits}
        settlements={settlements}
        categories={categories}
        balances={balances}
      />
    </div>
  );
}
