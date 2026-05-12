import { createClient } from "@/lib/supabase/server";
import type {
  Category,
  Expense,
  ExpenseSplit,
  MerchantRule,
  Profile,
  RecurringExpense,
  SettlementBatch,
  SettlementBatchItem,
  SettlementBatchResult,
  SettlementPayment,
  SplitPreset
} from "./types";

export async function getProfiles(): Promise<Profile[]> {
  const supabase = createClient();
  const { data } = await supabase.from("profiles").select("*").order("display_name");
  return (data as Profile[]) ?? [];
}

export async function getCategories(): Promise<Category[]> {
  const supabase = createClient();
  const { data } = await supabase.from("categories").select("*").order("name");
  return (data as Category[]) ?? [];
}

export async function getSplitPresets(): Promise<SplitPreset[]> {
  const supabase = createClient();
  const { data: presets } = await supabase.from("split_presets").select("*").order("name");
  const { data: members } = await supabase.from("split_preset_members").select("*");
  return (presets ?? []).map((p: any) => ({
    ...p,
    members: (members ?? []).filter((m: any) => m.preset_id === p.id)
  }));
}

export async function getMerchantRules(): Promise<MerchantRule[]> {
  const supabase = createClient();
  const { data } = await supabase.from("merchant_rules").select("*");
  return (data as MerchantRule[]) ?? [];
}

export async function getExpenses(): Promise<Expense[]> {
  const supabase = createClient();
  const { data } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
  return (data as Expense[]) ?? [];
}

export async function getExpenseSplits(): Promise<ExpenseSplit[]> {
  const supabase = createClient();
  const { data } = await supabase.from("expense_splits").select("*");
  return (data as ExpenseSplit[]) ?? [];
}

export async function getSettlementBatches(): Promise<SettlementBatch[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("settlement_batches")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as SettlementBatch[]) ?? [];
}

export async function getSettlementBatchResults(): Promise<SettlementBatchResult[]> {
  const supabase = createClient();
  const { data } = await supabase.from("settlement_batch_results").select("*");
  return (data as SettlementBatchResult[]) ?? [];
}

export async function getSettlementPayments(): Promise<SettlementPayment[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("settlement_payments")
    .select("*")
    .order("payment_date", { ascending: false });
  return (data as SettlementPayment[]) ?? [];
}

export async function getBatchDetail(id: string): Promise<{
  batch: SettlementBatch | null;
  items: SettlementBatchItem[];
  results: SettlementBatchResult[];
  payments: SettlementPayment[];
}> {
  const supabase = createClient();
  const [b, i, r] = await Promise.all([
    supabase.from("settlement_batches").select("*").eq("id", id).maybeSingle(),
    supabase.from("settlement_batch_items").select("*").eq("settlement_batch_id", id),
    supabase
      .from("settlement_batch_results")
      .select("*")
      .eq("settlement_batch_id", id)
      .order("amount", { ascending: false })
  ]);
  const resultIds = (r.data ?? []).map((x: any) => x.id);
  let payments: SettlementPayment[] = [];
  if (resultIds.length > 0) {
    const { data: p } = await supabase
      .from("settlement_payments")
      .select("*")
      .in("settlement_batch_result_id", resultIds)
      .order("payment_date", { ascending: false });
    payments = (p as SettlementPayment[]) ?? [];
  }
  return {
    batch: (b.data as SettlementBatch) ?? null,
    items: (i.data as SettlementBatchItem[]) ?? [],
    results: (r.data as SettlementBatchResult[]) ?? [],
    payments
  };
}

export async function getRecurring(): Promise<RecurringExpense[]> {
  const supabase = createClient();
  const { data } = await supabase.from("recurring_expenses").select("*").order("next_due_date");
  return (data as RecurringExpense[]) ?? [];
}
