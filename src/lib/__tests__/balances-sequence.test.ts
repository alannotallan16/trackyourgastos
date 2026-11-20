import { describe, expect, it } from "vitest";
import { computeBalances } from "@/lib/balances";
import type {
  Expense,
  ExpenseSplit,
  Profile,
  SettlementBatchResult,
  SettlementPayment
} from "@/lib/types";

/**
 * Row-by-row payment sequence test.
 *
 * Starting nets from live production state (the installment plan the household
 * is working through):
 *
 *   Alan     +₱1,002.41
 *   Mari Cel −₱55,984.66
 *   Mari Len +₱54,982.25
 *
 * Executing the four row-by-row payments in sequence:
 *
 *   1. Alan → Len   ₱15,000.00   (ST-0011 Alan→Len)
 *   2. Len  → Alan  ₱8,238.68    (ST-0014 Len→Alan)
 *   3. Cel  → Len   ₱48,220.93   (across ST-0011 Cel→Len installments)
 *   4. Cel  → Alan  ₱7,763.73    (ST-0014 Cel→Alan)
 *
 * Should leave every user's net at exactly 0.
 *
 * To seed those exact starting nets with the real computeBalances function,
 * we mint one expense per non-zero signed position: each expense is paid by
 * the eventual creditor and split equally between the two debtors.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // Alan
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // Mari Cel
const L = "llllllll-llll-llll-llll-llllllllllll"; // Mari Len

const PROFILES: Profile[] = [
  { id: A, display_name: "Alan", short_name: "A", avatar_url: null },
  { id: C, display_name: "Mari Cel", short_name: "C", avatar_url: null },
  { id: L, display_name: "Mari Len", short_name: "L", avatar_url: null }
];

/** Build an expense + splits that give `payer` a +total to its net and each
 *  entry in `shares` a -amount to theirs. */
function seedExpense(
  idSuffix: string,
  payer: string,
  shares: { user_id: string; amount: number }[]
): { expense: Expense; splits: ExpenseSplit[] } {
  const total = Math.round(shares.reduce((a, s) => a + s.amount, 0) * 100) / 100;
  const expense: Expense = {
    id: `exp-${idSuffix}`,
    expense_date: "2026-01-01",
    merchant: `seed-${idSuffix}`,
    total_amount: total,
    currency: "PHP",
    exchange_rate: null,
    category_id: null,
    paid_by_user_id: payer,
    split_preset_id: null,
    notes: null,
    receipt_file_id: null,
    recurring_expense_id: null,
    created_by: payer,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z"
  };
  const splits: ExpenseSplit[] = shares.map((s, i) => ({
    id: `split-${idSuffix}-${i}`,
    expense_id: expense.id,
    user_id: s.user_id,
    split_type: "fixed",
    percentage: null,
    fixed_amount: s.amount,
    calculated_amount: s.amount,
    settlement_status: "unpaid",
    settlement_batch_id: null,
    settled_at: null
  }));
  return { expense, splits };
}

/**
 * Mint a fully-populated SettlementBatchResult + its matching settlement_payment
 * for a single `from → to amount` transfer. Each payment stands on its own row
 * (not a real batch), which is fine for computeBalances — it only looks at the
 * result's from_user_id / to_user_id when attributing payments.
 */
function pay(
  idSuffix: string,
  from: string,
  to: string,
  amount: number
): { result: SettlementBatchResult; payment: SettlementPayment } {
  const result: SettlementBatchResult = {
    id: `res-${idSuffix}`,
    settlement_batch_id: `batch-${idSuffix}`,
    from_user_id: from,
    to_user_id: to,
    amount,
    amount_paid: amount,
    remaining_amount: 0,
    reconciled_amount: 0,
    currency: "PHP",
    status: "paid",
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z"
  };
  const payment: SettlementPayment = {
    id: `pay-${idSuffix}`,
    settlement_batch_result_id: result.id,
    payment_date: "2026-11-01",
    amount,
    currency: "PHP",
    payment_method: "Bank transfer",
    notes: null,
    reference_number: null,
    attachment_path: null,
    created_by: from,
    created_at: "2026-11-01T00:00:00Z"
  };
  return { result, payment };
}

function netOf(balances: ReturnType<typeof computeBalances>, uid: string) {
  const b = balances.find((x) => x.user_id === uid);
  if (!b) throw new Error(`no balance for ${uid}`);
  return b.net;
}

describe("row-by-row payment sequence lands at zero via real computeBalances", () => {
  // Seed starting nets:
  //   Len creditor for 54,982.25 — split equally between Alan and Cel:
  //     each owes Len 27,491.125 → gives Len +54,982.25, Alan/Cel each -27,491.125
  //   Alan creditor for 1,002.41 — split equally between Cel and Len:
  //     each owes Alan 501.205 → Alan +1,002.41, Cel -501.205, Len -501.205
  //
  // Running net after both seeds (should match reality):
  //   Alan: +1,002.41 - 27,491.125 = -26,488.715   (hmm, not +1,002.41)
  //
  // That approach doesn't land on the target. Simpler: one expense per debtor
  // paid by Len, with the debtor's exact share. Then one expense paid by Alan
  // for his +1,002.41 against Len.
  //
  //   exp-1: paid by Len, Cel's share = 55,984.66, Len's share = 0
  //     → Len +55,984.66, Cel -55,984.66
  //   exp-2: paid by Alan, Len's share = 1,002.41
  //     → Alan +1,002.41, Len -1,002.41
  //   Running: Alan +1,002.41, Cel -55,984.66, Len +54,982.25 ✓
  const { expense: exp1, splits: splits1 } = seedExpense("1", L, [
    { user_id: C, amount: 55_984.66 }
  ]);
  const { expense: exp2, splits: splits2 } = seedExpense("2", A, [
    { user_id: L, amount: 1_002.41 }
  ]);

  const EXPENSES = [exp1, exp2];
  const SPLITS = [...splits1, ...splits2];

  function stateAfter(payments: Array<ReturnType<typeof pay>>) {
    const results = payments.map((p) => p.result);
    const paymentRows = payments.map((p) => p.payment);
    return computeBalances(PROFILES, EXPENSES, SPLITS, paymentRows, results);
  }

  const P1 = pay("1", A, L, 15_000.0);
  const P2 = pay("2", L, A, 8_238.68);
  const P3 = pay("3", C, L, 48_220.93);
  const P4 = pay("4", C, A, 7_763.73);

  it("seed produces the exact production starting nets", () => {
    const b = stateAfter([]);
    expect(netOf(b, A)).toBeCloseTo(1_002.41, 2);
    expect(netOf(b, C)).toBeCloseTo(-55_984.66, 2);
    expect(netOf(b, L)).toBeCloseTo(54_982.25, 2);
  });

  it("step 1 — Alan → Len ₱15,000", () => {
    const b = stateAfter([P1]);
    expect(netOf(b, A)).toBeCloseTo(16_002.41, 2);
    expect(netOf(b, C)).toBeCloseTo(-55_984.66, 2);
    expect(netOf(b, L)).toBeCloseTo(39_982.25, 2);
  });

  it("step 2 — Len → Alan ₱8,238.68", () => {
    const b = stateAfter([P1, P2]);
    expect(netOf(b, A)).toBeCloseTo(7_763.73, 2);
    expect(netOf(b, C)).toBeCloseTo(-55_984.66, 2);
    expect(netOf(b, L)).toBeCloseTo(48_220.93, 2);
  });

  it("step 3 — Cel → Len ₱48,220.93", () => {
    const b = stateAfter([P1, P2, P3]);
    expect(netOf(b, A)).toBeCloseTo(7_763.73, 2);
    expect(netOf(b, C)).toBeCloseTo(-7_763.73, 2);
    expect(netOf(b, L)).toBeCloseTo(0, 2);
  });

  it("step 4 — Cel → Alan ₱7,763.73 — all nets land at exactly 0", () => {
    const b = stateAfter([P1, P2, P3, P4]);
    expect(Math.abs(netOf(b, A))).toBeLessThan(0.005);
    expect(Math.abs(netOf(b, C))).toBeLessThan(0.005);
    expect(Math.abs(netOf(b, L))).toBeLessThan(0.005);
  });

  it("order independence — swap 1↔2", () => {
    const b = stateAfter([P2, P1, P3, P4]);
    expect(Math.abs(netOf(b, A))).toBeLessThan(0.005);
    expect(Math.abs(netOf(b, C))).toBeLessThan(0.005);
    expect(Math.abs(netOf(b, L))).toBeLessThan(0.005);
  });

  it("order independence — swap 3↔4", () => {
    const b = stateAfter([P1, P2, P4, P3]);
    expect(Math.abs(netOf(b, A))).toBeLessThan(0.005);
    expect(Math.abs(netOf(b, C))).toBeLessThan(0.005);
    expect(Math.abs(netOf(b, L))).toBeLessThan(0.005);
  });
});
