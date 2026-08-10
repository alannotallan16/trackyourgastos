"use client";
import { useFormState } from "react-dom";
import Link from "next/link";
import { signInAction, type AuthState } from "../actions";
import { Card, CardBody } from "@/components/ui/primitives";
import { Field, Input } from "@/components/ui/fields";
import { SubmitButton, FormMessage } from "@/components/ui/form";

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action] = useFormState<AuthState, FormData>(signInAction, {});
  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Sign in</h1>
          <p className="text-sm text-subtle">Welcome back.</p>
        </div>
        <FormMessage error={state.error} message={state.message ?? notice} />
        <form action={action} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
          </Field>
          <SubmitButton full pendingText="Signing in…">Sign in</SubmitButton>
        </form>
        <div className="flex items-center justify-between text-sm">
          <Link href="/forgot" className="text-subtle hover:text-ink">Forgot password?</Link>
          <Link href="/register" className="font-medium text-ink hover:underline">Create account</Link>
        </div>
      </CardBody>
    </Card>
  );
}
