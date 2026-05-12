import { getExpenseSplits, getExpenses, getProfiles, getSettlements } from "@/lib/data";
import { computeBalances, settlementSuggestions } from "@/lib/balances";
import { SettlementsClient } from "./SettlementsClient";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function SettlementsPage() {
  const [profiles, expenses, splits, settlements] = await Promise.all([
    getProfiles(),
    getExpenses(),
    getExpenseSplits(),
    getSettlements()
  ]);
  const balances = computeBalances(profiles, expenses, splits, settlements);
  const suggestions = settlementSuggestions(balances);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Settlements" subtitle="Track who owes who and record payments." />
      <SettlementsClient profiles={profiles} settlements={settlements} balances={balances} suggestions={suggestions} />
    </div>
  );
}
