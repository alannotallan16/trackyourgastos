import { listContacts } from "@/lib/queries";
import { PageHeader } from "@/components/ui/primitives";
import { ObligationForm } from "./obligation-form";

export const dynamic = "force-dynamic";

export default async function NewObligationPage() {
  const contacts = await listContacts();
  return (
    <>
      <PageHeader title="New obligation" subtitle="Start by choosing who owes whom." />
      <ObligationForm contacts={contacts} />
    </>
  );
}
