"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Create settlement (bilateral netting)
//
// Caller passes two participants (A, B) and the splits they want to reconcile.
// Each split must point *one way* between them — i.e. either:
//   split.user_id = A AND expense.paid_by = B  (A owes B)
// or
//   split.user_id = B AND expense.paid_by = A  (B owes A)
//
// We compute grossA→B and grossB→A, derive net + direction, and store the
// settlement with from = net debtor, to = net creditor, total_amount = |net|.
// If the net is zero (perfect offset) the settlement is created already in
// the "paid" state and every included share is marked settled — no actual
// money needs to change hands.
// ---------------------------------------------------------------------------
const CreateSchema = z.object({
  participant_a_id: z.string().uuid(),
  participant_b_id: z.string().uuid(),
  currency: z.string().default("PHP"),
  split_ids: z.array(z.string().uuid()).min(1, "Pick at least one expense to include."),
  notes: z.string().nullable().optional()
});

export type CreateSettlementPayload = z.infer<typeof CreateSchema>;

export async function createSettlement(payload: CreateSettlementPayload): Promise<{ id: string }> {
  const parsed = CreateSchema.parse(payload);
  if (parsed.participant_a_id === parsed.participant_b_id) {
    throw new Error("The two participants must differ.");
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  // Fetch the splits + their expenses to validate direction + status.
  const { data: splits, error: splitsErr } = await supabase
    .from("expense_splits")
    .select("id, expense_id, user_id, calculated_amount, settlement_status, settlement_id")
    .in("id", parsed.split_ids);
  if (splitsErr) throw splitsErr;
  if (!splits || splits.length === 0) throw new Error("No expense shares found.");
  if (splits.length !== parsed.split_ids.length) {
    throw new Error("Some shares could not be found.");
  }

  const expenseIds = Array.from(new Set(splits.map((s: any) => s.expense_id)));
  const { data: expenses, error: expErr } = await supabase
    .from("expenses")
    .select("id, paid_by_user_id")
    .in("id", expenseIds);
  if (expErr) throw expErr;
  const expById = new Map((expenses ?? []).map((e: any) => [e.id, e]));

  const A = parsed.participant_a_id;
  const B = parsed.participant_b_id;
  let grossAtoB = 0;
  let grossBtoA = 0;
  for (const s of splits as any[]) {
    if (s.settlement_status !== "unpaid" || s.settlement_id) {
      throw new Error("One of the selected shares is already in a settlement.");
    }
    const exp = expById.get(s.expense_id);
    if (!exp) throw new Error("Selected share references a missing expense.");
    const owerId: string = s.user_id;
    const payerId: string = exp.paid_by_user_id;
    if (owerId === A && payerId === B) {
      grossAtoB += Number(s.calculated_amount);
    } else if (owerId === B && payerId === A) {
      grossBtoA += Number(s.calculated_amount);
    } else {
      throw new Error("Selected share isn't between the two participants.");
    }
  }
  grossAtoB = round2(grossAtoB);
  grossBtoA = round2(grossBtoA);

  const netSigned = round2(grossAtoB - grossBtoA); // > 0 means A owes B net
  const total = Math.abs(netSigned);
  const fromUser = netSigned >= 0 ? A : B;
  const toUser = netSigned >= 0 ? B : A;
  const fullyOffset = total <= 0.005;

  // Insert settlement
  const { data: inserted, error: insErr } = await supabase
    .from("settlements")
    .insert({
      from_user_id: fromUser,
      to_user_id: toUser,
      currency: parsed.currency,
      total_amount: total,
      amount_paid: fullyOffset ? total : 0,
      remaining_amount: fullyOffset ? 0 : total,
      status: fullyOffset ? "paid" : "open",
      notes: parsed.notes ?? null,
      created_by: user.id
    })
    .select("id")
    .single();
  if (insErr || !inserted) throw insErr ?? new Error("Failed to create settlement.");

  // Insert items (one row per included split, both directions kept)
  const items = (splits as any[]).map((s: any) => ({
    settlement_id: inserted.id,
    expense_id: s.expense_id,
    expense_split_id: s.id,
    amount: round2(Number(s.calculated_amount))
  }));
  const { error: itemsErr } = await supabase.from("settlement_items").insert(items);
  if (itemsErr) throw itemsErr;

  // Mark splits in_settlement (or settled, if the netting fully offset them)
  const { error: updErr } = await supabase
    .from("expense_splits")
    .update({
      settlement_status: fullyOffset ? "settled" : "in_settlement",
      settlement_id: inserted.id,
      settled_at: fullyOffset ? new Date().toISOString() : null
    })
    .in("id", parsed.split_ids);
  if (updErr) throw updErr;

  revalidatePath("/settlements");
  revalidatePath(`/settlements/${inserted.id}`);
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { id: inserted.id };
}

// ---------------------------------------------------------------------------
// Create net settlement (household-net mode)
//
// "Net" settlements don't attach specific expense_splits. They represent the
// optimized payment that reduces the overall household balance — typically
// produced by the greedy settlementSuggestions output. Because no items are
// attached, no expense_splits are mutated to "in_settlement" / "settled".
// Recording a payment still updates balances correctly: settlement_payments
// already feed into computeBalances on the read side.
// ---------------------------------------------------------------------------
const NetSchema = z.object({
  from_user_id: z.string().uuid(),
  to_user_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  currency: z.string().default("PHP"),
  notes: z.string().nullable().optional()
});

export type CreateNetSettlementPayload = z.infer<typeof NetSchema>;

export async function createNetSettlement(payload: CreateNetSettlementPayload): Promise<{ id: string }> {
  const parsed = NetSchema.parse(payload);
  if (parsed.from_user_id === parsed.to_user_id) {
    throw new Error("Payer and recipient must differ.");
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const total = round2(parsed.amount);
  if (total <= 0) throw new Error("Settlement amount must be positive.");

  const { data: inserted, error: insErr } = await supabase
    .from("settlements")
    .insert({
      from_user_id: parsed.from_user_id,
      to_user_id: parsed.to_user_id,
      currency: parsed.currency,
      total_amount: total,
      amount_paid: 0,
      remaining_amount: total,
      status: "open",
      notes: parsed.notes ?? null,
      created_by: user.id
    })
    .select("id")
    .single();
  if (insErr || !inserted) throw insErr ?? new Error("Failed to create settlement.");

  revalidatePath("/settlements");
  revalidatePath(`/settlements/${inserted.id}`);
  revalidatePath("/dashboard");
  return { id: inserted.id };
}

// ---------------------------------------------------------------------------
// Record payment against a settlement
// ---------------------------------------------------------------------------
const PaymentSchema = z.object({
  settlement_id: z.string().uuid(),
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

  const { data: settlement, error: sErr } = await supabase
    .from("settlements")
    .select("id, total_amount, amount_paid, remaining_amount, status, currency")
    .eq("id", parsed.settlement_id)
    .maybeSingle();
  if (sErr) throw sErr;
  if (!settlement) throw new Error("Settlement not found.");
  if (settlement.status === "paid" || settlement.status === "cancelled") {
    throw new Error(`Settlement is ${settlement.status}; cannot record payment.`);
  }

  const remaining = Number(settlement.remaining_amount);
  if (parsed.amount > remaining + 0.005 && !parsed.allow_overpay) {
    throw new Error(`Payment exceeds remaining balance of ${remaining.toFixed(2)}.`);
  }

  const { error: payErr } = await supabase.from("settlement_payments").insert({
    settlement_id: parsed.settlement_id,
    payment_date: parsed.payment_date,
    amount: round2(parsed.amount),
    currency: settlement.currency,
    payment_method: parsed.payment_method ?? null,
    notes: parsed.notes ?? null,
    reference_number: parsed.reference_number ?? null,
    attachment_path: parsed.attachment_path ?? null,
    created_by: user.id
  });
  if (payErr) throw payErr;

  const newPaid = round2(Number(settlement.amount_paid) + parsed.amount);
  const newRemaining = round2(Number(settlement.total_amount) - newPaid);
  const newStatus = newRemaining <= 0.005 ? "paid" : "partially_paid";

  const { error: updErr } = await supabase
    .from("settlements")
    .update({ amount_paid: newPaid, remaining_amount: Math.max(0, newRemaining), status: newStatus })
    .eq("id", parsed.settlement_id);
  if (updErr) throw updErr;

  // If fully paid, mark all included splits as settled.
  if (newStatus === "paid") {
    const { data: items } = await supabase
      .from("settlement_items")
      .select("expense_split_id")
      .eq("settlement_id", parsed.settlement_id);
    const splitIds = (items ?? []).map((i: any) => i.expense_split_id);
    if (splitIds.length > 0) {
      const { error } = await supabase
        .from("expense_splits")
        .update({ settlement_status: "settled", settled_at: new Date().toISOString() })
        .in("id", splitIds);
      if (error) throw error;
    }
  }

  revalidatePath("/settlements");
  revalidatePath(`/settlements/${parsed.settlement_id}`);
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// Cancel settlement
// ---------------------------------------------------------------------------
export async function cancelSettlement(id: string) {
  const supabase = createClient();
  const { data: settlement, error: sErr } = await supabase
    .from("settlements")
    .select("id, status, total_amount, amount_paid")
    .eq("id", id)
    .maybeSingle();
  if (sErr) throw sErr;
  if (!settlement) throw new Error("Settlement not found.");
  // Allow cancelling a fully-offset (zero-amount) settlement even though
  // its status is "paid" — no real money was exchanged, so it's safe to
  // unwind. Block cancelling settlements with actual payments recorded.
  const wasFullyOffset =
    Number(settlement.total_amount) <= 0.005 && Number(settlement.amount_paid) <= 0.005;
  if (settlement.status === "paid" && !wasFullyOffset) {
    throw new Error("Cannot cancel a fully paid settlement.");
  }
  if (settlement.status === "cancelled") return;

  const { data: items } = await supabase
    .from("settlement_items")
    .select("expense_split_id")
    .eq("settlement_id", id);
  const splitIds = (items ?? []).map((i: any) => i.expense_split_id);

  const { error: updErr } = await supabase
    .from("settlements")
    .update({ status: "cancelled", remaining_amount: 0 })
    .eq("id", id);
  if (updErr) throw updErr;

  if (splitIds.length > 0) {
    const { error } = await supabase
      .from("expense_splits")
      .update({ settlement_status: "unpaid", settlement_id: null, settled_at: null })
      .in("id", splitIds);
    if (error) throw error;
  }

  revalidatePath("/settlements");
  revalidatePath(`/settlements/${id}`);
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}
