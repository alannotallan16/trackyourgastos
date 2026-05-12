import { getCategories, getMerchantRules } from "@/lib/data";
import { CategoriesClient } from "./CategoriesClient";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const [categories, rules] = await Promise.all([getCategories(), getMerchantRules()]);
  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-semibold">Categories &amp; merchant rules</h1>
      <CategoriesClient categories={categories} rules={rules} />
    </div>
  );
}
