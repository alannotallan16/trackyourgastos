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
import { SettlementsClient } from "./SettlementsClient";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function SettlementsPage() {
  const [profiles, expenses, splits, categories, batches, batchResults, payments] = await Promise.all([
    getProfiles(),
    getExpenses(),
    getExpenseSplits(),
    getCategories(),
    getSettlementBatches(),
    getSettlementBatchResults(),
    getSettlementPayments()
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
      <PageHeader title="Settlements" subtitle="Reconcile a group of expenses with the minimum number of payments." />
      <SettlementsClient
        profiles={profiles}
        expenses={expenses}
        splits={splits}
        categories={categories}
        batches={batches}
        batchResults={batchResults}
        balances={balances}
      />
    </div>
  );
}
