"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Create settlement
// ---------------------------------------------------------------------------
const CreateSchema = z.object({
  from_user_id: z.string().uuid(),
  to_user_id: z.string().uuid(),
  currency: z.string().default("PHP"),
  split_ids: z.array(z.string().uuid()).min(1, "Pick at least one expense to include."),
  notes: z.string().nullable().optional()
});

export type CreateSettlementPayload = z.infer<typeof CreateSchema>;

export async function createSettlement(payload: CreateSettlementPayload): Promise<{ id: string }> {
  const parsed = CreateSchema.parse(payload);
  if (parsed.from_user_id === parsed.to_user_id) {
    throw new Error("Payer and recipient must differ.");
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  // Fetch the splits + their expenses to validate direction + status, and
  // sum the total.
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

  let total = 0;
  for (const s of splits as any[]) {
    if (s.settlement_status !== "unpaid" || s.settlement_id) {
      throw new Error("One of the selected shares is already in a settlement.");
    }
    if (s.user_id !== parsed.from_user_id) {
      throw new Error("Selected share doesn't belong to the From person.");
    }
    const exp = expById.get(s.expense_id);
    if (!exp || exp.paid_by_user_id !== parsed.to_user_id) {
      throw new Error("Selected share isn't owed to the To person.");
    }
    total += Number(s.calculated_amount);
  }
  total = round2(total);
  if (total <= 0) throw new Error("Settlement total must be positive.");

  // Insert settlement
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

  // Insert items
  const items = (splits as any[]).map((s: any) => ({
    settlement_id: inserted.id,
    expense_id: s.expense_id,
    expense_split_id: s.id,
    amount: round2(Number(s.calculated_amount))
  }));
  const { error: itemsErr } = await supabase.from("settlement_items").insert(items);
  if (itemsErr) throw itemsErr;

  // Mark splits in_settlement
  const { error: updErr } = await supabase
    .from("expense_splits")
    .update({ settlement_status: "in_settlement", settlement_id: inserted.id, settled_at: null })
    .in("id", parsed.split_ids);
  if (updErr) throw updErr;

  revalidatePath("/settlements");
  revalidatePath(`/settlements/${inserted.id}`);
  revalidatePath("/expenses");
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
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (sErr) throw sErr;
  if (!settlement) throw new Error("Settlement not found.");
  if (settlement.status === "paid") throw new Error("Cannot cancel a fully paid settlement.");
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
