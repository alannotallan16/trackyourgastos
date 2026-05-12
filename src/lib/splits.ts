import type { SplitInput, SplitPreset, SplitType } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Compute calculated_amount per user from a split spec + total.
 * Handles rounding so the sum equals total exactly (remainder goes to last row).
 */
export function calculateSplits(
  total: number,
  splits: SplitInput[]
): { user_id: string; split_type: SplitType; percentage: number | null; fixed_amount: number | null; calculated_amount: number }[] {
  if (splits.length === 0) return [];
  const out = splits.map((s) => {
    let amt = 0;
    if (s.split_type === "equal") {
      amt = total / splits.length;
    } else if (s.split_type === "percentage") {
      amt = (total * (s.percentage ?? 0)) / 100;
    } else if (s.split_type === "fixed") {
      amt = s.fixed_amount ?? 0;
    }
    return {
      user_id: s.user_id,
      split_type: s.split_type,
      percentage: s.percentage ?? null,
      fixed_amount: s.fixed_amount ?? null,
      calculated_amount: round2(amt)
    };
  });

  // Reconcile rounding to match total (only for equal / percentage)
  const sum = out.reduce((a, b) => a + b.calculated_amount, 0);
  const diff = round2(total - sum);
  if (diff !== 0 && out.length > 0) {
    out[out.length - 1].calculated_amount = round2(out[out.length - 1].calculated_amount + diff);
  }
  return out;
}

export function presetToSplitInputs(preset: SplitPreset): SplitInput[] {
  return preset.members.map((m) => ({
    user_id: m.user_id,
    split_type: preset.split_type,
    percentage: m.percentage,
    fixed_amount: m.fixed_amount
  }));
}

export function equalSplitInputs(userIds: string[]): SplitInput[] {
  return userIds.map((id) => ({ user_id: id, split_type: "equal" }));
}
