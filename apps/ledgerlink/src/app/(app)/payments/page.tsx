import Link from "next/link";
import { listPayments } from "@/lib/queries";
import { toCentavos } from "@/lib/money";
import { Card, CardBody, PageHeader, MoneyText, EmptyState, Badge } from "@/components/ui/primitives";
import { PaymentStatusBadge } from "@/components/ui/status";
import { ReviewPayment } from "@/components/review-payment";
import { fmtDate, methodLabel } from "@/lib/format";
import { Wallet } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const [pending, all] = await Promise.all([listPayments("pending"), listPayments()]);
  const reviewed = all.filter((p) => p.status !== "pending");

  return (
    <>
      <PageHeader title="Payments" subtitle="Review submitted proofs and see every recorded payment." />

      <Card>
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold">
            Awaiting your review {pending.length > 0 && <Badge tone="warn">{pending.length}</Badge>}
          </h2>
          {pending.length === 0 ? (
            <p className="text-sm text-subtle">No payment proofs waiting.</p>
          ) : (
            <ul className="divide-y divide-line">
              {pending.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <MoneyText c={toCentavos(p.amount)} className="text-sm font-semibold" />
                      <PaymentStatusBadge status={p.status} />
                    </div>
                    <div className="text-xs text-subtle">
                      {p.submitter_name ?? "External"} · {p.obligation?.name ?? "—"} · {methodLabel[p.method]} ·{" "}
                      {fmtDate(p.paid_at)}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </div>
                  </div>
                  <ReviewPayment paymentId={p.id} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold">History</h2>
          {reviewed.length === 0 ? (
            <EmptyState title="No payments yet" description="Recorded and reviewed payments will show up here." icon={<Wallet className="h-8 w-8" />} />
          ) : (
            <ul className="divide-y divide-line">
              {reviewed.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <MoneyText
                        c={toCentavos(p.amount)}
                        tone={p.direction === "owed_to_me" ? "incoming" : "outgoing"}
                        className="text-sm font-semibold"
                      />
                      <PaymentStatusBadge status={p.status} />
                    </div>
                    <div className="text-xs text-subtle">
                      {p.obligation ? (
                        <Link href={`/obligations/${p.obligation_id}`} className="hover:text-ink">
                          {p.obligation.name}
                        </Link>
                      ) : (
                        "—"
                      )}{" "}
                      · {methodLabel[p.method]} · {fmtDate(p.paid_at)}
                      {p.rejection_reason ? ` · Rejected: ${p.rejection_reason}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
