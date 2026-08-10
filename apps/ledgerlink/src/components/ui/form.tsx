"use client";
import { useFormStatus } from "react-dom";
import { Button } from "./primitives";
import { cn } from "@/lib/ui";

export function SubmitButton({
  children,
  variant,
  full,
  className,
  pendingText,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  full?: boolean;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} full={full} className={className} disabled={pending}>
      {pending ? pendingText ?? "Working…" : children}
    </Button>
  );
}

export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return (
    <p
      className={cn(
        "rounded-xl px-3 py-2 text-sm",
        error ? "bg-danger-soft text-danger" : "bg-incoming-soft text-incoming",
      )}
      role="status"
    >
      {error ?? message}
    </p>
  );
}
