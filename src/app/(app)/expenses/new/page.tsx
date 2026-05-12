import Link from "next/link";
import { ExpenseForm } from "@/components/ExpenseForm";
import { getCategories, getMerchantRules, getProfiles, getSplitPresets } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const [profiles, categories, presets, rules] = await Promise.all([
    getProfiles(),
    getCategories(),
    getSplitPresets(),
    getMerchantRules()
  ]);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Add expense</h1>
        <Link href="/expenses/scan" className="btn-secondary text-sm">
          📷 Scan receipt
        </Link>
      </div>
      <ExpenseForm profiles={profiles} categories={categories} presets={presets} merchantRules={rules} />
    </div>
  );
}
