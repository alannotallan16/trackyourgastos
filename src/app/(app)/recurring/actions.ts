"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { calculateSplits, equalSplitInputs, presetToSplitInputs } from "@/lib/splits";
import type { SplitInput } from "@/lib/types";

const Schema = z.object({
  id: z.string().uuid().optional(),
  merchant: z.string().min(1),
  category_id: z.string().uuid().nullable().optional(),
  amount: z.coerce.number().positive(),
  currency: z.string().default("PHP"),
  paid_by_user_id: z.string().uuid(),
  split_preset_id: z.string().uuid().nullable().optional(),
  frequency: z.enum(["weekly", "monthly", "yearly"]),
  next_due_date: z.string().min(1),
  active: z.coerce.boolean().default(true),
  notes: z.string().nullable().optional()
});

export type RecurringPayload = z.infer<typeof Schema>;

export async function saveRecurring(payload: RecurringPayload) {
  const parsed = Schema.parse(payload);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (parsed.id) {
    const { error } = await supabase.from("recurring_expenses").update({
      merchant: parsed.merchant,
      category_id: parsed.category_id ?? null,
      amount: parsed.amount,
      currency: parsed.currency,
      paid_by_user_id: parsed.paid_by_user_id,
      split_preset_id: parsed.split_preset_id ?? null,
      frequency: parsed.frequency,
      next_due_date: parsed.next_due_date,
      active: parsed.active,
      notes: parsed.notes ?? null
    }).eq("id", parsed.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("recurring_expenses").insert({
      ...parsed,
      category_id: parsed.category_id ?? null,
      split_preset_id: parsed.split_preset_id ?? null,
      notes: parsed.notes ?? null,
      created_by: user.id
    });
    if (error) throw error;
  }
  revalidatePath("/recurring");
}

export async function deleteRecurring(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/recurring");
}

export async function toggleRecurringActive(id: string, active: boolean) {
  const supabase = createClient();
  const { error } = await supabase.from("recurring_expenses").update({ active }).eq("id", id);
  if (error) throw error;
  revalidatePath("/recurring");
}

function advanceDate(date: string, freq: "weekly" | "monthly" | "yearly"): string {
  const d = new Date(date);
  if (freq === "weekly") d.setDate(d.getDate() + 7);
  else if (freq === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/** Create an expense from a recurring template and advance the next_due_date. */
export async function generateFromRecurring(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: rec, error: recErr } = await supabase.from("recurring_expenses").select("*").eq("id", id).maybeSingle();
  if (recErr || !rec) throw recErr ?? new Error("Recurring not found");

  // Build splits from preset (or equal among all profiles)
  let splitInputs: SplitInput[] = [];
  if (rec.split_preset_id) {
    const { data: preset } = await supabase.from("split_presets").select("*").eq("id", rec.split_preset_id).single();
    const { data: members } = await supabase.from("split_preset_members").select("*").eq("preset_id", rec.split_preset_id);
    if (preset && members) {
      splitInputs = presetToSplitInputs({ ...(preset as any), members: members as any });
    }
  }
  if (splitInputs.length === 0) {
    const { data: profiles } = await supabase.from("profiles").select("id");
    splitInputs = equalSplitInputs((profiles ?? []).map((p: any) => p.id));
  }
  const splits = calculateSplits(Number(rec.amount), splitInputs);

  const { data: exp, error: expErr } = await supabase.from("expenses").insert({
    expense_date: rec.next_due_date,
    merchant: rec.merchant,
    total_amount: rec.amount,
    currency: rec.currency,
    category_id: rec.category_id,
    paid_by_user_id: rec.paid_by_user_id,
    split_preset_id: rec.split_preset_id,
    notes: rec.notes,
    recurring_expense_id: rec.id,
    created_by: user.id
  }).select("id").single();
  if (expErr) throw expErr;

  await supabase.from("expense_splits").insert(
    splits.map((s) => ({
      expense_id: exp!.id,
      user_id: s.user_id,
      split_type: s.split_type,
      percentage: s.percentage,
      fixed_amount: s.fixed_amount,
      calculated_amount: s.calculated_amount
    }))
  );

  await supabase.from("recurring_expenses").update({
    next_due_date: advanceDate(rec.next_due_date, rec.frequency)
  }).eq("id", rec.id);

  revalidatePath("/recurring");
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}
