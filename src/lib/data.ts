import { createClient } from "@/lib/supabase/server";
import type {
  Category,
  Expense,
  ExpenseSplit,
  MerchantRule,
  Profile,
  RecurringExpense,
  Settlement,
  SettlementItem,
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

export async function getSettlements(): Promise<Settlement[]> {
  const supabase = createClient();
  const { data } = await supabase.from("settlements").select("*").order("created_at", { ascending: false });
  return (data as Settlement[]) ?? [];
}

export async function getSettlementItems(): Promise<SettlementItem[]> {
  const supabase = createClient();
  const { data } = await supabase.from("settlement_items").select("*");
  return (data as SettlementItem[]) ?? [];
}

export async function getSettlementPayments(): Promise<SettlementPayment[]> {
  const supabase = createClient();
  const { data } = await supabase.from("settlement_payments").select("*").order("payment_date", { ascending: false });
  return (data as SettlementPayment[]) ?? [];
}

export async function getSettlementDetail(id: string): Promise<{
  settlement: Settlement | null;
  items: SettlementItem[];
  payments: SettlementPayment[];
}> {
  const supabase = createClient();
  const [s, i, p] = await Promise.all([
    supabase.from("settlements").select("*").eq("id", id).maybeSingle(),
    supabase.from("settlement_items").select("*").eq("settlement_id", id),
    supabase
      .from("settlement_payments")
      .select("*")
      .eq("settlement_id", id)
      .order("payment_date", { ascending: false })
  ]);
  return {
    settlement: (s.data as Settlement) ?? null,
    items: (i.data as SettlementItem[]) ?? [],
    payments: (p.data as SettlementPayment[]) ?? []
  };
}

export async function getRecurring(): Promise<RecurringExpense[]> {
  const supabase = createClient();
  const { data } = await supabase.from("recurring_expenses").select("*").order("next_due_date");
  return (data as RecurringExpense[]) ?? [];
}
