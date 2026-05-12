import type { ComponentType, SVGProps } from "react";

type Tone = "default" | "positive" | "negative";
type IconBg = "green" | "blue" | "purple" | "orange" | "navy" | "pink" | "cyan";

const ICON_BG: Record<IconBg, string> = {
  green: "bg-emerald-50 text-brand-green",
  blue: "bg-blue-50 text-brand-blue",
  purple: "bg-purple-50 text-brand-purple",
  orange: "bg-amber-50 text-brand-orange",
  navy: "bg-slate-100 text-brand-navy",
  pink: "bg-pink-50 text-brand-pink",
  cyan: "bg-cyan-50 text-brand-cyan"
};

interface Props {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  iconBg?: IconBg;
}

export function StatCard({ label, value, hint, tone = "default", icon: Icon, iconBg = "green" }: Props) {
  const valueColor =
    tone === "positive" ? "text-brand-green" : tone === "negative" ? "text-brand-danger" : "text-brand-navy";
  return (
    <div className="card-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
          <div className={`mt-1 text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</div>
          {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
        </div>
        {Icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ICON_BG[iconBg]}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
