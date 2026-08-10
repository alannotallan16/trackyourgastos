import { toCentavos, formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { InstallmentStatusBadge } from "@/components/ui/status";
import type { InstallmentLedger } from "@/lib/types";

export function PaymentScheduleTable({
  installments,
  currency = "PHP",
}: {
  installments: InstallmentLedger[];
  currency?: string;
}) {
  if (installments.length === 0) {
    return <p className="text-sm text-subtle">No installment schedule.</p>;
  }
  return (
    <div className="scroll-thin -mx-1 overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-subtle">
            <th className="px-2 py-2 font-medium">#</th>
            <th className="px-2 py-2 font-medium">Due date</th>
            <th className="px-2 py-2 text-right font-medium">Principal</th>
            <th className="px-2 py-2 text-right font-medium">Interest</th>
            <th className="px-2 py-2 text-right font-medium">Total</th>
            <th className="px-2 py-2 text-right font-medium">Paid</th>
            <th className="px-2 py-2 text-right font-medium">Remaining</th>
            <th className="px-2 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {installments.map((i) => (
            <tr key={i.id} className="border-b border-line/70">
              <td className="px-2 py-2 text-subtle">{i.seq}</td>
              <td className="px-2 py-2 whitespace-nowrap">{fmtDate(i.due_date)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatMoney(toCentavos(i.principal_amount), currency)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatMoney(toCentavos(i.interest_amount), currency)}</td>
              <td className="px-2 py-2 text-right font-medium tabular-nums">{formatMoney(toCentavos(i.total_due), currency)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-incoming">{formatMoney(toCentavos(i.paid), currency)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatMoney(toCentavos(i.remaining), currency)}</td>
              <td className="px-2 py-2"><InstallmentStatusBadge status={i.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
