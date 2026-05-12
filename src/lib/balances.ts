import type { Expense, ExpenseSplit, Profile, SettlementPayment } from "./types";

export interface UserBalance {
  user_id: string;
  paid: number;
  owed: number;
  net: number; // paid - owed
}

export interface DebtSuggestion {
  from_user_id: string;
  to_user_id: string;
  amount: number;
}

/**
 * Compute per-user paid / owed / net. Each settlement payment is treated
 * the same way the legacy direct-settlement record used to be: the payer's
 * `paid` goes up by the payment amount, the recipient's `owed` goes up
 * by the same amount. Expense splits still drive the base "owed" totals
 * regardless of their settlement status — settling a split just moves the
 * obligation into a settlement; only an actual payment reduces the net.
 */
export function computeBalances(
  profiles: Profile[],
  expenses: Expense[],
  splits: ExpenseSplit[],
  payments: SettlementPayment[],
  paymentsFromTo: { id: string; from_user_id: string; to_user_id: string }[]
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

  // Resolve each payment's settlement → from/to direction
  const dirById = new Map(paymentsFromTo.map((s) => [s.id, s]));
  for (const pay of payments) {
    const dir = dirById.get(pay.settlement_id);
    if (!dir) continue;
    const f = byUser.get(dir.from_user_id);
    const t = byUser.get(dir.to_user_id);
    if (f) f.paid += Number(pay.amount);
    if (t) t.owed += Number(pay.amount);
  }

  for (const b of byUser.values()) {
    b.net = Math.round((b.paid - b.owed) * 100) / 100;
  }
  return Array.from(byUser.values());
}

/**
 * Minimize settlement transactions: greedy match largest debtor to largest creditor.
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
        amount: Math.round(pay * 100) / 100
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
 * Find unpaid expense shares between two users (in the "from owes to" direction).
 * A share qualifies when:
 *   - the user_id on the split is the `from_user_id` (they owe)
 *   - the expense was paid by `to_user_id` (they're owed)
 *   - the share is not already in a settlement (settlement_status='unpaid')
 */
export interface UnpaidShare {
  split: ExpenseSplit;
  expense: Expense;
}

export function findUnpaidShares(
  expenses: Expense[],
  splits: ExpenseSplit[],
  fromUserId: string,
  toUserId: string
): UnpaidShare[] {
  const expById = new Map(expenses.map((e) => [e.id, e]));
  const out: UnpaidShare[] = [];
  for (const s of splits) {
    if (s.user_id !== fromUserId) continue;
    if (s.settlement_status !== "unpaid") continue;
    const e = expById.get(s.expense_id);
    if (!e) continue;
    if (e.paid_by_user_id !== toUserId) continue;
    if (Number(s.calculated_amount) <= 0) continue;
    out.push({ split: s, expense: e });
  }
  out.sort((a, b) => (a.expense.expense_date < b.expense.expense_date ? -1 : 1));
  return out;
}
