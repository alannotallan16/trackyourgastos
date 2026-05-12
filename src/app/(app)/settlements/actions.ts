"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { computeHouseholdNet, settlementSuggestions } from "@/lib/balances";
import type { Expense, ExpenseSplit, Profile } from "@/lib/types";

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Create settlement batch
//
// Takes a list of expense ids. Server fetches each expense and ALL its splits,
// validates every split is currently "unpaid", computes per-user net across
// the batch, runs the greedy minimum-payments algorithm, and persists:
//
//   settlement_batches            one row
//     settlement_batch_items      one per expense_split (denormalised user/amount)
//     settlement_batch_results    one per generated debtor→creditor payment
//
// Splits are flipped to "in_settlement" with settlement_batch_id pointing at
// the new batch. The user then records real payments against each result.
// ---------------------------------------------------------------------------
const CreateBatchSchema = z.object({
  expense_ids: z.array(z.string().uuid()).min(1, "Pick at least one expense."),
  notes: z.string().nullable().optional(),
  currency: z.string().default("PHP")
});

export type CreateBatchPayload = z.infer<typeof CreateBatchSchema>;

export async function createSettlementBatch(
  payload: CreateBatchPayload
): Promise<{ id: string }> {
  const parsed = CreateBatchSchema.parse(payload);

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  // Fetch expenses, all their splits, and the profile list (for balance math).
  const [{ data: expenses, error: expErr }, { data: splits, error: spErr }, { data: profiles, error: profErr }] =
    await Promise.all([
      supabase.from("expenses").select("*").in("id", parsed.expense_ids),
      supabase.from("expense_splits").select("*").in("expense_id", parsed.expense_ids),
      supabase.from("profiles").select("*")
    ]);
  if (expErr) throw expErr;
  if (spErr) throw spErr;
  if (profErr) throw profErr;
  if (!expenses || expenses.length !== parsed.expense_ids.length) {
    throw new Error("One or more selected expenses could not be found.");
  }
  if (!splits || splits.length === 0) {
    throw new Error("Selected expenses have no splits to reconcile.");
  }

  // Every split of every selected expense must be unpaid AND not assigned to
  // an active batch. (We rely on the unpaid status to enforce both.)
  for (const s of splits as ExpenseSplit[]) {
    if (s.settlement_status !== "unpaid" || s.settlement_batch_id) {
      throw new Error("One of the selected expenses has shares already in a settlement.");
    }
  }

  // Compute household net across this subset and the minimum payments.
  const balances = computeHouseholdNet(
    profiles as Profile[],
    expenses as Expense[],
    splits as ExpenseSplit[]
  );
  const suggestions = settlementSuggestions(balances);

  if (suggestions.length === 0) {
    throw new Error("Selected expenses already reconcile to zero — nothing to settle.");
  }

  // Insert batch + items + results atomically (best-effort, no transactions
  // in supabase-js; on error we leave whatever was inserted but the failed
  // batch is easy to identify by its zero items/results).
  const { data: insBatch, error: batchErr } = await supabase
    .from("settlement_batches")
    .insert({
      status: "open",
      notes: parsed.notes ?? null,
      created_by: user.id
    })
    .select("id")
    .single();
  if (batchErr || !insBatch) throw batchErr ?? new Error("Failed to create batch.");

  const batchId = insBatch.id as string;

  const itemRows = (splits as ExpenseSplit[]).map((s) => ({
    settlement_batch_id: batchId,
    expense_id: s.expense_id,
    expense_split_id: s.id,
    user_id: s.user_id,
    share_amount: round2(Number(s.calculated_amount))
  }));
  const { error: itemsErr } = await supabase.from("settlement_batch_items").insert(itemRows);
  if (itemsErr) throw itemsErr;

  const resultRows = suggestions.map((p) => ({
    settlement_batch_id: batchId,
    from_user_id: p.from_user_id,
    to_user_id: p.to_user_id,
    amount: round2(p.amount),
    amount_paid: 0,
    remaining_amount: round2(p.amount),
    currency: parsed.currency,
    status: "open" as const
  }));
  const { error: resultsErr } = await supabase.from("settlement_batch_results").insert(resultRows);
  if (resultsErr) throw resultsErr;

  // Move included splits to "in_settlement".
  const splitIds = (splits as ExpenseSplit[]).map((s) => s.id);
  const { error: updErr } = await supabase
    .from("expense_splits")
    .update({
      settlement_status: "in_settlement",
      settlement_batch_id: batchId,
      settled_at: null
    })
    .in("id", splitIds);
  if (updErr) throw updErr;

  revalidatePath("/settlements");
  revalidatePath(`/settlements/${batchId}`);
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { id: batchId };
}

// ---------------------------------------------------------------------------
// Record a payment against a single batch result.
// ---------------------------------------------------------------------------
const PaymentSchema = z.object({
  settlement_batch_result_id: z.string().uuid(),
  payment_date: z.string().min(1),
  amount: z.coerce.number().positive(),
  payment_method: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  reference_number: z.string().nullable().optional(),
  attachment_path: z.string().nullable().optional(),
  allow_overpay: z.boolean().optional()
});

export type RecordPaymentPayload = z.infer<typeof PaymentSchema>;

export async function recordPayment(payload: RecordPaymentPayload) {
  const parsed = PaymentSchema.parse(payload);
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: result, error: rErr } = await supabase
    .from("settlement_batch_results")
    .select("id, settlement_batch_id, amount, amount_paid, remaining_amount, status, currency")
    .eq("id", parsed.settlement_batch_result_id)
    .maybeSingle();
  if (rErr) throw rErr;
  if (!result) throw new Error("Settlement payment row not found.");
  if (result.status === "paid") throw new Error("This payment is already fully paid.");

  const remaining = Number(result.remaining_amount);
  if (parsed.amount > remaining + 0.005 && !parsed.allow_overpay) {
    throw new Error(`Payment exceeds remaining balance of ${remaining.toFixed(2)}.`);
  }

  const { error: insErr } = await supabase.from("settlement_payments").insert({
    settlement_batch_result_id: parsed.settlement_batch_result_id,
    payment_date: parsed.payment_date,
    amount: round2(parsed.amount),
    currency: result.currency,
    payment_method: parsed.payment_method ?? null,
    notes: parsed.notes ?? null,
    reference_number: parsed.reference_number ?? null,
    attachment_path: parsed.attachment_path ?? null,
    created_by: user.id
  });
  if (insErr) throw insErr;

  const newPaid = round2(Number(result.amount_paid) + parsed.amount);
  const newRemaining = round2(Number(result.amount) - newPaid);
  const newStatus = newRemaining <= 0.005 ? "paid" : "partially_paid";

  const { error: updErr } = await supabase
    .from("settlement_batch_results")
    .update({
      amount_paid: newPaid,
      remaining_amount: Math.max(0, newRemaining),
      status: newStatus
    })
    .eq("id", parsed.settlement_batch_result_id);
  if (updErr) throw updErr;

  // Roll up the parent batch status.
  await rollupBatchStatus(result.settlement_batch_id);

  revalidatePath("/settlements");
  revalidatePath(`/settlements/${result.settlement_batch_id}`);
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// Cancel a batch — only allowed when no payments have been recorded yet.
// ---------------------------------------------------------------------------
export async function cancelBatch(batchId: string) {
  const supabase = createClient();
  const { data: batch, error: bErr } = await supabase
    .from("settlement_batches")
    .select("id, status")
    .eq("id", batchId)
    .maybeSingle();
  if (bErr) throw bErr;
  if (!batch) throw new Error("Batch not found.");
  if (batch.status === "paid") throw new Error("Cannot cancel a fully paid batch.");
  if (batch.status === "cancelled") return;

  // Block cancellation if any payment exists.
  const { data: results } = await supabase
    .from("settlement_batch_results")
    .select("id, amount_paid")
    .eq("settlement_batch_id", batchId);
  const hasPayment = (results ?? []).some((r: any) => Number(r.amount_paid) > 0.005);
  if (hasPayment) {
    throw new Error("Cannot cancel a batch that already has payments — record a refund or contact support.");
  }

  // Flip splits back to unpaid.
  const { data: items } = await supabase
    .from("settlement_batch_items")
    .select("expense_split_id")
    .eq("settlement_batch_id", batchId);
  const splitIds = (items ?? []).map((i: any) => i.expense_split_id);

  const { error: updErr } = await supabase
    .from("settlement_batches")
    .update({ status: "cancelled" })
    .eq("id", batchId);
  if (updErr) throw updErr;

  if (splitIds.length > 0) {
    const { error: spErr } = await supabase
      .from("expense_splits")
      .update({ settlement_status: "unpaid", settlement_batch_id: null, settled_at: null })
      .in("id", splitIds);
    if (spErr) throw spErr;
  }

  revalidatePath("/settlements");
  revalidatePath(`/settlements/${batchId}`);
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// Status rollup helper — call after any payment is recorded.
// ---------------------------------------------------------------------------
async function rollupBatchStatus(batchId: string) {
  const supabase = createClient();
  const { data: results } = await supabase
    .from("settlement_batch_results")
    .select("status")
    .eq("settlement_batch_id", batchId);
  if (!results || results.length === 0) return;

  const statuses = results.map((r: any) => r.status as string);
  const allPaid = statuses.every((s) => s === "paid");
  const anyPaidOrPartial = statuses.some((s) => s === "paid" || s === "partially_paid");
  const next = allPaid ? "paid" : anyPaidOrPartial ? "partially_paid" : "open";

  await supabase.from("settlement_batches").update({ status: next }).eq("id", batchId);

  // When the whole batch is paid, every included split graduates to settled.
  if (allPaid) {
    const { data: items } = await supabase
      .from("settlement_batch_items")
      .select("expense_split_id")
      .eq("settlement_batch_id", batchId);
    const splitIds = (items ?? []).map((i: any) => i.expense_split_id);
    if (splitIds.length > 0) {
      await supabase
        .from("expense_splits")
        .update({ settlement_status: "settled", settled_at: new Date().toISOString() })
        .in("id", splitIds);
    }
  }
}
