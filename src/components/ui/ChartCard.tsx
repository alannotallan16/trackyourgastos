import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, action, legend, children }: Props) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-brand-navy">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={legend ? "flex flex-col lg:flex-row lg:items-center gap-4" : ""}>
        <div className={legend ? "flex-1 min-w-0" : ""}>{children}</div>
        {legend && <div className="lg:w-44 shrink-0">{legend}</div>}
      </div>
    </div>
  );
}
