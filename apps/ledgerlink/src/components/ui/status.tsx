"use client";
import { Badge } from "./primitives";
import {
  installmentStatusLabel,
  invoiceStatusLabel,
  paymentStatusLabel,
  coverageLabel,
  directionLabel,
} from "@/lib/format";
import type {
  InstallmentStatus,
  InvoiceStatus,
  PaymentStatus,
  CoverageStatus,
  Direction,
} from "@/lib/types";
import { ArrowDownLeft, ArrowUpRight } from "./icons";

export function InstallmentStatusBadge({ status }: { status: InstallmentStatus }) {
  const tone = (
    {
      paid: "success",
      partial: "warn",
      due: "warn",
      overdue: "danger",
      upcoming: "neutral",
      waived: "neutral",
      cancelled: "neutral",
    } as const
  )[status];
  return <Badge tone={tone}>{installmentStatusLabel[status]}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const tone = (
    {
      paid: "success",
      partially_paid: "warn",
      sent: "neutral",
      viewed: "outgoing",
      draft: "neutral",
      overdue: "danger",
      cancelled: "neutral",
      disputed: "danger",
    } as const
  )[status];
  return <Badge tone={tone}>{invoiceStatusLabel[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const tone = ({ approved: "success", pending: "warn", rejected: "danger" } as const)[status];
  return <Badge tone={tone}>{paymentStatusLabel[status]}</Badge>;
}

export function CoverageBadge({ status }: { status: CoverageStatus }) {
  const tone = (
    { covered: "success", partially_covered: "warn", underfunded: "danger" } as const
  )[status];
  return <Badge tone={tone}>{coverageLabel[status]}</Badge>;
}

/** Direction pill — never relies on color alone (icon + label). */
export function DirectionPill({ direction }: { direction: Direction }) {
  if (direction === "owed_to_me") {
    return (
      <Badge tone="incoming">
        <ArrowDownLeft className="h-3 w-3" /> {directionLabel.owed_to_me}
      </Badge>
    );
  }
  return (
    <Badge tone="outgoing">
      <ArrowUpRight className="h-3 w-3" /> {directionLabel.i_owe}
    </Badge>
  );
}
