import Link from "next/link";
import { listContacts } from "@/lib/queries";
import { Card, CardBody, PageHeader, EmptyState } from "@/components/ui/primitives";
import { AddContact } from "./add-contact";
import { initials } from "@/lib/format";
import { Users, ChevronRight, Mail, Phone } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const contacts = await listContacts();
  return (
    <>
      <PageHeader title="Contacts" subtitle="People and organizations you have obligations with." action={<AddContact />} />
      {contacts.length === 0 ? (
        <EmptyState title="No contacts yet" description="Add people you lend to or owe, then attach obligations to them." icon={<Users className="h-8 w-8" />} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((c) => (
            <Link key={c.id} href={`/contacts/${c.id}`}>
              <Card className="transition-shadow hover:shadow-pop">
                <CardBody className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-semibold text-subtle">
                    {initials(c.name) || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="flex flex-wrap gap-x-3 text-xs text-subtle">
                      {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                      {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-subtle" />
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
