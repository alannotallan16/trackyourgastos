import { describe, it, expect } from "vitest";
import {
  generateAmortized,
  generateFlatNoInterest,
  generateFlatFactor,
  allocatePayment,
  installmentStatus,
  computeObligation,
} from "./schedule";
import { sumCentavos } from "./money";

const P = 90416070; // ₱904,160.70 in centavos
const RATE = 0.016175; // monthly rate derived from the real UnionBank schedule

describe("amortized schedule (UnionBank EasyCash)", () => {
  const rows = generateAmortized(P, RATE, 60);

  it("produces 60 installments that reconcile per row (total = principal + interest + fees)", () => {
    expect(rows).toHaveLength(60);
    for (const r of rows) expect(r.total).toBe(r.principal + r.interest + r.fees);
  });

  it("reproduces the bank's first-installment split", () => {
    // interest_1 = balance * rate; matches the screenshot's ₱14,624.80 / ₱9,034.07
    expect(rows[0].interest).toBe(1462480); // ₱14,624.80
    expect(rows[0].principal).toBe(rows[0].total - rows[0].interest);
    expect(rows[0].total).toBe(2365887); // ₱23,658.87
    expect(rows[0].principal).toBe(903407); // ₱9,034.07
    expect(rows[1].interest).toBe(1447867); // ₱14,478.67
    expect(rows[1].principal).toBe(918020); // ₱9,180.20
  });

  it("fully amortizes: principal sums to the original and balance ends at zero", () => {
    expect(sumCentavos(rows.map((r) => r.principal))).toBe(P);
    let bal = P;
    for (const r of rows) bal -= r.principal;
    expect(bal).toBe(0);
  });
});

describe("other generators reconcile", () => {
  it("flat no-interest splits principal exactly", () => {
    const rows = generateFlatNoInterest(50000_00, 5);
    expect(sumCentavos(rows.map((r) => r.total))).toBe(5000000);
    rows.forEach((r) => expect(r.interest).toBe(0));
  });
  it("flat factor applies equal interest each period", () => {
    const rows = generateFlatFactor(1200000, 0.0095, 12);
    expect(rows.every((r) => r.interest === rows[0].interest)).toBe(true);
    rows.forEach((r) => expect(r.total).toBe(r.principal + r.interest));
  });
});

describe("payment allocation & partial payments", () => {
  it("allocates a partial payment to the oldest installment only", () => {
    const targets = [
      { id: "a", remaining: 2365887 },
      { id: "b", remaining: 2365887 },
    ];
    const { allocations, leftover } = allocatePayment(1000000, targets); // ₱10,000
    expect(leftover).toBe(0);
    expect(allocations).toEqual([{ installmentId: "a", amount: 1000000 }]);
  });

  it("spills across installments and reports leftover (overpayment)", () => {
    const targets = [
      { id: "a", remaining: 1000000 },
      { id: "b", remaining: 500000 },
    ];
    const { allocations, leftover } = allocatePayment(2000000, targets);
    expect(allocations).toEqual([
      { installmentId: "a", amount: 1000000 },
      { installmentId: "b", amount: 500000 },
    ]);
    expect(leftover).toBe(500000); // ₱5,000 unallocated
  });
});

describe("installment status (overdue / partial / paid)", () => {
  const today = new Date("2026-09-20T00:00:00");
  it("is overdue when past due + grace and not fully paid", () => {
    expect(
      installmentStatus({ totalDue: 2365887, paid: 1000000, dueDate: new Date("2026-08-15"), graceDays: 3, today }),
    ).toBe("overdue"); // partial but past due => overdue amount = remaining
  });
  it("is partial when paid > 0 and not yet due-past", () => {
    expect(
      installmentStatus({ totalDue: 2365887, paid: 1500000, dueDate: new Date("2026-09-25"), graceDays: 5, today }),
    ).toBe("partial");
  });
  it("never marks a partially paid installment as paid", () => {
    const s = installmentStatus({ totalDue: 2365887, paid: 1500000, dueDate: new Date("2026-09-15"), graceDays: 5, today });
    expect(s).not.toBe("paid");
  });
  it("is paid only when fully covered", () => {
    expect(
      installmentStatus({ totalDue: 2365887, paid: 2365887, dueDate: new Date("2026-08-15"), graceDays: 3, today }),
    ).toBe("paid");
  });
  it("is upcoming when due in the future with no payment", () => {
    expect(
      installmentStatus({ totalDue: 2365887, paid: 0, dueDate: new Date("2026-10-15"), graceDays: 3, today }),
    ).toBe("upcoming");
  });
});

describe("obligation rollup", () => {
  it("computes paid / remaining / progress and keeps overdue separate", () => {
    const res = computeObligation({
      installments: [
        { total: 2365887, paid: 2365887 },
        { total: 2365887, paid: 1500000 },
        { total: 2365887, paid: 0 },
      ],
      approvedPaidTotal: 2365887 + 1500000,
      overdue: 865887,
    });
    expect(res.scheduledTotal).toBe(2365887 * 3);
    expect(res.paidTotal).toBe(3865887);
    expect(res.remaining).toBe(2365887 * 3 - 3865887);
    expect(res.progressPct).toBeCloseTo(54.46, 1);
    expect(res.overdue).toBe(865887);
  });
});
