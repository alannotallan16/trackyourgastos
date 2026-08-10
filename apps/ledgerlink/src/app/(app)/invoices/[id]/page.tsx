import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvoiceById } from "@/lib/queries";
import { toCentavos, formatMoney } from "@/lib/money";
import { Card, CardBody, Badge } from "@/components/ui/primitives";
import { InvoiceStatusBadge } from "@/components/ui/status";
import { CopyLink } from "@/components/copy-link";
import { cancelInvoiceAction } from "../../actions";
import { SubmitButton } from "@/components/ui/form";
import { fmtDate } from "@/lib/format";
import { APP_URL } from "@/lib/env";
import { ChevronLeft } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const inv = await getInvoiceById(params.id);
  if (!inv) notFound();
  const url = `${APP_URL}/i/${inv.public_token}`;

  return (
    <>
      <Link href="/invoices" className="inline-flex items-center gap-1 text-sm text-subtle hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> All invoices
      </Link>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{inv.number}</h1>
                <InvoiceStatusBadge status={inv.status} />
              </div>
              <p className="text-sm text-subtle">{inv.title}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-subtle">Amount due</div>
              <div className="text-2xl font-semibold tabular-nums">{formatMoney(toCentavos(inv.amount), inv.currency_code)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <div className="text-xs text-subtle">Bill to</div>
              <div className="font-medium">{inv.contact?.name ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-subtle">Due date</div>
              <div className="font-medium">{fmtDate(inv.due_date)}</div>
            </div>
            <div>
              <div className="text-xs text-subtle">Obligation</div>
              <div className="font-medium">{inv.obligation?.name ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-subtle">Viewed</div>
              <div className="font-medium">{inv.viewed_at ? fmtDate(inv.viewed_at) : "Not yet"}</div>
            </div>
          </div>

          {inv.notes && <p className="rounded-xl bg-canvas px-3 py-2 text-sm text-subtle">{inv.notes}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Shareable payment link</h2>
            <Badge tone="neutral">No account needed</Badge>
          </div>
          <p className="text-sm text-subtle">
            Anyone with this link can view the invoice, submit a payment, and upload proof. Submissions arrive as
            pending until you approve them.
          </p>
          <CopyLink url={url} />
          {inv.status !== "cancelled" && inv.status !== "paid" && (
            <form action={cancelInvoiceAction} className="pt-1">
              <input type="hidden" name="invoice_id" value={inv.id} />
              <SubmitButton variant="secondary" pendingText="Cancelling…">Cancel invoice</SubmitButton>
            </form>
          )}
        </CardBody>
      </Card>
    </>
  );
}
