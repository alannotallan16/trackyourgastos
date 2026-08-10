"use client";
import { useState, useRef } from "react";
import { createContactAction } from "../actions";
import { Card, CardBody, Button } from "@/components/ui/primitives";
import { Field, Input, Textarea } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/form";
import { Plus } from "@/components/ui/icons";

export function AddContact() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add contact
      </Button>
    );
  }
  return (
    <Card className="w-full">
      <CardBody>
        <form
          ref={formRef}
          action={async (fd) => {
            await createContactAction(fd);
            formRef.current?.reset();
            setOpen(false);
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <Field label="Name">
            <Input name="name" required placeholder="e.g. Mari Cel" />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" placeholder="optional" />
          </Field>
          <Field label="Phone">
            <Input name="phone" placeholder="optional" />
          </Field>
          <Field label="Notes">
            <Textarea name="notes" rows={1} placeholder="optional" />
          </Field>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton pendingText="Saving…">Save contact</SubmitButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
