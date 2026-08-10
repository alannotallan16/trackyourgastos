"use client";
import * as React from "react";
import { cn } from "@/lib/ui";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-sm font-medium text-ink mb-1", className)} {...props} />;
}

const baseField =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-subtle " +
  "focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink/30 disabled:bg-canvas";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(baseField, className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(baseField, "min-h-[80px]", className)} {...props} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(baseField, "appearance-none pr-8", className)} {...props}>
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-subtle">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

/** Currency input that keeps a decimal string and shows the symbol. */
export function CurrencyInput({
  name,
  defaultValue,
  currency = "PHP",
  required,
  placeholder = "0.00",
}: {
  name: string;
  defaultValue?: string | number;
  currency?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">
        {currency === "PHP" ? "₱" : currency}
      </span>
      <Input
        name={name}
        type="text"
        inputMode="decimal"
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        className="pl-8 tabular-nums"
        pattern="^\\d{1,3}(,?\\d{3})*(\\.\\d{1,2})?$|^\\d+(\\.\\d{1,2})?$"
      />
    </div>
  );
}
