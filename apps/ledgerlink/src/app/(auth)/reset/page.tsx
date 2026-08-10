"use client";
import { useFormState } from "react-dom";
import { updatePasswordAction, type AuthState } from "../actions";
import { Card, CardBody } from "@/components/ui/primitives";
import { Field, Input } from "@/components/ui/fields";
import { SubmitButton, FormMessage } from "@/components/ui/form";

export default function ResetPage() {
  const [state, action] = useFormState<AuthState, FormData>(updatePasswordAction, {});
  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Set a new password</h1>
          <p className="text-sm text-subtle">Enter a new password for your account.</p>
        </div>
        <FormMessage error={state.error} message={state.message} />
        <form action={action} className="space-y-3">
          <Field label="New password" hint="At least 8 characters.">
            <Input name="password" type="password" required placeholder="••••••••" autoComplete="new-password" />
          </Field>
          <SubmitButton full pendingText="Saving…">Update password</SubmitButton>
        </form>
      </CardBody>
    </Card>
  );
}
