import type { Expense, ExpenseSplit } from "./types";

export interface BrokenExpense {
  id: string;
  expense_date: string;
  merchant: string;
  total_amount: number;
  currency: string;
  split_sum: number;
  discrepancy: number; // total - split_sum; positive means total > splits (leakage into Σ nets)
  split_count: number;
}

export interface IntegrityReport {
  hasIssues: boolean;
  totalDiscrepancy: number; // sum of absolute discrepancies
  signedDiscrepancy: number; // sum of signed discrepancies; matches Σ(nets) across the household
  brokenExpenses: BrokenExpense[];
}

/**
 * Audit every expense's splits against its total_amount.
 *
 * Why this matters: `computeBalances` adds each expense's total to the payer's
 * `paid` and each split's calculated_amount to that user's `owed`. If an
 * expense's splits don't sum to its total — or an expense has no splits at all
 * — the difference becomes a non-zero `Σ(net)` across the household (the
 * "₱66k that no one owes" bug from the design review).
 *
 * Tolerance: ±₱0.01 (rounding; the UI generates splits to 2dp).
 */
export function auditBalanceIntegrity(
  expenses: Expense[],
  splits: ExpenseSplit[]
): IntegrityReport {
  const splitsByExpense = new Map<string, ExpenseSplit[]>();
  for (const s of splits) {
    if (!splitsByExpense.has(s.expense_id)) splitsByExpense.set(s.expense_id, []);
    splitsByExpense.get(s.expense_id)!.push(s);
  }

  const broken: BrokenExpense[] = [];
  let signed = 0;
  let abs = 0;

  for (const e of expenses) {
    const sp = splitsByExpense.get(e.id) ?? [];
    const sum = sp.reduce((a, b) => a + Number(b.calculated_amount), 0);
    const total = Number(e.total_amount);
    const diff = Math.round((total - sum) * 100) / 100;
    if (Math.abs(diff) > 0.01 || sp.length === 0) {
      broken.push({
        id: e.id,
        expense_date: e.expense_date,
        merchant: e.merchant,
        total_amount: total,
        currency: e.currency,
        split_sum: Math.round(sum * 100) / 100,
        discrepancy: diff,
        split_count: sp.length
      });
      signed += diff;
      abs += Math.abs(diff);
    }
  }

  // Newest discrepancies first — the user will most likely remember recent
  // expenses and can fix them from memory.
  broken.sort((a, b) => b.expense_date.localeCompare(a.expense_date));

  return {
    hasIssues: broken.length > 0,
    totalDiscrepancy: Math.round(abs * 100) / 100,
    signedDiscrepancy: Math.round(signed * 100) / 100,
    brokenExpenses: broken
  };
}
