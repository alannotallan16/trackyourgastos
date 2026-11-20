import {
  getCategories,
  getExpenseSplits,
  getExpenses,
  getProfiles,
  getSettlementBatchItems,
  getSettlementBatchResults,
  getSettlementBatches,
  getSettlementPayments
} from "@/lib/data";
import { computeBalances } from "@/lib/balances";
import { auditBalanceIntegrity } from "@/lib/balance-integrity";
import { auditBalanceMath } from "@/lib/balance-math";
import { ReportsClient } from "./ReportsClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { IntegritySection } from "./IntegritySection";
import { BalanceMathSection } from "./BalanceMathSection";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [profiles, expenses, splits, batches, batchResults, batchItems, payments, categories] =
    await Promise.all([
      getProfiles(),
      getExpenses(),
      getExpenseSplits(),
      getSettlementBatches(),
      getSettlementBatchResults(),
      getSettlementBatchItems(),
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
  const integrity = auditBalanceIntegrity(expenses, splits);
  const math = auditBalanceMath(
    profiles,
    expenses,
    splits,
    batches,
    batchResults,
    payments,
    batchItems
  );
  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Reports & exports" subtitle="Filter, summarize, and download your data." />
      <IntegritySection report={integrity} />
      <BalanceMathSection report={math} />
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
