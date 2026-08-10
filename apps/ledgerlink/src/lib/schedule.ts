/**
 * Payment-schedule generation and the payment/overdue/allocation math.
 *
 * IMPORTANT: a bank's real amortization cannot always be reconstructed from the
 * advertised rate. These generators are a convenience; the canonical schedule is
 * whatever rows get stored (the user can paste/import the bank's real numbers).
 * All amounts are integer centavos (see money.ts).
 */
import { Centavos, distribute } from "./money";

export type InstallmentRow = {
  seq: number;
  principal: Centavos;
  interest: Centavos;
  fees: Centavos;
  total: Centavos;
};

export type InstallmentStatus =
  | "upcoming"
  | "due"
  | "partial"
  | "paid"
  | "overdue"
  | "waived"
  | "cancelled";

/** Even principal split, zero interest (informal loans). */
export function generateFlatNoInterest(principalC: Centavos, n: number): InstallmentRow[] {
  const parts = distribute(principalC, n);
  return parts.map((p, i) => ({ seq: i + 1, principal: p, interest: 0, fees: 0, total: p }));
}

/**
 * Flat / factor-rate: interest each period = principal * monthlyFactor (on the
 * ORIGINAL principal), principal repaid in equal parts. Matches how many PH
 * "add-on" / factor-rate consumer loans quote.
 */
export function generateFlatFactor(
  principalC: Centavos,
  monthlyFactor: number,
  n: number,
): InstallmentRow[] {
  const principalParts = distribute(principalC, n);
  const interestEach = Math.round(principalC * monthlyFactor);
  return principalParts.map((p, i) => ({
    seq: i + 1,
    principal: p,
    interest: interestEach,
    fees: 0,
    total: p + interestEach,
  }));
}

/**
 * Reducing-balance amortization with a fixed monthly rate. Interest = balance *
 * rate each period; principal = payment - interest; the final row absorbs any
 * rounding so the schedule pays the balance to exactly zero.
 */
export function generateAmortized(
  principalC: Centavos,
  monthlyRate: number,
  n: number,
): InstallmentRow[] {
  if (n <= 0) return [];
  let payment: number;
  if (monthlyRate === 0) {
    payment = Math.round(principalC / n);
  } else {
    const factor = Math.pow(1 + monthlyRate, -n);
    payment = Math.round((principalC * monthlyRate) / (1 - factor));
  }
  const rows: InstallmentRow[] = [];
  let balance = principalC;
  for (let i = 1; i <= n; i++) {
    const interest = Math.round(balance * monthlyRate);
    let principal = i === n ? balance : payment - interest;
    if (principal > balance) principal = balance;
    rows.push({ seq: i, principal, interest, fees: 0, total: principal + interest });
    balance -= principal;
  }
  return rows;
}

/** FIFO allocation of a payment across the oldest still-owed installments. */
export type Allocatable = { id: string; remaining: Centavos };
export type Allocation = { installmentId: string; amount: Centavos };

export function allocatePayment(amountC: Centavos, targets: Allocatable[]): {
  allocations: Allocation[];
  leftover: Centavos;
} {
  let left = amountC;
  const allocations: Allocation[] = [];
  for (const t of targets) {
    if (left <= 0) break;
    if (t.remaining <= 0) continue;
    const take = Math.min(left, t.remaining);
    allocations.push({ installmentId: t.id, amount: take });
    left -= take;
  }
  return { allocations, leftover: left };
}

/** Mirror of the SQL installment_ledger status logic, for tests + client display. */
export function installmentStatus(args: {
  totalDue: Centavos;
  paid: Centavos;
  dueDate: Date;
  graceDays: number;
  today: Date;
  override?: "none" | "waived" | "cancelled";
}): InstallmentStatus {
  const { totalDue, paid, dueDate, graceDays, today, override = "none" } = args;
  if (override === "waived") return "waived";
  if (override === "cancelled") return "cancelled";
  if (paid >= totalDue) return "paid";
  const graceEnd = new Date(dueDate);
  graceEnd.setDate(graceEnd.getDate() + graceDays);
  if (graceEnd < startOfDay(today)) return "overdue";
  if (paid > 0) return "partial";
  if (startOfDay(dueDate) <= startOfDay(today)) return "due";
  return "upcoming";
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Roll up an obligation from its installments + approved payments. */
export function computeObligation(args: {
  installments: { total: Centavos; paid: Centavos; overrideCancelled?: boolean }[];
  approvedPaidTotal: Centavos;
  overdue: Centavos;
}): { scheduledTotal: Centavos; paidTotal: Centavos; remaining: Centavos; progressPct: number; overdue: Centavos } {
  const scheduledTotal = args.installments
    .filter((i) => !i.overrideCancelled)
    .reduce((a, i) => a + i.total, 0);
  const paidTotal = args.approvedPaidTotal;
  const remaining = Math.max(scheduledTotal - paidTotal, 0);
  const progressPct = scheduledTotal > 0 ? Math.min(100, Math.round((paidTotal / scheduledTotal) * 10000) / 100) : 0;
  return { scheduledTotal, paidTotal, remaining, progressPct, overdue: args.overdue };
}
