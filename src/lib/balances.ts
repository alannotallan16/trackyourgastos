import type { Expense, ExpenseSplit, Profile, Settlement } from "./types";

export interface UserBalance {
  user_id: string;
  paid: number;
  owed: number;
  net: number; // paid - owed - settlementsOut + settlementsIn
}

export interface DebtSuggestion {
  from_user_id: string;
  to_user_id: string;
  amount: number;
}

/** Compute per-user paid/owed/net taking settlements into account. */
export function computeBalances(
  profiles: Profile[],
  expenses: Expense[],
  splits: ExpenseSplit[],
  settlements: Settlement[]
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
  // Settlements: from_user pays to_user, so from gains "paid" credit, to gains "owed" credit.
  for (const st of settlements) {
    const f = byUser.get(st.from_user_id);
    const t = byUser.get(st.to_user_id);
    if (f) f.paid += Number(st.amount);
    if (t) t.owed += Number(st.amount);
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
