import Link from "next/link";
import { notFound } from "next/navigation";
import { getObligationDetail } from "@/lib/queries";
import { toCentavos, formatMoney } from "@/lib/money";
import { Card, CardBody, MoneyText, ProgressBar, Badge } from "@/components/ui/primitives";
import { DirectionPill, PaymentStatusBadge, CoverageBadge } from "@/components/ui/status";
import { PaymentScheduleTable } from "@/components/payment-schedule-table";
import { RecordPayment } from "@/components/record-payment";
import { ReviewPayment } from "@/components/review-payment";
import { fmtDate, methodLabel } from "@/lib/format";
import { ChevronLeft, FileText, Link2 } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function ObligationDetailPage({ params }: { params: { id: string } }) {
  const { obligation, ledger, installments, payments, links } = await getObligationDetail(params.id);
  if (!obligation || !ledger) notFound();

  const incoming = obligation.direction === "owed_to_me";
  const tone = incoming ? "incoming" : "outgoing";
  const currency = obligation.currency_code;
  const progress = parseFloat(ledger.progress_pct || "0");

  return (
    <>
      <Link href="/obligations" className="inline-flex items-center gap-1 text-sm text-subtle hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> All obligations
      </Link>

      {/* Header */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{obligation.name}</h1>
                <DirectionPill direction={obligation.direction} />
              </div>
              <p className="text-sm text-subtle">{obligation.counterparty_name}</p>
            </div>
            <Badge tone={obligation.status === "completed" ? "success" : "neutral"}>{obligation.status}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Original" c={toCentavos(ledger.scheduled_total)} currency={currency} />
            <Stat label="Paid" c={toCentavos(ledger.paid_total)} currency={currency} tone="incoming" />
            <Stat label="Remaining" c={toCentavos(ledger.remaining)} currency={currency} tone={tone} />
            <Stat label="Overdue" c={toCentavos(ledger.overdue_amount)} currency={currency} tone="danger" />
          </div>

          <div>
            <ProgressBar pct={progress} tone={tone} />
            <div className="mt-1 flex justify-between text-xs text-subtle">
              <span>{progress}% paid</span>
              {ledger.next_due_date && (
                <span>
                  Next: {formatMoney(toCentavos(ledger.next_due_amount ?? "0"), currency)} on {fmtDate(ledger.next_due_date)}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <RecordPayment obligationId={obligation.id} currency={currency} installments={installments} />
            <Link
              href={`/invoices/new?obligation=${obligation.id}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-sm font-medium hover:bg-canvas"
            >
              <FileText className="h-4 w-4" /> Send invoice
            </Link>
            <Link
              href="/links"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-sm font-medium hover:bg-canvas"
            >
              <Link2 className="h-4 w-4" /> Link obligation
            </Link>
          </div>
        </CardBody>
      </Card>

      {/* Linked coverage */}
      {links.length > 0 && (
        <Card>
          <CardBody className="space-y-2">
            <h2 className="text-sm font-semibold">Linked obligations</h2>
            {links.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{l.source_counterparty || l.source_name}</span>
                  <span className="text-subtle"> funds </span>
                  <span className="font-medium">{l.target_counterparty || l.target_name}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums text-subtle">
                    {formatMoney(toCentavos(l.incoming_expected))} / {formatMoney(toCentavos(l.outgoing_due))}
                  </span>
                  <span className="font-semibold">{l.coverage_pct ? `${l.coverage_pct}%` : "—"}</span>
                  <CoverageBadge status={l.coverage_status} />
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Schedule */}
      <Card>
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold">Payment schedule</h2>
          <PaymentScheduleTable installments={installments} currency={currency} />
        </CardBody>
      </Card>

      {/* Payment history */}
      <Card>
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold">Payment history</h2>
          {payments.length === 0 ? (
            <p className="text-sm text-subtle">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <MoneyText c={toCentavos(p.amount)} tone={tone} className="text-sm font-semibold" />
                      <PaymentStatusBadge status={p.status} />
                      {p.submitted_by === "external" && <Badge tone="neutral">Submitted</Badge>}
                    </div>
                    <div className="text-xs text-subtle">
                      {methodLabel[p.method]} · {fmtDate(p.paid_at)}
                      {p.reference ? ` · ${p.reference}` : ""}
                      {p.submitter_name ? ` · ${p.submitter_name}` : ""}
                      {p.rejection_reason ? ` · Rejected: ${p.rejection_reason}` : ""}
                    </div>
                  </div>
                  {p.status === "pending" && <ReviewPayment paymentId={p.id} />}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}

function Stat({
  label,
  c,
  currency,
  tone,
}: {
  label: string;
  c: number;
  currency: string;
  tone?: "incoming" | "outgoing" | "danger";
}) {
  const toneClass = tone
    ? { incoming: "text-incoming", outgoing: "text-outgoing", danger: "text-danger" }[tone]
    : "text-ink";
  return (
    <div>
      <div className="text-xs text-subtle">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${toneClass}`}>{formatMoney(c, currency)}</div>
    </div>
  );
}
