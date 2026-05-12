import { getCategories, getProfiles, getRecurring, getSplitPresets } from "@/lib/data";
import { RecurringClient } from "./RecurringClient";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const [items, profiles, categories, presets] = await Promise.all([
    getRecurring(),
    getProfiles(),
    getCategories(),
    getSplitPresets()
  ]);
  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-semibold">Recurring expenses</h1>
      <RecurringClient items={items} profiles={profiles} categories={categories} presets={presets} />
    </div>
  );
}
