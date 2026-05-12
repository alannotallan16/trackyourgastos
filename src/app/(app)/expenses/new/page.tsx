import Link from "next/link";
import { ExpenseForm } from "@/components/ExpenseForm";
import { getCategories, getMerchantRules, getProfiles, getSplitPresets } from "@/lib/data";
import { PageHeader } from "@/components/ui/PageHeader";
import { Camera } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const [profiles, categories, presets, rules] = await Promise.all([
    getProfiles(),
    getCategories(),
    getSplitPresets(),
    getMerchantRules()
  ]);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <PageHeader
        title="Add expense"
        actions={
          <Link href="/expenses/scan" className="btn-secondary text-sm">
            <Camera className="h-4 w-4" />
            Scan receipt
          </Link>
        }
      />
      <ExpenseForm profiles={profiles} categories={categories} presets={presets} merchantRules={rules} />
    </div>
  );
}
