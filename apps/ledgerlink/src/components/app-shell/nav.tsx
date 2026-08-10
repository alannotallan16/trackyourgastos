"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ui";
import {
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  FileText,
  Wallet,
  CalendarDays,
  BarChart3,
  Settings,
  Link2,
  MoreHorizontal,
} from "@/components/ui/icons";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

export const primaryNav: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/obligations?dir=owed_to_me", label: "Owed to me", icon: ArrowDownLeft },
  { href: "/obligations?dir=i_owe", label: "I owe", icon: ArrowUpRight },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/payments", label: "Payments", icon: Wallet },
  { href: "/links", label: "Linked obligations", icon: Link2 },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const mobileNav: Item[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/obligations", label: "Debts", icon: Wallet },
  { href: "/payments", label: "Payments", icon: ArrowDownLeft },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => {
    const base = href.split("?")[0];
    if (base === "/dashboard") return pathname === "/dashboard";
    return pathname === base || pathname.startsWith(base + "/");
  };
}

export function Sidebar() {
  const isActive = useActive();
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-card">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white font-bold">L</div>
        <span className="text-lg font-semibold tracking-tight">LedgerLink</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {primaryNav.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href) ? "bg-ink text-white" : "text-subtle hover:bg-canvas hover:text-ink",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function BottomNav() {
  const isActive = useActive();
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {mobileNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[11px] font-medium",
                active ? "text-ink" : "text-subtle",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
