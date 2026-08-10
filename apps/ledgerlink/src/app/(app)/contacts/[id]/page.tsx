import Link from "next/link";
import { notFound } from "next/navigation";
import { getContactDetail } from "@/lib/queries";
import { toCentavos } from "@/lib/money";
import { StatCard, PageHeader, EmptyState } from "@/components/ui/primitives";
import { ObligationCard } from "@/components/obligation-card";
import { ChevronLeft } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const { contact, obligations } = await getContactDetail(params.id);
  if (!contact) notFound();

  const owedToMe = obligations.filter((o) => o.direction === "owed_to_me");
  const iOwe = obligations.filter((o) => o.direction === "i_owe");
  const sum = (arr: typeof obligations) => arr.reduce((a, o) => a + toCentavos(o.remaining), 0);

  return (
    <>
      <Link href="/contacts" className="inline-flex items-center gap-1 text-sm text-subtle hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> All contacts
      </Link>
      <PageHeader title={contact.name} subtitle={[contact.email, contact.phone].filter(Boolean).join(" · ") || undefined} />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="They owe me" amount={sum(owedToMe)} tone="incoming" />
        <StatCard label="I owe them" amount={sum(iOwe)} tone="outgoing" />
      </div>

      {contact.notes && <p className="rounded-xl bg-canvas px-3 py-2 text-sm text-subtle">{contact.notes}</p>}

      {obligations.length === 0 ? (
        <EmptyState title="No obligations with this contact" description="Create an obligation and link it to them." />
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
