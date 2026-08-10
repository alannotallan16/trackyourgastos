import Link from "next/link";
import { getDashboard } from "@/lib/queries";
import { toCentavos, formatMoney } from "@/lib/money";
import { StatCard, Card, CardBody, PageHeader, MoneyText, EmptyState, Badge } from "@/components/ui/primitives";
import { InstallmentStatusBadge, CoverageBadge, PaymentStatusBadge } from "@/components/ui/status";
import { fmtDate } from "@/lib/format";
import { seedDemoAction } from "../actions";
import { SubmitButton } from "@/components/ui/form";
import {
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Link2,
} from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const d = await getDashboard();
  const isEmpty = d.counts.owedToMe === 0 && d.counts.iOwe === 0;

  if (isEmpty) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Your money in and out, at a glance." />
        <EmptyState
          title="Nothing tracked yet"
          description="Add your first obligation, or load realistic demo data (UnionBank loan, sister repayment, invoices, and more) to explore the app."
          icon={<ArrowDownLeft className="h-8 w-8" />}
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/obligations/new"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-white"
              >
                Add an obligation
              </Link>
              <form action={seedDemoAction}>
                <SubmitButton variant="secondary" pendingText="Loading demo…">
                  Load demo data
                </SubmitButton>
              </form>
            </div>
          }
        />
      </>
    );
  }

  const surplus = d.totals.dueThisMonthIncoming - d.totals.dueThisMonthOutgoing;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your money in and out, at a glance." />

      {/* Primary balances */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Owed to me" amount={d.totals.owedToMe} tone="incoming" icon={<ArrowDownLeft className="h-4 w-4" />} hint={`${d.counts.owedToMe} active`} />
        <StatCard label="I owe" amount={d.totals.iOwe} tone="outgoing" icon={<ArrowUpRight className="h-4 w-4" />} hint={`${d.counts.iOwe} active`} />
        <StatCard label="Overdue" amount={d.totals.overdue} tone="danger" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Due this month (in)" amount={d.totals.dueThisMonthIncoming} tone="incoming" icon={<CalendarDays className="h-4 w-4" />} />
        <StatCard label="Due this month (out)" amount={d.totals.dueThisMonthOutgoing} tone="outgoing" icon={<CalendarDays className="h-4 w-4" />} />
        <StatCard label="Collected this month" amount={d.totals.collected} tone="incoming" icon={<TrendingUp className="h-4 w-4" />} hint={`Paid out ${formatMoney(d.totals.paid)}`} />
      </div>

      {/* Cash-flow insight */}
      <Card>
        <CardBody className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">This month&apos;s cash flow</div>
            <p className="text-sm text-subtle">
              Expecting <MoneyText c={d.totals.dueThisMonthIncoming} tone="incoming" /> · owing{" "}
              <MoneyText c={d.totals.dueThisMonthOutgoing} tone="outgoing" />
            </p>
          </div>
          <div className="flex items-center gap-2">
            {surplus >= 0 ? (
              <Badge tone="success">
                <TrendingUp className="h-3 w-3" /> Surplus {formatMoney(surplus)}
              </Badge>
            ) : (
              <Badge tone="danger">
                <TrendingDown className="h-3 w-3" /> Short {formatMoney(-surplus)}
              </Badge>
            )}
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Upcoming payments */}
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Upcoming & overdue</h2>
              <Link href="/calendar" className="text-xs text-subtle hover:text-ink">Calendar →</Link>
            </div>
            {d.upcoming.length === 0 ? (
              <p className="text-sm text-subtle">No scheduled payments soon.</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.upcoming.slice(0, 6).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {r.obligation.direction === "owed_to_me" ? (
                          <ArrowDownLeft className="h-4 w-4 shrink-0 text-incoming" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-outgoing" />
                        )}
                        <span className="truncate text-sm font-medium">{r.obligation.name}</span>
                      </div>
                      <div className="text-xs text-subtle">
                        #{r.seq} · due {fmtDate(r.due_date)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <MoneyText c={toCentavos(r.remaining)} tone={r.obligation.direction === "owed_to_me" ? "incoming" : "outgoing"} className="text-sm font-semibold" />
                      <InstallmentStatusBadge status={r.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Pending payment proofs */}
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Payment proofs to review</h2>
              <Link href="/payments" className="text-xs text-subtle hover:text-ink">All payments →</Link>
            </div>
            {d.pending.length === 0 ? (
              <p className="text-sm text-subtle">Nothing waiting on you.</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.pending.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.submitter_name ?? "Someone"}</div>
                      <div className="text-xs text-subtle">{p.obligation?.name ?? "—"} · {fmtDate(p.paid_at)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MoneyText c={toCentavos(p.amount)} className="text-sm font-semibold" />
                      <PaymentStatusBadge status={p.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Top counterparties */}
        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold">Who owes me the most</h2>
            <TopList items={d.topOwedToMe} tone="incoming" />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold">Who I owe the most</h2>
            <TopList items={d.topIOwe} tone="outgoing" />
          </CardBody>
        </Card>
      </div>

      {/* Coverage of linked obligations */}
      {d.links.length > 0 && (
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-subtle" />
              <h2 className="text-sm font-semibold">Linked coverage this month</h2>
            </div>
            <ul className="space-y-2">
              {d.links.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2">
                  <div className="text-sm">
                    <span className="font-medium">{l.source_counterparty || l.source_name}</span>
                    <span className="text-subtle"> funds </span>
                    <span className="font-medium">{l.target_counterparty || l.target_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums text-subtle">
                      {formatMoney(toCentavos(l.incoming_expected))} / {formatMoney(toCentavos(l.outgoing_due))}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {l.coverage_pct ? `${l.coverage_pct}%` : "—"}
                    </span>
                    <CoverageBadge status={l.coverage_status} />
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </>
  );
}

function TopList({
  items,
  tone,
}: {
  items: { id: string; name: string; counterparty_name: string; remaining: string }[];
  tone: "incoming" | "outgoing";
}) {
  if (items.length === 0) return <p className="text-sm text-subtle">Nothing here yet.</p>;
  const max = Math.max(...items.map((i) => toCentavos(i.remaining)), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((i) => {
        const c = toCentavos(i.remaining);
        return (
          <li key={i.id}>
            <Link href={`/obligations/${i.id}`} className="flex items-center justify-between gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{i.counterparty_name || i.name}</span>
                <span className="mt-1 block h-1.5 w-full rounded-full bg-line">
                  <span
                    className={tone === "incoming" ? "block h-full rounded-full bg-incoming" : "block h-full rounded-full bg-outgoing"}
                    style={{ width: `${Math.round((c / max) * 100)}%` }}
                  />
                </span>
              </span>
              <MoneyText c={c} tone={tone} className="text-sm font-semibold" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
