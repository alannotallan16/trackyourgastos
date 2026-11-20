import type {
  Expense,
  ExpenseSplit,
  Profile,
  SettlementBatch,
  SettlementBatchResult,
  SettlementPayment
} from "./types";

export interface UserMathRow {
  user_id: string;
  display_name: string;
  // Expenses side.
  expenses_paid: number; // Σ expense.total where paid_by = user
  share_of_expenses: number; // Σ expense_splits.calculated_amount where user = user
  // Settlements side.
  settlement_sent: number; // Σ settlement_payment.amount where result.from_user_id = user
  settlement_received: number; // Σ settlement_payment.amount where result.to_user_id = user
  // Derived — must match computeBalances' output or the implementation is wrong.
  paid: number;
  owed: number;
  net: number;
}

export interface BatchPaymentCheck {
  id: string;
  settlement_number: string;
  status: string;
  claimed_paid: number; // Σ settlement_batch_results.amount_paid for this batch
  recorded_paid: number; // Σ settlement_payments.amount for this batch's results
  discrepancy: number; // claimed - recorded
}

export interface BalanceMathReport {
  users: UserMathRow[];
  // Household-level rollups the user can cross-check against Reports.
  expenses_total: number;
  settlement_payments_total: number;
  sum_paid: number;
  sum_share: number;
  sum_net: number;
  batches_by_status: Record<string, number>;
  batch_payment_mismatches: BatchPaymentCheck[];
  // The reviewer's quick-test answer: how much does each user's net move if
  // we strip settlement payments from the calculation? Non-zero means the
  // code is counting them.
  settlement_impact: { user_id: string; display_name: string; delta: number }[];
}

const R = (n: number) => Math.round(n * 100) / 100;

export function auditBalanceMath(
  profiles: Profile[],
  expenses: Expense[],
  splits: ExpenseSplit[],
  batches: SettlementBatch[],
  batchResults: SettlementBatchResult[],
  payments: SettlementPayment[]
): BalanceMathReport {
  const resultById = new Map(batchResults.map((r) => [r.id, r]));

  const users = profiles.map<UserMathRow>((p) => ({
    user_id: p.id,
    display_name: p.display_name,
    expenses_paid: 0,
    share_of_expenses: 0,
    settlement_sent: 0,
    settlement_received: 0,
    paid: 0,
    owed: 0,
    net: 0
  }));
  const usersById = new Map(users.map((u) => [u.user_id, u]));

  for (const e of expenses) {
    const u = usersById.get(e.paid_by_user_id);
    if (u) u.expenses_paid += Number(e.total_amount);
  }
  for (const s of splits) {
    const u = usersById.get(s.user_id);
    if (u) u.share_of_expenses += Number(s.calculated_amount);
  }
  for (const pay of payments) {
    const r = resultById.get(pay.settlement_batch_result_id);
    if (!r) continue;
    const from = usersById.get(r.from_user_id);
    const to = usersById.get(r.to_user_id);
    if (from) from.settlement_sent += Number(pay.amount);
    if (to) to.settlement_received += Number(pay.amount);
  }
  for (const u of users) {
    u.paid = R(u.expenses_paid + u.settlement_sent);
    u.owed = R(u.share_of_expenses + u.settlement_received);
    u.net = R(u.paid - u.owed);
    u.expenses_paid = R(u.expenses_paid);
    u.share_of_expenses = R(u.share_of_expenses);
    u.settlement_sent = R(u.settlement_sent);
    u.settlement_received = R(u.settlement_received);
  }

  // Per-batch cross-check: do the recorded payments for each batch match the
  // amount_paid the results claim? A mismatch means a batch's status was
  // flipped without inserting the underlying payment rows.
  const resultsByBatch = new Map<string, SettlementBatchResult[]>();
  for (const r of batchResults) {
    if (!resultsByBatch.has(r.settlement_batch_id)) resultsByBatch.set(r.settlement_batch_id, []);
    resultsByBatch.get(r.settlement_batch_id)!.push(r);
  }
  const paymentsByResult = new Map<string, SettlementPayment[]>();
  for (const p of payments) {
    if (!paymentsByResult.has(p.settlement_batch_result_id))
      paymentsByResult.set(p.settlement_batch_result_id, []);
    paymentsByResult.get(p.settlement_batch_result_id)!.push(p);
  }

  const batches_by_status: Record<string, number> = {};
  const batch_payment_mismatches: BatchPaymentCheck[] = [];
  for (const b of batches) {
    batches_by_status[b.status] = (batches_by_status[b.status] ?? 0) + 1;
    const rs = resultsByBatch.get(b.id) ?? [];
    const claimed = rs.reduce((a, r) => a + Number(r.amount_paid), 0);
    let recorded = 0;
    for (const r of rs) {
      const pays = paymentsByResult.get(r.id) ?? [];
      recorded += pays.reduce((a, p) => a + Number(p.amount), 0);
    }
    const diff = R(claimed - recorded);
    if (Math.abs(diff) > 0.01) {
      batch_payment_mismatches.push({
        id: b.id,
        settlement_number: b.settlement_number,
        status: b.status,
        claimed_paid: R(claimed),
        recorded_paid: R(recorded),
        discrepancy: diff
      });
    }
  }

  // Household rollups.
  const sum_paid = R(users.reduce((a, u) => a + u.paid, 0));
  const sum_share = R(users.reduce((a, u) => a + u.owed, 0));
  const sum_net = R(users.reduce((a, u) => a + u.net, 0));
  const expenses_total = R(expenses.reduce((a, e) => a + Number(e.total_amount), 0));
  const settlement_payments_total = R(payments.reduce((a, p) => a + Number(p.amount), 0));

  // "Stripping settlement payments" delta — the reviewer's quick-test.
  // Impact = net_with − net_without = settlement_sent − settlement_received.
  const settlement_impact = users.map((u) => ({
    user_id: u.user_id,
    display_name: u.display_name,
    delta: R(u.settlement_sent - u.settlement_received)
  }));

  return {
    users,
    expenses_total,
    settlement_payments_total,
    sum_paid,
    sum_share,
    sum_net,
    batches_by_status,
    batch_payment_mismatches,
    settlement_impact
  };
}
