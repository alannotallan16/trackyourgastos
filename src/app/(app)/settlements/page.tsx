import {
  getCategories,
  getExpenseSplits,
  getExpenses,
  getProfiles,
  getSettlementPayments,
  getSettlements
} from "@/lib/data";
import { computeBalances, settlementSuggestions } from "@/lib/balances";
import { SettlementsClient } from "./SettlementsClient";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function SettlementsPage() {
  const [profiles, expenses, splits, settlements, payments, categories] = await Promise.all([
    getProfiles(),
    getExpenses(),
    getExpenseSplits(),
    getSettlements(),
    getSettlementPayments(),
    getCategories()
  ]);

  const balances = computeBalances(
    profiles,
    expenses,
    splits,
    payments,
    settlements.map((s) => ({ id: s.id, from_user_id: s.from_user_id, to_user_id: s.to_user_id }))
  );
  const suggestions = settlementSuggestions(balances);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Settlements" subtitle="Reconcile who owes who, expense by expense." />
      <SettlementsClient
        profiles={profiles}
        expenses={expenses}
        splits={splits}
        categories={categories}
        settlements={settlements}
        balances={balances}
        suggestions={suggestions}
      />
    </div>
  );
}
