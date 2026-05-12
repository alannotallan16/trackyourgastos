import type { ReactNode } from "react";

type Color = "green" | "blue" | "purple" | "orange" | "navy" | "gray" | "pink" | "cyan" | "danger";

const STYLES: Record<Color, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  purple: "bg-purple-50 text-purple-700 ring-purple-200",
  orange: "bg-amber-50 text-amber-800 ring-amber-200",
  navy: "bg-slate-100 text-brand-navy ring-slate-200",
  gray: "bg-slate-100 text-slate-600 ring-slate-200",
  pink: "bg-pink-50 text-pink-700 ring-pink-200",
  cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  danger: "bg-red-50 text-red-700 ring-red-200"
};

interface Props {
  color?: Color;
  className?: string;
  children: ReactNode;
}

export function Badge({ color = "gray", className = "", children }: Props) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[color]} ${className}`}>
      {children}
    </span>
  );
}

const CATEGORY_COLORS: Record<string, Color> = {
  Grocery: "green",
  Utilities: "blue",
  Pets: "purple",
  Dining: "orange",
  Rent: "navy",
  Shopping: "pink",
  Transportation: "cyan",
  Subscription: "blue",
  Household: "purple",
  Other: "gray"
};

export function colorForCategory(name?: string | null): Color {
  if (!name) return "gray";
  return CATEGORY_COLORS[name] ?? "gray";
}
