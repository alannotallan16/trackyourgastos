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

// -----------------------------------------------------------------------------
// Pagination helper
//
// Supabase projects set a `maxRows` cap (1000 by default) on any single
// select() call. Any `.from("…").select("*")` that could return more rows than
// that silently truncates — and when expense_splits truncates, computeBalances
// miscounts `owed` and the dashboard's Σ(nets) stops summing to zero. Every
// fetch below that can grow large goes through fetchAll() so we page through
// the whole table.
// -----------------------------------------------------------------------------
type QueryBuilder<T> = {
  range: (from: number, to: number) => QueryBuilder<T>;
  then: (cb: (r: { data: T[] | null; error: unknown }) => unknown) => Promise<void>;
};

async function fetchAll<T>(
  build: () => QueryBuilder<T>,
  pageSize = 1000
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  // Safety: cap total pages so a runaway loop can't exhaust memory.
  for (let page = 0; page < 200; page++) {
    const { data, error } = (await build().range(from, from + pageSize - 1)) as unknown as {
      data: T[] | null;
      error: unknown;
    };
    if (error || !data) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

// -----------------------------------------------------------------------------

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
  return fetchAll<Expense>(() =>
    supabase.from("expenses").select("*").order("expense_date", { ascending: false }) as unknown as QueryBuilder<Expense>
  );
}

export async function getExpenseSplits(): Promise<ExpenseSplit[]> {
  const supabase = createClient();
  return fetchAll<ExpenseSplit>(() =>
    supabase.from("expense_splits").select("*") as unknown as QueryBuilder<ExpenseSplit>
  );
}

export async function getSettlementBatches(): Promise<SettlementBatch[]> {
  const supabase = createClient();
  return fetchAll<SettlementBatch>(() =>
    supabase
      .from("settlement_batches")
      .select("*")
      .order("created_at", { ascending: false }) as unknown as QueryBuilder<SettlementBatch>
  );
}

export async function getSettlementBatchResults(): Promise<SettlementBatchResult[]> {
  const supabase = createClient();
  return fetchAll<SettlementBatchResult>(() =>
    supabase.from("settlement_batch_results").select("*") as unknown as QueryBuilder<SettlementBatchResult>
  );
}

export async function getSettlementPayments(): Promise<SettlementPayment[]> {
  const supabase = createClient();
  return fetchAll<SettlementPayment>(() =>
    supabase
      .from("settlement_payments")
      .select("*")
      .order("payment_date", { ascending: false }) as unknown as QueryBuilder<SettlementPayment>
  );
}

export async function getBatchDetail(id: string): Promise<{
  batch: SettlementBatch | null;
  items: SettlementBatchItem[];
  results: SettlementBatchResult[];
  payments: SettlementPayment[];
}> {
  const supabase = createClient();
  const [b, items, results] = await Promise.all([
    supabase.from("settlement_batches").select("*").eq("id", id).maybeSingle(),
    fetchAll<SettlementBatchItem>(() =>
      supabase.from("settlement_batch_items").select("*").eq("settlement_batch_id", id) as unknown as QueryBuilder<SettlementBatchItem>
    ),
    fetchAll<SettlementBatchResult>(() =>
      supabase
        .from("settlement_batch_results")
        .select("*")
        .eq("settlement_batch_id", id)
        .order("amount", { ascending: false }) as unknown as QueryBuilder<SettlementBatchResult>
    )
  ]);
  const resultIds = results.map((x) => x.id);
  let payments: SettlementPayment[] = [];
  if (resultIds.length > 0) {
    payments = await fetchAll<SettlementPayment>(() =>
      supabase
        .from("settlement_payments")
        .select("*")
        .in("settlement_batch_result_id", resultIds)
        .order("payment_date", { ascending: false }) as unknown as QueryBuilder<SettlementPayment>
    );
  }
  return {
    batch: (b.data as SettlementBatch) ?? null,
    items,
    results,
    payments
  };
}

export async function getRecurring(): Promise<RecurringExpense[]> {
  const supabase = createClient();
  const { data } = await supabase.from("recurring_expenses").select("*").order("next_due_date");
  return (data as RecurringExpense[]) ?? [];
}

/**
 * Distinct merchant names from the household's expense history, newest first.
 * Capped at 500 rows so the request stays small; any merchant used in the last
 * ~2 years of activity will make it in.
 */
export async function getDistinctMerchants(): Promise<string[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("expenses")
    .select("merchant")
    .order("expense_date", { ascending: false })
    .limit(500);
  if (!data) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data as { merchant: string | null }[]) {
    const m = row.merchant?.trim();
    if (!m) continue;
    const key = m.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out.sort((a, b) => a.localeCompare(b));
}
