import { notFound } from "next/navigation";
import Link from "next/link";
import { ExpenseForm } from "@/components/ExpenseForm";
import { DeleteExpenseButton } from "@/components/DeleteExpenseButton";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getMerchantRules, getProfiles, getSplitPresets } from "@/lib/data";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChevronLeft } from "@/components/ui/icons";

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
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <PageHeader
        title="Edit expense"
        actions={
          <>
            <Link href="/expenses" className="btn-ghost text-sm">
              <ChevronLeft className="h-4 w-4" />
              All expenses
            </Link>
            <DeleteExpenseButton id={expense.id} />
          </>
        }
      />
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
