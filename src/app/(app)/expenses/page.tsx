import Link from "next/link";
import { ExpenseTable } from "@/components/ExpenseTable";
import { getCategories, getExpenseSplits, getExpenses, getProfiles } from "@/lib/data";
import { PageHeader } from "@/components/ui/PageHeader";
import { Camera, Plus } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const [expenses, splits, profiles, categories] = await Promise.all([
    getExpenses(),
    getExpenseSplits(),
    getProfiles(),
    getCategories()
  ]);
  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Expenses"
        actions={
          <>
            <Link href="/expenses/scan" className="btn-secondary text-sm">
              <Camera className="h-4 w-4" />
              Scan
            </Link>
            <Link href="/expenses/new" className="btn-primary text-sm">
              <Plus className="h-4 w-4" />
              Add expense
            </Link>
          </>
        }
      />
      <ExpenseTable expenses={expenses} splits={splits} profiles={profiles} categories={categories} />
    </div>
  );
}
