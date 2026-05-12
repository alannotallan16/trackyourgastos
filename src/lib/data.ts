import { createClient } from "@/lib/supabase/server";
import type {
  Category,
  Expense,
  ExpenseSplit,
  MerchantRule,
  Profile,
  RecurringExpense,
  Settlement,
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
  const { data } = await supabase.from("settlements").select("*").order("settled_on", { ascending: false });
  return (data as Settlement[]) ?? [];
}

export async function getRecurring(): Promise<RecurringExpense[]> {
  const supabase = createClient();
  const { data } = await supabase.from("recurring_expenses").select("*").order("next_due_date");
  return (data as RecurringExpense[]) ?? [];
}
