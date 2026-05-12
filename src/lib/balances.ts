import type {
  Expense,
  ExpenseSplit,
  Profile,
  SettlementBatchResult,
  SettlementPayment
} from "./types";

export interface UserBalance {
  user_id: string;
  paid: number;
  owed: number;
  net: number;
}

export interface DebtSuggestion {
  from_user_id: string;
  to_user_id: string;
  amount: number;
}

const ROUND2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Per-user net across the *whole* household:
 *   paid  = expense.total_amount for expenses they paid + settlement payments they made
 *   owed  = sum of their expense_splits.calculated_amount + settlement payments they received
 *   net   = paid - owed
 *
 * Settlement payments resolve through their batch_result row (which carries
 * from_user_id / to_user_id). When a payer hands money to a creditor for a
 * batch result, the payer's `paid` rises and the creditor's `owed` rises by
 * the same amount — bringing their nets back toward zero.
 */
export function computeBalances(
  profiles: Profile[],
  expenses: Expense[],
  splits: ExpenseSplit[],
  payments: SettlementPayment[],
  results: { id: string; from_user_id: string; to_user_id: string }[]
): UserBalance[] {
  const byUser = new Map<string, UserBalance>();
  for (const p of profiles) byUser.set(p.id, { user_id: p.id, paid: 0, owed: 0, net: 0 });

  for (const e of expenses) {
    const b = byUser.get(e.paid_by_user_id);
    if (b) b.paid += Number(e.total_amount);
  }
  for (const s of splits) {
    const b = byUser.get(s.user_id);
    if (b) b.owed += Number(s.calculated_amount);
  }

  const resultById = new Map(results.map((r) => [r.id, r]));
  for (const pay of payments) {
    const r = resultById.get(pay.settlement_batch_result_id);
    if (!r) continue;
    const from = byUser.get(r.from_user_id);
    const to = byUser.get(r.to_user_id);
    if (from) from.paid += Number(pay.amount);
    if (to) to.owed += Number(pay.amount);
  }

  for (const b of byUser.values()) b.net = ROUND2(b.paid - b.owed);
  return Array.from(byUser.values());
}

/**
 * Greedy minimum-transaction reduction of a balance vector. Largest debtor
 * pays largest creditor until everyone's net is zero.
 */
export function settlementSuggestions(balances: UserBalance[]): DebtSuggestion[] {
  const creditors = balances.filter((b) => b.net > 0.005).map((b) => ({ ...b }));
  const debtors = balances.filter((b) => b.net < -0.005).map((b) => ({ ...b }));
  creditors.sort((a, b) => b.net - a.net);
  debtors.sort((a, b) => a.net - b.net);

  const out: DebtSuggestion[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const pay = Math.min(-d.net, c.net);
    if (pay > 0.005) {
      out.push({
        from_user_id: d.user_id,
        to_user_id: c.user_id,
        amount: ROUND2(pay)
      });
      d.net += pay;
      c.net -= pay;
    }
    if (Math.abs(d.net) < 0.005) i++;
    if (Math.abs(c.net) < 0.005) j++;
  }
  return out;
}

/**
 * Compute net balances limited to a chosen subset of expenses + their splits.
 * Used by the Create Settlement preview before the batch is saved.
 */
export function computeHouseholdNet(
  profiles: Profile[],
  expenses: Expense[],
  splits: ExpenseSplit[]
): UserBalance[] {
  return computeBalances(profiles, expenses, splits, [], []);
}
