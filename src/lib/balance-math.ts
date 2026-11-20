import type {
  Expense,
  ExpenseSplit,
  Profile,
  SettlementBatch,
  SettlementBatchItem,
  SettlementBatchResult,
  SettlementPayment
} from "./types";
import { computeBalances, settlementSuggestions } from "./balances";

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
  // Unsettled-expense effect: restricted to expenses where EVERY split is
  // still 'unpaid'. Mixed-status expenses (some settled, some unpaid) are
  // excluded — see mixed_status_expenses_count on the report.
  unsettled_paid: number;
  unsettled_share: number;
  unsettled_net: number;
}

export interface BatchPaymentCheck {
  id: string;
  settlement_number: string;
  status: string;
  claimed_paid: number; // Σ settlement_batch_results.amount_paid for this batch
  recorded_paid: number; // Σ settlement_payments.amount for this batch's results
  discrepancy: number; // claimed - recorded
}

export interface BatchRecomputeIssue {
  id: string;
  settlement_number: string;
  kind:
    | "amount_mismatch"
    | "missing_result"
    | "extra_result"
    | "no_items";
  note: string;
}

export interface BatchRecomputeRow {
  id: string;
  settlement_number: string;
  status: string;
  stored_results: { from_user_id: string; to_user_id: string; amount: number }[];
  expected_results: { from_user_id: string; to_user_id: string; amount: number }[];
  issues: BatchRecomputeIssue[];
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
  // Write-side check: does each batch's stored settlement_batch_results match
  // what createSettlementBatch would generate from its items today? If a
  // batch's items / expenses are internally consistent but the results don't
  // match, the batch was created with buggy code or edited by hand.
  batch_recompute_issues: BatchRecomputeRow[];
  // Unsettled-expense breakdown: for each person, how much do expenses whose
  // every split is still `unpaid` shift their position? Sum across users must
  // be zero (expenses redistribute money inside the household). Mixed-status
  // expenses are excluded; their count is reported separately.
  unsettled_sum_net: number;
  mixed_status_expenses_count: number;
}

const R = (n: number) => Math.round(n * 100) / 100;

export function auditBalanceMath(
  profiles: Profile[],
  expenses: Expense[],
  splits: ExpenseSplit[],
  batches: SettlementBatch[],
  batchResults: SettlementBatchResult[],
  payments: SettlementPayment[],
  batchItems: SettlementBatchItem[] = []
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
    net: 0,
    unsettled_paid: 0,
    unsettled_share: 0,
    unsettled_net: 0
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

  // ---------------------------------------------------------------------------
  // Unsettled-expense breakdown. For each expense with EVERY split still
  // `unpaid`, add payer.unsettled_paid += expense.total and each split's
  // user.unsettled_share += split.calculated_amount. Mixed-status expenses
  // are excluded, but we count them so the audit can report the exclusion.
  // ---------------------------------------------------------------------------
  const splitsByExpense = new Map<string, ExpenseSplit[]>();
  for (const s of splits) {
    if (!splitsByExpense.has(s.expense_id)) splitsByExpense.set(s.expense_id, []);
    splitsByExpense.get(s.expense_id)!.push(s);
  }
  let mixed_status_expenses_count = 0;
  for (const e of expenses) {
    const es = splitsByExpense.get(e.id) ?? [];
    if (es.length === 0) continue;
    const allUnpaid = es.every((s) => s.settlement_status === "unpaid");
    const allSameStatus = es.every((s) => s.settlement_status === es[0].settlement_status);
    if (!allSameStatus) {
      mixed_status_expenses_count += 1;
      continue;
    }
    if (!allUnpaid) continue;
    const payer = usersById.get(e.paid_by_user_id);
    if (payer) payer.unsettled_paid += Number(e.total_amount);
    for (const s of es) {
      const u = usersById.get(s.user_id);
      if (u) u.unsettled_share += Number(s.calculated_amount);
    }
  }
  for (const u of users) {
    u.unsettled_paid = R(u.unsettled_paid);
    u.unsettled_share = R(u.unsettled_share);
    u.unsettled_net = R(u.unsettled_paid - u.unsettled_share);
  }
  const unsettled_sum_net = R(users.reduce((a, u) => a + u.unsettled_net, 0));

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

  // --------------------------------------------------------------------------
  // Batch recompute: for each batch, derive the expected settlement_batch_results
  // from its items (which are a snapshot of the expense_splits at batch
  // creation time) and compare to what's stored. The reviewer's write-side
  // check.
  //
  // We rely on the items already being snapshotted — that's the point of the
  // settlement_batch_items table — so we don't go back to `splits` for this.
  // Items carry (expense_id, user_id, share_amount). We look up each expense's
  // total_amount + paid_by_user_id to compute paid vs. share per user inside
  // the batch's expense subset, then run the same greedy matcher
  // createSettlementBatch uses.
  // --------------------------------------------------------------------------
  const expensesById = new Map(expenses.map((e) => [e.id, e]));
  const itemsByBatch = new Map<string, SettlementBatchItem[]>();
  for (const it of batchItems) {
    if (!itemsByBatch.has(it.settlement_batch_id)) itemsByBatch.set(it.settlement_batch_id, []);
    itemsByBatch.get(it.settlement_batch_id)!.push(it);
  }

  const batch_recompute_issues: BatchRecomputeRow[] = [];
  for (const b of batches) {
    if (b.status === "cancelled") continue;
    const items = itemsByBatch.get(b.id) ?? [];
    const stored = (resultsByBatch.get(b.id) ?? []).map((r) => ({
      from_user_id: r.from_user_id,
      to_user_id: r.to_user_id,
      amount: Number(r.amount)
    }));

    if (items.length === 0) {
      // Unknown — can't recompute. Report once so it's visible.
      batch_recompute_issues.push({
        id: b.id,
        settlement_number: b.settlement_number,
        status: b.status,
        stored_results: stored,
        expected_results: [],
        issues: [
          {
            id: b.id,
            settlement_number: b.settlement_number,
            kind: "no_items",
            note: "Batch has no items snapshot; can't recompute expected results."
          }
        ]
      });
      continue;
    }

    // Build the per-user paid / owed inside this batch's expense subset.
    const expenseIds = Array.from(new Set(items.map((i) => i.expense_id)));
    const batchExpenses = expenseIds
      .map((eid) => expensesById.get(eid))
      .filter((x): x is Expense => !!x);
    const batchSplits: ExpenseSplit[] = items.map((it) => ({
      id: `virt-${it.id}`,
      expense_id: it.expense_id,
      user_id: it.user_id,
      split_type: "fixed",
      percentage: null,
      fixed_amount: null,
      calculated_amount: Number(it.share_amount),
      settlement_status: "in_settlement",
      settlement_batch_id: b.id,
      settled_at: null
    }));
    const balances = computeBalances(profiles, batchExpenses, batchSplits, [], []);
    const expected = settlementSuggestions(balances).map((s) => ({
      from_user_id: s.from_user_id,
      to_user_id: s.to_user_id,
      amount: R(s.amount)
    }));

    // Compare stored vs expected. Simple pair-based keying.
    const key = (r: { from_user_id: string; to_user_id: string }) =>
      `${r.from_user_id}→${r.to_user_id}`;
    const storedByKey = new Map(stored.map((r) => [key(r), r]));
    const expectedByKey = new Map(expected.map((r) => [key(r), r]));

    const issues: BatchRecomputeIssue[] = [];
    for (const [k, e] of expectedByKey) {
      const s = storedByKey.get(k);
      if (!s) {
        issues.push({
          id: b.id,
          settlement_number: b.settlement_number,
          kind: "missing_result",
          note: `Expected a ${k} result for ${formatPeso(e.amount)}; none stored.`
        });
      } else if (Math.abs(s.amount - e.amount) > 0.01) {
        issues.push({
          id: b.id,
          settlement_number: b.settlement_number,
          kind: "amount_mismatch",
          note: `${k}: stored ${formatPeso(s.amount)} vs expected ${formatPeso(e.amount)}.`
        });
      }
    }
    for (const [k, s] of storedByKey) {
      if (!expectedByKey.has(k)) {
        issues.push({
          id: b.id,
          settlement_number: b.settlement_number,
          kind: "extra_result",
          note: `Stored a ${k} result for ${formatPeso(s.amount)}; no matching expected row.`
        });
      }
    }

    if (issues.length > 0) {
      batch_recompute_issues.push({
        id: b.id,
        settlement_number: b.settlement_number,
        status: b.status,
        stored_results: stored,
        expected_results: expected,
        issues
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
    settlement_impact,
    batch_recompute_issues,
    unsettled_sum_net,
    mixed_status_expenses_count
  };
}

function formatPeso(n: number): string {
  return `₱${n.toFixed(2)}`;
}
