type Variant = "sidebar" | "topbar" | "full";

interface Props {
  variant?: Variant;
  className?: string;
}

export function BrandLogo({ variant = "sidebar", className = "" }: Props) {
  const onDark = variant === "sidebar";
  const walletFill = onDark ? "#FFFFFF" : "#0D1B2A";
  const walletAccent = onDark ? "#FFFFFF" : "#0D1B2A";
  const wordPrimary = onDark ? "text-white" : "text-brand-navy";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 64 64"
        className="h-9 w-9 shrink-0"
        role="img"
        aria-label="TrackYourGastos logo"
      >
        <rect x="6" y="22" width="52" height="32" rx="6" fill={walletFill} />
        <rect x="6" y="22" width="52" height="8" fill={onDark ? "#0D1B2A" : "#FFFFFF"} fillOpacity={onDark ? 0.18 : 0.15} />
        <circle cx="48" cy="38" r="3.5" fill="#10B981" />
        <path
          d="M18 6 h22 a3 3 0 0 1 3 3 v23 a1.2 1.2 0 0 1 -2 0.9 l-5 -4.2 l-3.3 3.3 a1.2 1.2 0 0 1 -1.7 0 l-2.7 -2.7 l-5 4.6 a1.2 1.2 0 0 1 -2 -0.9 V9 a3 3 0 0 1 3 -3 z"
          fill="#10B981"
        />
        <text
          x="29"
          y="22"
          textAnchor="middle"
          fontFamily="var(--font-poppins), system-ui, sans-serif"
          fontWeight={700}
          fontSize={16}
          fill={walletAccent === "#FFFFFF" ? "#0D1B2A" : "#FFFFFF"}
        >
          ₱
        </text>
      </svg>
      <div className="flex flex-col leading-tight">
        <span className={`font-semibold ${wordPrimary}`}>
          TrackYour<span className="text-brand-green">Gastos</span>
        </span>
        {variant === "full" && (
          <span className={`text-xs ${onDark ? "text-slate-300" : "text-slate-500"}`}>
            Track. Split. Settle.
          </span>
        )}
      </div>
    </div>
  );
}
