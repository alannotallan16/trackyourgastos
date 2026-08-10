"use client";
import { useFormState } from "react-dom";
import Link from "next/link";
import { requestResetAction, type AuthState } from "../actions";
import { Card, CardBody } from "@/components/ui/primitives";
import { Field, Input } from "@/components/ui/fields";
import { SubmitButton, FormMessage } from "@/components/ui/form";

export default function ForgotPage() {
  const [state, action] = useFormState<AuthState, FormData>(requestResetAction, {});
  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Reset password</h1>
          <p className="text-sm text-subtle">We&apos;ll email you a reset link.</p>
        </div>
        <FormMessage error={state.error} message={state.message} />
        <form action={action} className="space-y-3">
          <Field label="Email">
            <Input name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
          </Field>
          <SubmitButton full pendingText="Sending…">Send reset link</SubmitButton>
        </form>
        <Link href="/login" className="text-sm text-subtle hover:text-ink">Back to sign in</Link>
      </CardBody>
    </Card>
  );
}
