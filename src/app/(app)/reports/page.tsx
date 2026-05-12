import {
  getCategories,
  getExpenseSplits,
  getExpenses,
  getProfiles,
  getSettlementBatchResults,
  getSettlementBatches,
  getSettlementPayments
} from "@/lib/data";
import { computeBalances } from "@/lib/balances";
import { ReportsClient } from "./ReportsClient";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [profiles, expenses, splits, batches, batchResults, payments, categories] = await Promise.all([
    getProfiles(),
    getExpenses(),
    getExpenseSplits(),
    getSettlementBatches(),
    getSettlementBatchResults(),
    getSettlementPayments(),
    getCategories()
  ]);
  const balances = computeBalances(
    profiles,
    expenses,
    splits,
    payments,
    batchResults.map((r) => ({ id: r.id, from_user_id: r.from_user_id, to_user_id: r.to_user_id }))
  );
  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Reports & exports" subtitle="Filter, summarize, and download your data." />
      <ReportsClient
        profiles={profiles}
        expenses={expenses}
        splits={splits}
        batches={batches}
        batchResults={batchResults}
        payments={payments}
        categories={categories}
        balances={balances}
      />
    </div>
  );
}
