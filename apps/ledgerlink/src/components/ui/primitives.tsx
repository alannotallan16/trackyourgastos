"use client";
import * as React from "react";
import { cn } from "@/lib/ui";
import { formatMoney } from "@/lib/money";

/* ------------------------------- Button ------------------------------- */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  full?: boolean;
};
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", full, ...props },
  ref,
) {
  const variants = {
    primary: "bg-ink text-white hover:bg-ink/90",
    secondary: "bg-white text-ink border border-line hover:bg-canvas",
    ghost: "bg-transparent text-subtle hover:bg-canvas",
    danger: "bg-danger text-white hover:bg-danger/90",
    success: "bg-incoming text-white hover:bg-incoming/90",
  }[variant];
  const sizes = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-12 px-5 text-base" }[size];
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors",
        "disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-ink/20",
        variants,
        sizes,
        full && "w-full",
        className,
      )}
      {...props}
    />
  );
});

/* -------------------------------- Card -------------------------------- */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-card rounded-2xl border border-line shadow-card", className)} {...props} />;
}
export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 sm:p-5", className)} {...props} />;
}

/* ------------------------------ StatCard ------------------------------ */
export function StatCard({
  label,
  amount,
  currency = "PHP",
  tone = "neutral",
  hint,
  icon,
}: {
  label: string;
  amount: number;
  currency?: string;
  tone?: "incoming" | "outgoing" | "danger" | "warn" | "neutral";
  hint?: string;
  icon?: React.ReactNode;
}) {
  const toneClasses = {
    incoming: "text-incoming",
    outgoing: "text-outgoing",
    danger: "text-danger",
    warn: "text-warn",
    neutral: "text-ink",
  }[tone];
  return (
    <Card>
      <CardBody className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</span>
          {icon && <span className={cn("opacity-70", toneClasses)}>{icon}</span>}
        </div>
        <span className={cn("text-xl sm:text-2xl font-semibold tabular-nums", toneClasses)}>
          {formatMoney(amount, currency)}
        </span>
        {hint && <span className="text-xs text-subtle">{hint}</span>}
      </CardBody>
    </Card>
  );
}

/* ------------------------------ MoneyText ----------------------------- */
export function MoneyText({
  c,
  currency = "PHP",
  tone,
  className,
}: {
  c: number;
  currency?: string;
  tone?: "incoming" | "outgoing" | "danger" | "muted";
  className?: string;
}) {
  const toneClass = tone
    ? { incoming: "text-incoming", outgoing: "text-outgoing", danger: "text-danger", muted: "text-subtle" }[tone]
    : "";
  return <span className={cn("tabular-nums", toneClass, className)}>{formatMoney(c, currency)}</span>;
}

/* ------------------------------- Badge -------------------------------- */
type BadgeTone = "incoming" | "outgoing" | "warn" | "danger" | "neutral" | "success";
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  const tones: Record<BadgeTone, string> = {
    incoming: "bg-incoming-soft text-incoming",
    outgoing: "bg-outgoing-soft text-outgoing",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    success: "bg-incoming-soft text-incoming",
    neutral: "bg-canvas text-subtle border border-line",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ----------------------------- ProgressBar ---------------------------- */
export function ProgressBar({ pct, tone = "incoming" }: { pct: number; tone?: "incoming" | "outgoing" }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 w-full rounded-full bg-line overflow-hidden" role="progressbar" aria-valuenow={clamped}>
      <div
        className={cn("h-full rounded-full", tone === "incoming" ? "bg-incoming" : "bg-outgoing")}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/* ----------------------------- EmptyState ----------------------------- */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-card/50 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-subtle">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-subtle">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ----------------------------- PageHeader ----------------------------- */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-subtle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
