import { describe, expect, it } from "vitest";
import { allocatePairPayment, type AllocatableResult } from "@/lib/payment-allocation";

// The SQL function in supabase/migrations/0007_close_batch.sql is the source
// of truth; this test pins the pair-isolation contract against a TS port.

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const D = "dddddddd-dddd-dddd-dddd-dddddddddddd";

const ROWS: AllocatableResult[] = [
  {
    id: "r-AB-1",
    settlement_batch_id: "batch-AB-1",
    from_user_id: A,
    to_user_id: B,
    remaining_amount: 100,
    status: "open",
    batch_number: "ST-0001",
    batch_created_at: "2026-01-01T00:00:00Z"
  },
  {
    id: "r-AB-2",
    settlement_batch_id: "batch-AB-2",
    from_user_id: A,
    to_user_id: B,
    remaining_amount: 50,
    status: "partially_paid",
    batch_number: "ST-0002",
    batch_created_at: "2026-02-01T00:00:00Z"
  },
  {
    id: "r-AC-1",
    settlement_batch_id: "batch-AC-1",
    from_user_id: A,
    to_user_id: C,
    remaining_amount: 75,
    status: "open",
    batch_number: "ST-0001",
    batch_created_at: "2026-01-01T00:00:00Z"
  },
  {
    id: "r-BA-1",
    settlement_batch_id: "batch-BA-1",
    from_user_id: B,
    to_user_id: A,
    remaining_amount: 20,
    status: "open",
    batch_number: "ST-0003",
    batch_created_at: "2026-03-01T00:00:00Z"
  },
  {
    id: "r-AB-paid",
    settlement_batch_id: "batch-AB-paid",
    from_user_id: A,
    to_user_id: B,
    remaining_amount: 0,
    status: "paid",
    batch_number: "ST-0004",
    batch_created_at: "2026-04-01T00:00:00Z"
  },
  {
    id: "r-AB-recon",
    settlement_batch_id: "batch-AB-recon",
    from_user_id: A,
    to_user_id: B,
    remaining_amount: 0,
    status: "reconciled",
    batch_number: "ST-0005",
    batch_created_at: "2026-05-01T00:00:00Z"
  }
];

describe("allocatePairPayment — pair isolation", () => {
  it("only touches rows matching the (from, to) pair, oldest-first", () => {
    const r = allocatePairPayment({ from_user_id: A, to_user_id: B, amount: 120, rows: ROWS });
    expect(r.pair_open).toBe(150);
    expect(r.allocation.map((x) => x.result_id)).toEqual(["r-AB-1", "r-AB-2"]);
    expect(r.allocation[0].apply_amount).toBe(100);
    expect(r.allocation[1].apply_amount).toBe(20);
    for (const a of r.allocation) {
      expect(a.result_id.startsWith("r-AB")).toBe(true);
      expect(a.result_id).not.toBe("r-AB-paid");
      expect(a.result_id).not.toBe("r-AB-recon");
    }
  });

  it("over-cap throws with the exact server error copy", () => {
    expect(() =>
      allocatePairPayment({ from_user_id: A, to_user_id: B, amount: 200, rows: ROWS })
    ).toThrow(/₱200\.00 is more than the ₱150\.00 open between this pair\. Create a settlement first\./);
  });

  it("empty pair throws (pair_open = 0)", () => {
    expect(() =>
      allocatePairPayment({ from_user_id: A, to_user_id: D, amount: 1, rows: ROWS })
    ).toThrow(/₱1\.00 is more than the ₱0\.00 open between this pair\./);
  });

  it("reverse pair does not borrow from forward rows", () => {
    const r = allocatePairPayment({ from_user_id: B, to_user_id: A, amount: 20, rows: ROWS });
    expect(r.pair_open).toBe(20);
    expect(r.allocation.map((x) => x.result_id)).toEqual(["r-BA-1"]);
  });

  it("rejects zero / negative amounts and same-person pairs", () => {
    expect(() =>
      allocatePairPayment({ from_user_id: A, to_user_id: B, amount: 0, rows: ROWS })
    ).toThrow(/positive/);
    expect(() =>
      allocatePairPayment({ from_user_id: A, to_user_id: A, amount: 10, rows: ROWS })
    ).toThrow(/Payer and payee/);
  });
});
