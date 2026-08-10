"use client";
import { useState } from "react";
import { recordPaymentAction } from "@/app/(app)/actions";
import { Card, CardBody, Button } from "@/components/ui/primitives";
import { Field, Input, Select, CurrencyInput } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/form";
import { formatMoney, toCentavos } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import type { InstallmentLedger } from "@/lib/types";

export function RecordPayment({
  obligationId,
  currency,
  installments,
}: {
  obligationId: string;
  currency: string;
  installments: InstallmentLedger[];
}) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const openInstallments = installments.filter((i) => toCentavos(i.remaining) > 0);

  if (!open) {
    return (
      <Button variant="success" onClick={() => setOpen(true)}>
        Record payment
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardBody>
        <form action={recordPaymentAction} className="grid gap-3 sm:grid-cols-2" onSubmit={() => setOpen(false)}>
          <input type="hidden" name="obligation_id" value={obligationId} />
          <Field label="Amount">
            <CurrencyInput name="amount" currency={currency} required />
          </Field>
          <Field label="Date">
            <Input name="paid_at" type="date" defaultValue={today} required />
          </Field>
          <Field label="Method">
            <Select name="method" defaultValue="bank_transfer">
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="gcash">GCash</option>
              <option value="maya">Maya</option>
              <option value="credit_card">Credit card</option>
              <option value="debit_card">Debit card</option>
              <option value="check">Check</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Apply to installment" hint="Leave on auto to fill the oldest unpaid first.">
            <Select name="installment_id" defaultValue="">
              <option value="">Auto (oldest first)</option>
              {openInstallments.map((i) => (
                <option key={i.id} value={i.id}>
                  #{i.seq} · {fmtDate(i.due_date)} · {formatMoney(toCentavos(i.remaining), currency)} left
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference #">
            <Input name="reference" placeholder="e.g. GC-8842" />
          </Field>
          <Field label="Notes">
            <Input name="notes" placeholder="Optional" />
          </Field>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton variant="success" pendingText="Saving…">Save payment</SubmitButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
