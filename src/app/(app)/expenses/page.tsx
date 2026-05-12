import Link from "next/link";
import { ExpenseTable } from "@/components/ExpenseTable";
import { getCategories, getExpenseSplits, getExpenses, getProfiles } from "@/lib/data";

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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Expenses</h1>
        <div className="flex gap-2">
          <Link href="/expenses/scan" className="btn-secondary text-sm">
            📷 Scan
          </Link>
          <Link href="/expenses/new" className="btn-primary text-sm">
            ➕ Add expense
          </Link>
        </div>
      </div>
      <ExpenseTable expenses={expenses} splits={splits} profiles={profiles} categories={categories} />
    </div>
  );
}
