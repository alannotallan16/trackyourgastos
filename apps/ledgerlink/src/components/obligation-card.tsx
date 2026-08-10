import Link from "next/link";
import { Card, CardBody, MoneyText, ProgressBar } from "@/components/ui/primitives";
import { DirectionPill } from "@/components/ui/status";
import { toCentavos } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import type { ObligationLedger } from "@/lib/types";
import { AlertTriangle } from "@/components/ui/icons";

export function ObligationCard({ o }: { o: ObligationLedger }) {
  const incoming = o.direction === "owed_to_me";
  const remaining = toCentavos(o.remaining);
  const overdue = toCentavos(o.overdue_amount);
  const progress = parseFloat(o.progress_pct || "0");
  return (
    <Link href={`/obligations/${o.id}`}>
      <Card className="transition-shadow hover:shadow-pop">
        <CardBody className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-medium">{o.name}</div>
              <div className="truncate text-sm text-subtle">{o.counterparty_name}</div>
            </div>
            <DirectionPill direction={o.direction} />
          </div>

          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-subtle">Remaining</div>
              <MoneyText c={remaining} tone={incoming ? "incoming" : "outgoing"} className="text-lg font-semibold" />
            </div>
            {overdue > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
                <AlertTriangle className="h-3.5 w-3.5" /> {overdue > 0 ? "Overdue" : ""}
              </span>
            )}
          </div>

          <div>
            <ProgressBar pct={progress} tone={incoming ? "incoming" : "outgoing"} />
            <div className="mt-1 flex justify-between text-xs text-subtle">
              <span>{progress}% paid</span>
              <span>{o.next_due_date ? `Next: ${fmtDate(o.next_due_date)}` : o.status}</span>
            </div>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
