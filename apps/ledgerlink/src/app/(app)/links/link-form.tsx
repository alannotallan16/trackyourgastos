"use client";
import { useState } from "react";
import { createLinkAction } from "../actions";
import { Card, CardBody, Button } from "@/components/ui/primitives";
import { Field, Select, Input } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/form";
import { Plus } from "@/components/ui/icons";
import type { ObligationLedger } from "@/lib/types";

export function LinkForm({ sources, targets }: { sources: ObligationLedger[]; targets: ObligationLedger[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Link obligations
      </Button>
    );
  }
  return (
    <Card className="w-full">
      <CardBody>
        <form action={createLinkAction} className="grid gap-3 sm:grid-cols-2">
          <Field label="Incoming (funds the payment)" hint="An 'owed to me' obligation.">
            <Select name="source_obligation_id" required defaultValue="">
              <option value="" disabled>Select…</option>
              {sources.map((o) => (
                <option key={o.id} value={o.id}>{o.name} ({o.counterparty_name})</option>
              ))}
            </Select>
          </Field>
          <Field label="Outgoing (gets funded)" hint="An 'I owe' obligation.">
            <Select name="target_obligation_id" required defaultValue="">
              <option value="" disabled>Select…</option>
              {targets.map((o) => (
                <option key={o.id} value={o.id}>{o.name} ({o.counterparty_name})</option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Note">
              <Input name="note" placeholder="e.g. Sister repayment funds UnionBank EasyCash" />
            </Field>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton pendingText="Linking…">Create link</SubmitButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
