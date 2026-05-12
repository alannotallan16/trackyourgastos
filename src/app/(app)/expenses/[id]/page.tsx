import { notFound } from "next/navigation";
import Link from "next/link";
import { ExpenseForm } from "@/components/ExpenseForm";
import { DeleteExpenseButton } from "@/components/DeleteExpenseButton";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getMerchantRules, getProfiles, getSplitPresets } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ExpenseDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: expense }, { data: splits }, profiles, categories, presets, rules] = await Promise.all([
    supabase.from("expenses").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("expense_splits").select("*").eq("expense_id", params.id),
    getProfiles(),
    getCategories(),
    getSplitPresets(),
    getMerchantRules()
  ]);

  if (!expense) notFound();

  let receiptUrl: string | null = null;
  if (expense.receipt_file_id) {
    const { data: rf } = await supabase.from("receipt_files").select("storage_path").eq("id", expense.receipt_file_id).maybeSingle();
    if (rf?.storage_path) {
      const { data: signed } = await supabase.storage.from("receipts").createSignedUrl(rf.storage_path, 60 * 30);
      receiptUrl = signed?.signedUrl ?? null;
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Edit expense</h1>
        <div className="flex items-center gap-2">
          <Link href="/expenses" className="text-sm text-brand underline">
            ← All
          </Link>
          <DeleteExpenseButton id={expense.id} />
        </div>
      </div>
      <ExpenseForm
        profiles={profiles}
        categories={categories}
        presets={presets}
        merchantRules={rules}
        initial={{ ...(expense as any), splits: (splits as any) ?? [] }}
        receiptFileId={expense.receipt_file_id}
        receiptPreviewUrl={receiptUrl}
      />
    </div>
  );
}
