import { listObligations } from "@/lib/queries";
import { toCentavos, fromCentavos, formatMoney } from "@/lib/money";
import { Card, CardBody, PageHeader, StatCard, EmptyState } from "@/components/ui/primitives";
import { directionLabel } from "@/lib/format";
import { ExportBar, type ReportRow } from "./export-bar";
import { BarChart3 } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const obligations = await listObligations();

  const rows: ReportRow[] = obligations.map((o) => ({
    Direction: directionLabel[o.direction],
    Name: o.name,
    Counterparty: o.counterparty_name,
    Currency: o.currency_code,
    Scheduled: fromCentavos(toCentavos(o.scheduled_total)),
    Paid: fromCentavos(toCentavos(o.paid_total)),
    Remaining: fromCentavos(toCentavos(o.remaining)),
    Overdue: fromCentavos(toCentavos(o.overdue_amount)),
    Status: o.status,
  }));

  const owedToMe = obligations.filter((o) => o.direction === "owed_to_me").reduce((a, o) => a + toCentavos(o.remaining), 0);
  const iOwe = obligations.filter((o) => o.direction === "i_owe").reduce((a, o) => a + toCentavos(o.remaining), 0);
  const overdue = obligations.reduce((a, o) => a + toCentavos(o.overdue_amount), 0);

  return (
    <>
      <PageHeader title="Reports" subtitle="Balances by obligation, exportable." action={<ExportBar rows={rows} />} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total owed to me" amount={owedToMe} tone="incoming" />
        <StatCard label="Total I owe" amount={iOwe} tone="outgoing" />
        <StatCard label="Total overdue" amount={overdue} tone="danger" />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nothing to report yet" description="Add obligations to generate reports." icon={<BarChart3 className="h-8 w-8" />} />
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-subtle">
                    <th className="px-4 py-2 font-medium">Obligation</th>
                    <th className="px-4 py-2 font-medium">Direction</th>
                    <th className="px-4 py-2 text-right font-medium">Scheduled</th>
                    <th className="px-4 py-2 text-right font-medium">Paid</th>
                    <th className="px-4 py-2 text-right font-medium">Remaining</th>
                    <th className="px-4 py-2 text-right font-medium">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {obligations.map((o) => (
                    <tr key={o.id} className="border-b border-line/70">
                      <td className="px-4 py-2">
                        <div className="font-medium">{o.name}</div>
                        <div className="text-xs text-subtle">{o.counterparty_name}</div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={o.direction === "owed_to_me" ? "text-incoming" : "text-outgoing"}>
                          {directionLabel[o.direction]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatMoney(toCentavos(o.scheduled_total), o.currency_code)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-incoming">{formatMoney(toCentavos(o.paid_total), o.currency_code)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatMoney(toCentavos(o.remaining), o.currency_code)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-danger">{formatMoney(toCentavos(o.overdue_amount), o.currency_code)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </>
  );
}
