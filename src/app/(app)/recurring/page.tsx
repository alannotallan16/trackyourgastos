import { getCategories, getProfiles, getRecurring, getSplitPresets } from "@/lib/data";
import { RecurringClient } from "./RecurringClient";
import { PageHeader } from "@/components/ui/PageHeader";

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
      <PageHeader title="Recurring expenses" subtitle="Templates that auto-suggest the next due date." />
      <RecurringClient items={items} profiles={profiles} categories={categories} presets={presets} />
    </div>
  );
}
