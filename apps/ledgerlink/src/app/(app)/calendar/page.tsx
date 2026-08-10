import Link from "next/link";
import { listInstallmentsInRange } from "@/lib/queries";
import { toCentavos, formatMoney } from "@/lib/money";
import { Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/ui";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: { m?: string } }) {
  const base = searchParams.m ? parseISO(`${searchParams.m}-01`) : new Date();
  const mStart = startOfMonth(base);
  const mEnd = endOfMonth(base);
  const gridStart = startOfWeek(mStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(mEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const rows = await listInstallmentsInRange(gridStart, gridEnd);
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.due_date;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(r);
  }

  const prev = format(addMonths(base, -1), "yyyy-MM");
  const next = format(addMonths(base, 1), "yyyy-MM");

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Green = money in · indigo = money out."
        action={
          <div className="flex items-center gap-1">
            <Link href={`/calendar?m=${prev}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line hover:bg-canvas">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="min-w-[9rem] text-center text-sm font-medium">{format(base, "MMMM yyyy")}</span>
            <Link href={`/calendar?m=${next}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line hover:bg-canvas">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <Card>
        <CardBody className="p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-subtle">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const items = byDay.get(key) ?? [];
              const inMonth = isSameMonth(day, base);
              const today = isSameDay(day, new Date());
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-[76px] rounded-lg border p-1 text-left",
                    inMonth ? "border-line bg-white" : "border-transparent bg-canvas/50 text-subtle",
                  )}
                >
                  <div className={cn("mb-1 text-[11px]", today && "inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white")}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {items.slice(0, 3).map((r) => {
                      const incoming = r.obligation.direction === "owed_to_me";
                      return (
                        <Link
                          key={r.id}
                          href={`/obligations/${r.obligation_id}`}
                          className={cn(
                            "block truncate rounded px-1 py-0.5 text-[10px] font-medium",
                            incoming ? "bg-incoming-soft text-incoming" : "bg-outgoing-soft text-outgoing",
                          )}
                          title={`${r.obligation.name} · ${formatMoney(toCentavos(r.remaining))}`}
                        >
                          {formatMoney(toCentavos(r.total_due))}
                        </Link>
                      );
                    })}
                    {items.length > 3 && <div className="px-1 text-[10px] text-subtle">+{items.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </>
  );
}
