import "server-only";
import { createClient } from "@/lib/supabase/server";
import { calculateSplits, equalSplitInputs, presetToSplitInputs } from "@/lib/splits";
import type { SplitInput, SplitPreset, SplitPresetMember } from "@/lib/types";

type Freq = "weekly" | "monthly" | "yearly";

function advanceDate(date: string, freq: Freq): string {
  const d = new Date(date);
  if (freq === "weekly") d.setDate(d.getDate() + 7);
  else if (freq === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Catch up every active recurring template whose next_due_date is in the past
 * by inserting one expense per missed cycle and advancing next_due_date each
 * time. Safe to call on every page load: concurrent calls can't double-insert
 * because the next_due_date update is conditional on the old value (optimistic
 * lock), so only one caller actually generates an expense for a given cycle.
 *
 * Fails open: returns the count generated, and silently returns 0 on any error
 * so that a transient Supabase issue won't block the page from rendering.
 */
export async function syncDueRecurring(): Promise<number> {
  try {
    const supabase = createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return 0;

    const today = new Date().toISOString().slice(0, 10);

    const { data: due } = await supabase
      .from("recurring_expenses")
      .select("*")
      .eq("active", true)
      .lte("next_due_date", today);

    if (!due || due.length === 0) return 0;

    // Cache presets + their members once.
    const presetIds = Array.from(
      new Set((due as { split_preset_id: string | null }[]).map((r) => r.split_preset_id).filter((x): x is string => !!x))
    );
    const [presets, members, profiles] = await Promise.all([
      presetIds.length
        ? supabase.from("split_presets").select("*").in("id", presetIds).then((r) => (r.data ?? []) as SplitPreset[])
        : Promise.resolve([] as SplitPreset[]),
      presetIds.length
        ? supabase.from("split_preset_members").select("*").in("preset_id", presetIds).then((r) => (r.data ?? []) as SplitPresetMember[])
        : Promise.resolve([] as SplitPresetMember[]),
      supabase.from("profiles").select("id").then((r) => ((r.data ?? []) as { id: string }[]).map((p) => p.id))
    ]);

    let generated = 0;

    for (const rec of due as Array<{
      id: string;
      merchant: string;
      amount: number | string;
      currency: string;
      category_id: string | null;
      paid_by_user_id: string;
      split_preset_id: string | null;
      notes: string | null;
      frequency: Freq;
      next_due_date: string;
    }>) {
      // Resolve split inputs once per template.
      let inputs: SplitInput[] = [];
      if (rec.split_preset_id) {
        const preset = presets.find((p) => p.id === rec.split_preset_id);
        const presetMembers = members.filter((m) => m.preset_id === rec.split_preset_id);
        if (preset && presetMembers.length > 0) {
          inputs = presetToSplitInputs({ ...(preset as SplitPreset), members: presetMembers });
        }
      }
      if (inputs.length === 0) {
        inputs = equalSplitInputs(profiles);
      }

      // Catch up cycle by cycle; cap at 60 to protect against misconfigured
      // templates (e.g. weekly template missed for over a year).
      let cur = rec.next_due_date;
      let safety = 0;
      while (cur <= today && safety < 60) {
        const nextCur = advanceDate(cur, rec.frequency);

        // Optimistic-lock the advance so two concurrent callers can't both
        // insert an expense for the same cycle.
        const { data: locked, error: lockErr } = await supabase
          .from("recurring_expenses")
          .update({ next_due_date: nextCur })
          .eq("id", rec.id)
          .eq("next_due_date", cur)
          .select("id");
        if (lockErr) break;
        if (!locked || locked.length === 0) {
          // Another session already advanced this template for `cur`.
          break;
        }

        const splits = calculateSplits(Number(rec.amount), inputs);
        const { data: exp } = await supabase
          .from("expenses")
          .insert({
            expense_date: cur,
            merchant: rec.merchant,
            total_amount: rec.amount,
            currency: rec.currency,
            category_id: rec.category_id,
            paid_by_user_id: rec.paid_by_user_id,
            split_preset_id: rec.split_preset_id,
            notes: rec.notes,
            recurring_expense_id: rec.id,
            created_by: user.id
          })
          .select("id")
          .single();

        if (exp) {
          await supabase.from("expense_splits").insert(
            splits.map((s) => ({
              expense_id: exp.id,
              user_id: s.user_id,
              split_type: s.split_type,
              percentage: s.percentage,
              fixed_amount: s.fixed_amount,
              calculated_amount: s.calculated_amount
            }))
          );
          generated++;
        }

        cur = nextCur;
        safety++;
      }
    }

    return generated;
  } catch {
    return 0;
  }
}
