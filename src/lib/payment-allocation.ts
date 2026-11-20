/**
 * TEST-ONLY port of record_payment_for_pair's allocation loop.
 *
 * The SQL function in supabase/migrations/0007_close_batch.sql is the source
 * of truth. The running app never calls this file at runtime — the UI's
 * preview goes through the record_payment_for_pair RPC with preview_only=true
 * so it always matches server behavior.
 *
 * This file exists so the pair-isolation contract can be unit-tested without
 * a live Postgres. If the RPC body changes, update this port and re-run
 * Test B (src/lib/__tests__/record-payment-for-pair.test.ts).
 */

export interface AllocatableResult {
  id: string;
  settlement_batch_id: string;
  from_user_id: string;
  to_user_id: string;
  remaining_amount: number;
  status: "open" | "partially_paid" | "paid" | "reconciled";
  batch_number: string;
  batch_created_at: string;
}

export interface AllocationRow {
  result_id: string;
  batch_id: string;
  batch_number: string;
  apply_amount: number;
  was_remaining: number;
  will_leave: number;
}

export interface AllocationResult {
  amount: number;
  pair_open: number;
  allocation: AllocationRow[];
}

const R = (n: number) => Math.round(n * 100) / 100;

export function allocatePairPayment(input: {
  from_user_id: string;
  to_user_id: string;
  amount: number;
  rows: AllocatableResult[];
}): AllocationResult {
  if (!(input.amount > 0)) {
    throw new Error("Amount must be positive");
  }
  if (input.from_user_id === input.to_user_id) {
    throw new Error("Payer and payee must differ");
  }

  const pairRows = input.rows
    .filter(
      (r) =>
        r.from_user_id === input.from_user_id &&
        r.to_user_id === input.to_user_id &&
        (r.status === "open" || r.status === "partially_paid")
    )
    .sort((a, b) => {
      const c = a.batch_created_at.localeCompare(b.batch_created_at);
      return c !== 0 ? c : a.id.localeCompare(b.id);
    });

  const pair_open = R(pairRows.reduce((a, r) => a + r.remaining_amount, 0));

  if (input.amount > pair_open + 0.005) {
    const fmt = (n: number) =>
      "₱" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    throw new Error(
      `${fmt(input.amount)} is more than the ${fmt(pair_open)} open between this pair. Create a settlement first.`
    );
  }

  let remaining = input.amount;
  const allocation: AllocationRow[] = [];
  for (const r of pairRows) {
    if (remaining <= 0.005) break;
    const apply = Math.min(remaining, r.remaining_amount);
    allocation.push({
      result_id: r.id,
      batch_id: r.settlement_batch_id,
      batch_number: r.batch_number,
      apply_amount: R(apply),
      was_remaining: R(r.remaining_amount),
      will_leave: R(r.remaining_amount - apply)
    });
    remaining -= apply;
  }

  return { amount: R(input.amount), pair_open, allocation };
}
