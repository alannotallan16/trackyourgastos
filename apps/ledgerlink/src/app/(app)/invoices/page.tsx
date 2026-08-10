import Link from "next/link";
import { listInvoices } from "@/lib/queries";
import { toCentavos } from "@/lib/money";
import { Card, CardBody, PageHeader, MoneyText, EmptyState } from "@/components/ui/primitives";
import { InvoiceStatusBadge } from "@/components/ui/status";
import { fmtDate } from "@/lib/format";
import { FileText } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const invoices = await listInvoices();
  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Request payment from people who owe you — share a secure link, no account needed."
        action={
          <Link href="/invoices/new" className="inline-flex h-10 items-center rounded-xl bg-ink px-4 text-sm font-medium text-white">
            New invoice
          </Link>
        }
      />
      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Create a payment request and share the link with a debtor."
          icon={<FileText className="h-8 w-8" />}
          action={
            <Link href="/invoices/new" className="inline-flex h-10 items-center rounded-xl bg-ink px-4 text-sm font-medium text-white">
              New invoice
            </Link>
          }
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {invoices.map((inv) => (
                <li key={inv.id}>
                  <Link href={`/invoices/${inv.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-canvas sm:px-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{inv.number}</span>
                        <InvoiceStatusBadge status={inv.status} />
                      </div>
                      <div className="truncate text-xs text-subtle">
                        {inv.contact?.name ?? "—"} · {inv.title} · due {fmtDate(inv.due_date)}
                      </div>
                    </div>
                    <MoneyText c={toCentavos(inv.amount)} className="text-sm font-semibold" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </>
  );
}
