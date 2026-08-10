import { format, isValid, parseISO } from "date-fns";
import type {
  Direction,
  InstallmentStatus,
  InvoiceStatus,
  PaymentStatus,
  PaymentMethod,
  CoverageStatus,
} from "./types";

export function fmtDate(d: string | Date | null | undefined, pattern = "MMM d, yyyy"): string {
  if (!d) return "—";
  const date = typeof d === "string" ? parseISO(d) : d;
  return isValid(date) ? format(date, pattern) : "—";
}

export const directionLabel: Record<Direction, string> = {
  owed_to_me: "Owed to me",
  i_owe: "I owe",
};

export const methodLabel: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  gcash: "GCash",
  maya: "Maya",
  credit_card: "Credit card",
  debit_card: "Debit card",
  check: "Check",
  other: "Other",
};

export const installmentStatusLabel: Record<InstallmentStatus, string> = {
  upcoming: "Upcoming",
  due: "Due",
  partial: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  waived: "Waived",
  cancelled: "Cancelled",
};

export const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export const coverageLabel: Record<CoverageStatus, string> = {
  covered: "Covered",
  partially_covered: "Partially covered",
  underfunded: "Underfunded",
};

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}
