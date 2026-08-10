import { listLinks, listObligations } from "@/lib/queries";
import { toCentavos, formatMoney } from "@/lib/money";
import { Card, CardBody, PageHeader, EmptyState, ProgressBar } from "@/components/ui/primitives";
import { CoverageBadge } from "@/components/ui/status";
import { LinkForm } from "./link-form";
import { deleteLinkAction } from "../actions";
import { SubmitButton } from "@/components/ui/form";
import { Link2, ArrowDownLeft, ArrowUpRight } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function LinksPage() {
  const [links, sources, targets] = await Promise.all([
    listLinks(),
    listObligations("owed_to_me"),
    listObligations("i_owe"),
  ]);

  return (
    <>
      <PageHeader
        title="Linked obligations"
        subtitle="See whether money coming in covers money going out — without merging the two debts."
        action={<LinkForm sources={sources} targets={targets} />}
      />

      {links.length === 0 ? (
        <EmptyState
          title="No links yet"
          description="Link an incoming obligation (someone repaying you) to an outgoing one (a loan you pay) to track coverage."
          icon={<Link2 className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-3">
          {links.map((l) => {
            const inc = toCentavos(l.incoming_expected);
            const out = toCentavos(l.outgoing_due);
            const received = toCentavos(l.incoming_received);
            const pct = l.coverage_pct ? parseFloat(l.coverage_pct) : 0;
            return (
              <Card key={l.id}>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        <ArrowDownLeft className="h-4 w-4 text-incoming" />
                        {l.source_counterparty || l.source_name}
                        <span className="text-subtle">funds</span>
                        <ArrowUpRight className="h-4 w-4 text-outgoing" />
                        {l.target_counterparty || l.target_name}
                      </div>
                      {l.note && <p className="mt-0.5 text-xs text-subtle">{l.note}</p>}
                    </div>
                    <CoverageBadge status={l.coverage_status} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <KV label="Expected in" v={formatMoney(inc)} tone="incoming" />
                    <KV label="Due out" v={formatMoney(out)} tone="outgoing" />
                    <KV label="Received in" v={formatMoney(received)} tone="incoming" />
                    <KV label="Coverage" v={l.coverage_pct ? `${l.coverage_pct}%` : "—"} />
                  </div>

                  <div>
                    <ProgressBar pct={Math.min(pct, 100)} tone="incoming" />
                    {out > inc && (
                      <p className="mt-1 text-xs text-danger">Shortfall: {formatMoney(toCentavos(l.shortfall))} this month</p>
                    )}
                  </div>

                  <form action={deleteLinkAction} className="flex justify-end">
                    <input type="hidden" name="link_id" value={l.id} />
                    <SubmitButton variant="ghost" className="h-8 px-3 text-danger">Remove link</SubmitButton>
                  </form>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function KV({ label, v, tone }: { label: string; v: string; tone?: "incoming" | "outgoing" }) {
  const toneClass = tone === "incoming" ? "text-incoming" : tone === "outgoing" ? "text-outgoing" : "text-ink";
  return (
    <div>
      <div className="text-xs text-subtle">{label}</div>
      <div className={`font-semibold tabular-nums ${toneClass}`}>{v}</div>
    </div>
  );
}
