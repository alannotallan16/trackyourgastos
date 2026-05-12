import { redirect } from "next/navigation";
import { ExpenseForm } from "@/components/ExpenseForm";
import { createClient } from "@/lib/supabase/server";
import { parseReceiptText } from "@/lib/ocr";
import { suggestFromMerchant } from "@/lib/categorize";
import { getCategories, getMerchantRules, getProfiles, getSplitPresets } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: { searchParams: { receipt?: string } }) {
  const receiptId = searchParams.receipt;
  if (!receiptId) redirect("/expenses/scan");

  const supabase = createClient();
  const { data: receipt } = await supabase.from("receipt_files").select("*").eq("id", receiptId).maybeSingle();
  if (!receipt) redirect("/expenses/scan");

  const [profiles, categories, presets, rules] = await Promise.all([
    getProfiles(),
    getCategories(),
    getSplitPresets(),
    getMerchantRules()
  ]);

  const extracted = parseReceiptText(receipt.ocr_text ?? "");
  const sug = extracted.merchant ? suggestFromMerchant(extracted.merchant, rules) : { category_id: null, split_preset_id: null };

  // Duplicate check
  let duplicates: { id: string; merchant: string; expense_date: string; total_amount: number }[] = [];
  if (extracted.merchant && extracted.date && extracted.total) {
    const d = new Date(extracted.date);
    const start = new Date(d); start.setDate(start.getDate() - 1);
    const end = new Date(d); end.setDate(end.getDate() + 1);
    const { data } = await supabase
      .from("expenses")
      .select("id, merchant, expense_date, total_amount")
      .gte("expense_date", start.toISOString().slice(0, 10))
      .lte("expense_date", end.toISOString().slice(0, 10))
      .ilike("merchant", `%${extracted.merchant}%`);
    duplicates = (data ?? []).filter((e: any) => Math.abs(Number(e.total_amount) - extracted.total!) < 0.5);
  }

  const { data: signed } = await supabase.storage.from("receipts").createSignedUrl(receipt.storage_path, 60 * 30);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Review receipt</h1>
      <p className="text-sm text-slate-600 mb-4">
        {extracted.date || extracted.merchant || extracted.total
          ? "We extracted what we could — please verify."
          : "Couldn't auto-detect anything. Fill in the fields manually."}
      </p>
      <ExpenseForm
        profiles={profiles}
        categories={categories}
        presets={presets}
        merchantRules={rules}
        duplicates={duplicates}
        initial={{
          expense_date: extracted.date ?? new Date().toISOString().slice(0, 10),
          merchant: extracted.merchant ?? "",
          total_amount: extracted.total ?? 0,
          category_id: sug.category_id,
          split_preset_id: sug.split_preset_id,
          receipt_file_id: receipt.id
        } as any}
        receiptFileId={receipt.id}
        receiptPreviewUrl={signed?.signedUrl ?? null}
      />
    </div>
  );
}
