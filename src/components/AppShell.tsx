"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { MobileBottomNav } from "@/components/ui/MobileBottomNav";
import {
  Home,
  Receipt,
  Plus,
  Repeat,
  ArrowLeftRight,
  BarChart3,
  Tag,
  Scissors,
  Settings,
  Menu,
  X,
  LogOut
} from "@/components/ui/icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: Home },
  { href: "/expenses", label: "Expenses", Icon: Receipt },
  { href: "/expenses/new", label: "Add expense", Icon: Plus },
  { href: "/recurring", label: "Recurring", Icon: Repeat },
  { href: "/settlements", label: "Settlements", Icon: ArrowLeftRight },
  { href: "/reports", label: "Reports", Icon: BarChart3 },
  { href: "/categories", label: "Categories", Icon: Tag },
  { href: "/presets", label: "Splits", Icon: Scissors },
  { href: "/settings", label: "Settings", Icon: Settings }
] as const;

function initials(email?: string | null) {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (local.slice(0, 2) || "?").toUpperCase();
}

export function AppShell({ children, userEmail }: { children: React.ReactNode; userEmail?: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const navList = (onClick?: () => void) =>
    NAV.map((n) => {
      const active = isActive(n.href);
      return (
        <Link
          key={n.href}
          href={n.href}
          onClick={onClick}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
            active
              ? "bg-brand-gradient text-white shadow-sm"
              : "text-slate-300 hover:bg-white/5 hover:text-white"
          }`}
        >
          <n.Icon className="h-5 w-5 shrink-0" />
          <span>{n.label}</span>
        </Link>
      );
    });

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar — sticky so it stays in view as main content scrolls */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-brand-navy text-white md:sticky md:top-0 md:h-screen md:self-start">
        <div className="px-5 py-5 shrink-0">
          <Link href="/dashboard" aria-label="TrackYourGastos home">
            <BrandLogo variant="sidebar" />
          </Link>
        </div>
        <nav className="flex-1 min-h-0 px-3 pb-3 space-y-1 overflow-y-auto">{navList()}</nav>
        <div className="mt-auto px-3 pb-4 shrink-0">
          <div className="rounded-xl border border-white/5 bg-white/[0.04] px-3 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-white">
                {initials(userEmail)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-white truncate">{userEmail ?? "—"}</div>
              </div>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  aria-label="Sign out"
                  className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-20 flex items-center justify-between bg-brand-navy px-4 py-3 text-white">
        <Link href="/dashboard" aria-label="TrackYourGastos home">
          <BrandLogo variant="sidebar" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          className="rounded-lg p-2 hover:bg-white/10"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-30" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-brand-navy/60"
            onClick={() => setOpen(false)}
          />
          <div className="relative ml-auto h-full w-72 bg-brand-navy p-4 text-white overflow-y-auto">
            <div className="flex items-center justify-between pb-3">
              <BrandLogo variant="sidebar" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-2 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">{navList(() => setOpen(false))}</nav>
            <form action="/auth/signout" method="post" className="mt-4 border-t border-white/10 pt-4">
              <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}

      <main className="flex-1 pb-24 md:pb-6 min-w-0">{children}</main>

      <MobileBottomNav pathname={pathname} />
    </div>
  );
}
