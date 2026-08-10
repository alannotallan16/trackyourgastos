import Link from "next/link";
import { listObligations } from "@/lib/queries";
import { ObligationCard } from "@/components/obligation-card";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/ui";
import type { Direction } from "@/lib/types";
import { Wallet } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

const tabs: { key: string; label: string; dir?: Direction }[] = [
  { key: "all", label: "All" },
  { key: "owed_to_me", label: "Owed to me", dir: "owed_to_me" },
  { key: "i_owe", label: "I owe", dir: "i_owe" },
];

export default async function ObligationsPage({ searchParams }: { searchParams: { dir?: string } }) {
  const active = searchParams.dir === "owed_to_me" || searchParams.dir === "i_owe" ? searchParams.dir : "all";
  const dir = active === "all" ? undefined : (active as Direction);
  const obligations = await listObligations(dir);

  return (
    <>
      <PageHeader
        title="Obligations"
        subtitle="Every debt account — money owed to you and money you owe."
        action={
          <Link href="/obligations/new" className="inline-flex h-10 items-center rounded-xl bg-ink px-4 text-sm font-medium text-white">
            New obligation
          </Link>
        }
      />

      <div className="flex gap-1 rounded-xl bg-canvas p-1 text-sm">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.dir ? `/obligations?dir=${t.dir}` : "/obligations"}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-center font-medium transition-colors",
              active === t.key ? "bg-white text-ink shadow-card" : "text-subtle hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {obligations.length === 0 ? (
        <EmptyState
          title="No obligations here"
          description="Create one to start tracking installments, payments, and balances."
          icon={<Wallet className="h-8 w-8" />}
          action={
            <Link href="/obligations/new" className="inline-flex h-10 items-center rounded-xl bg-ink px-4 text-sm font-medium text-white">
              New obligation
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {obligations.map((o) => (
            <ObligationCard key={o.id} o={o} />
          ))}
        </div>
      )}
    </>
  );
}
