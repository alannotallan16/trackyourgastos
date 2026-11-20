import { ExpenseTable } from "@/components/ExpenseTable";
import {
  getCategories,
  getExpenseSplits,
  getExpenses,
  getProfiles,
  getSettlementBatches
} from "@/lib/data";
import { PageHeader } from "@/components/ui/PageHeader";
import { NavButton } from "@/components/ui/NavButton";
import { Camera, Plus } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const [expenses, splits, profiles, categories, batches] = await Promise.all([
    getExpenses(),
    getExpenseSplits(),
    getProfiles(),
    getCategories(),
    getSettlementBatches()
  ]);
  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Expenses"
        actions={
          <>
            <NavButton href="/expenses/scan" className="btn-secondary text-sm" loadingLabel="Opening…">
              <Camera className="h-4 w-4" />
              Scan
            </NavButton>
            <NavButton href="/expenses/new" loadingLabel="Opening…">
              <Plus className="h-4 w-4" />
              Add expense
            </NavButton>
          </>
        }
      />
      <ExpenseTable
        expenses={expenses}
        splits={splits}
        profiles={profiles}
        categories={categories}
        batches={batches}
      />
    </div>
  );
}
