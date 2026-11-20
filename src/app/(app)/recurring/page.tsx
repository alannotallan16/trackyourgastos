import { getCategories, getProfiles, getRecurring, getSplitPresets } from "@/lib/data";
import { syncDueRecurring } from "@/lib/recurring-sync";
import { RecurringClient } from "./RecurringClient";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  await syncDueRecurring();
  const [items, profiles, categories, presets] = await Promise.all([
    getRecurring(),
    getProfiles(),
    getCategories(),
    getSplitPresets()
  ]);
  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Recurring expenses" subtitle="Templates auto-generate their expense when the next due date arrives." />
      <RecurringClient items={items} profiles={profiles} categories={categories} presets={presets} />
    </div>
  );
}
