import { getExpenseSplits, getExpenses, getProfiles, getSettlements } from "@/lib/data";
import { computeBalances, settlementSuggestions } from "@/lib/balances";
import { SettlementsClient } from "./SettlementsClient";

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
      <h1 className="text-xl font-semibold">Settlements</h1>
      <SettlementsClient profiles={profiles} settlements={settlements} balances={balances} suggestions={suggestions} />
    </div>
  );
}
