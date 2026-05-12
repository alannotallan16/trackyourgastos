import { getCategories, getMerchantRules } from "@/lib/data";
import { CategoriesClient } from "./CategoriesClient";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const [categories, rules] = await Promise.all([getCategories(), getMerchantRules()]);
  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Categories & merchant rules" />
      <CategoriesClient categories={categories} rules={rules} />
    </div>
  );
}
