"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { calculateSplits } from "@/lib/splits";
import type { SplitInput, SplitType } from "@/lib/types";

const SplitSchema = z.object({
  user_id: z.string().uuid(),
  split_type: z.enum(["equal", "percentage", "fixed"]),
  percentage: z.coerce.number().nullable().optional(),
  fixed_amount: z.coerce.number().nullable().optional()
});

const ExpenseSchema = z.object({
  id: z.string().uuid().optional(),
  expense_date: z.string().min(1),
  merchant: z.string().min(1).max(200),
  total_amount: z.coerce.number().nonnegative(),
  currency: z.string().min(1).max(8),
  exchange_rate: z.coerce.number().positive().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  paid_by_user_id: z.string().uuid(),
  split_preset_id: z.string().uuid().nullable().optional(),
  receipt_file_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  splits: z.array(SplitSchema).min(1)
});

export type ExpensePayload = z.infer<typeof ExpenseSchema>;

export async function saveExpense(payload: ExpensePayload) {
  const parsed = ExpenseSchema.parse(payload);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const splitInputs: SplitInput[] = parsed.splits.map((s) => ({
    user_id: s.user_id,
    split_type: s.split_type as SplitType,
    percentage: s.percentage ?? null,
    fixed_amount: s.fixed_amount ?? null
  }));
  const calculated = calculateSplits(parsed.total_amount, splitInputs);

  let expenseId = parsed.id;
  if (expenseId) {
    const { error } = await supabase
      .from("expenses")
      .update({
        expense_date: parsed.expense_date,
        merchant: parsed.merchant,
        total_amount: parsed.total_amount,
        currency: parsed.currency,
        exchange_rate: parsed.exchange_rate ?? null,
        category_id: parsed.category_id ?? null,
        paid_by_user_id: parsed.paid_by_user_id,
        split_preset_id: parsed.split_preset_id ?? null,
        receipt_file_id: parsed.receipt_file_id ?? null,
        notes: parsed.notes ?? null
      })
      .eq("id", expenseId);
    if (error) throw error;
    await supabase.from("expense_splits").delete().eq("expense_id", expenseId);
  } else {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        expense_date: parsed.expense_date,
        merchant: parsed.merchant,
        total_amount: parsed.total_amount,
        currency: parsed.currency,
        exchange_rate: parsed.exchange_rate ?? null,
        category_id: parsed.category_id ?? null,
        paid_by_user_id: parsed.paid_by_user_id,
        split_preset_id: parsed.split_preset_id ?? null,
        receipt_file_id: parsed.receipt_file_id ?? null,
        notes: parsed.notes ?? null,
        created_by: user.id
      })
      .select("id")
      .single();
    if (error) throw error;
    expenseId = data!.id;
  }

  const { error: splitErr } = await supabase.from("expense_splits").insert(
    calculated.map((c) => ({
      expense_id: expenseId,
      user_id: c.user_id,
      split_type: c.split_type,
      percentage: c.percentage,
      fixed_amount: c.fixed_amount,
      calculated_amount: c.calculated_amount
    }))
  );
  if (splitErr) throw splitErr;

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { id: expenseId };
}

export async function deleteExpense(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  redirect("/expenses");
}

export async function deleteReceiptFile(receiptId: string) {
  const supabase = createClient();
  const { data: file } = await supabase.from("receipt_files").select("*").eq("id", receiptId).maybeSingle();
  if (file?.storage_path) {
    await supabase.storage.from("receipts").remove([file.storage_path]);
  }
  // Detach from any expenses, then delete row.
  await supabase.from("expenses").update({ receipt_file_id: null }).eq("receipt_file_id", receiptId);
  await supabase.from("receipt_files").delete().eq("id", receiptId);
  revalidatePath("/expenses");
}
