"use client";
import { useFormState } from "react-dom";
import Link from "next/link";
import { signUpAction, type AuthState } from "../actions";
import { Card, CardBody } from "@/components/ui/primitives";
import { Field, Input } from "@/components/ui/fields";
import { SubmitButton, FormMessage } from "@/components/ui/form";

export default function RegisterPage() {
  const [state, action] = useFormState<AuthState, FormData>(signUpAction, {});
  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Create your account</h1>
          <p className="text-sm text-subtle">Your financial data is private to you.</p>
        </div>
        <FormMessage error={state.error} message={state.message} />
        <form action={action} className="space-y-3">
          <Field label="Name">
            <Input name="display_name" required placeholder="Juan Dela Cruz" autoComplete="name" />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
          </Field>
          <Field label="Password" hint="At least 8 characters.">
            <Input name="password" type="password" required placeholder="••••••••" autoComplete="new-password" />
          </Field>
          <SubmitButton full pendingText="Creating…">Create account</SubmitButton>
        </form>
        <p className="text-sm text-subtle">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-ink hover:underline">Sign in</Link>
        </p>
      </CardBody>
    </Card>
  );
}
