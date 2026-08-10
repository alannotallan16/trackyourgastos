import { listContacts, listObligations } from "@/lib/queries";
import { PageHeader, Card, CardBody } from "@/components/ui/primitives";
import { Field, Input, Select, Textarea, CurrencyInput } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/form";
import { createInvoiceAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({ searchParams }: { searchParams: { obligation?: string } }) {
  const [contacts, obligations] = await Promise.all([listContacts(), listObligations("owed_to_me")]);
  const today = new Date().toISOString().slice(0, 10);
  const preselect = searchParams.obligation ?? "";

  return (
    <>
      <PageHeader title="New invoice" subtitle="A payment request you can share as a secure link." />
      <Card>
        <CardBody>
          <form action={createInvoiceAction} className="grid gap-3 sm:grid-cols-2">
            <Field label="Title / description">
              <Input name="title" placeholder="Monthly repayment for UnionBank EasyCash" required />
            </Field>
            <Field label="Amount">
              <CurrencyInput name="amount" required />
            </Field>
            <Field label="Bill to (contact)">
              <Select name="contact_id" defaultValue="">
                <option value="">— none —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Related obligation" hint="Approved payments will apply to this obligation.">
              <Select name="obligation_id" defaultValue={preselect}>
                <option value="">— none —</option>
                {obligations.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} ({o.counterparty_name})</option>
                ))}
              </Select>
            </Field>
            <Field label="Due date">
              <Input name="due_date" type="date" defaultValue={today} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <Textarea name="notes" rows={2} placeholder="Payment instructions, etc." />
              </Field>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <SubmitButton pendingText="Creating…">Create & get link</SubmitButton>
            </div>
          </form>
        </CardBody>
      </Card>
    </>
  );
}
