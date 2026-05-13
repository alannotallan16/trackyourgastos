type Variant = "sidebar" | "topbar" | "full";

interface Props {
  variant?: Variant;
  className?: string;
}

/**
 * GastosHQ inline brand mark + wordmark.
 *
 * The mark is the wallet + peso receipt the app launched with — it lives
 * inline as SVG (instead of an <img>) so its colours can flex with the
 * variant: white-on-navy in the sidebar, navy-on-white in the topbar.
 *
 * To swap in a hi-res PNG/SVG of the uploaded logo, drop the file in
 * public/branding/gastoshq-logo.png (or .svg) and replace the <svg> block
 * below with <img src="/branding/gastoshq-logo.png" .../>.
 */
export function BrandLogo({ variant = "sidebar", className = "" }: Props) {
  const onDark = variant === "sidebar";
  const wordPrimary = onDark ? "text-white" : "text-brand-navy";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 64 64" className="h-9 w-9 shrink-0" role="img" aria-label="GastosHQ logo">
        <defs>
          <linearGradient id="walletBody" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0E9F76" />
            <stop offset="1" stopColor="#A7E847" />
          </linearGradient>
        </defs>
        <rect x="6" y="22" width="52" height="32" rx="6" fill={onDark ? "#FFFFFF" : "#0D1B2A"} />
        <rect x="6" y="22" width="52" height="32" rx="6" fill="url(#walletBody)" fillOpacity={onDark ? 1 : 0.15} />
        <rect x="6" y="22" width="52" height="8" fill={onDark ? "#0D1B2A" : "#FFFFFF"} fillOpacity={onDark ? 0.18 : 0.15} />
        <rect x="44" y="34" width="10" height="8" rx="2" fill="#F59E0B" />
        <circle cx="49" cy="38" r="1.4" fill="#0D1B2A" />
        <path
          d="M18 6 h22 a3 3 0 0 1 3 3 v23 a1.2 1.2 0 0 1 -2 0.9 l-5 -4.2 l-3.3 3.3 a1.2 1.2 0 0 1 -1.7 0 l-2.7 -2.7 l-5 4.6 a1.2 1.2 0 0 1 -2 -0.9 V9 a3 3 0 0 1 3 -3 z"
          fill="#0E9F76"
        />
        <text
          x="29"
          y="22"
          textAnchor="middle"
          fontFamily="var(--font-poppins), system-ui, sans-serif"
          fontWeight={700}
          fontSize={16}
          fill="#FFFFFF"
        >
          ₱
        </text>
      </svg>
      <div className="flex flex-col leading-tight">
        <span className={`font-semibold ${wordPrimary}`}>
          Gastos<span className="text-brand-green">HQ</span>
        </span>
        {variant === "full" && (
          <span className={`text-xs ${onDark ? "text-slate-300" : "text-slate-500"}`}>
            Shared household expenses made simple.
          </span>
        )}
      </div>
    </div>
  );
}
