"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/expenses", label: "Expenses", icon: "🧾" },
  { href: "/expenses/new", label: "Add", icon: "➕" },
  { href: "/recurring", label: "Recurring", icon: "🔁" },
  { href: "/settlements", label: "Settlements", icon: "💸" },
  { href: "/reports", label: "Reports", icon: "📈" },
  { href: "/categories", label: "Categories", icon: "🏷️" },
  { href: "/presets", label: "Splits", icon: "✂️" },
  { href: "/settings", label: "Settings", icon: "⚙️" }
];

export function AppShell({ children, userEmail }: { children: React.ReactNode; userEmail?: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:flex-col w-56 bg-white border-r border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <Link href="/dashboard" className="text-lg font-semibold text-brand-dark">
            TrackYourGastos
          </Link>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  active ? "bg-brand text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>{n.icon}</span>
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-200 text-xs text-slate-500 break-all">
          {userEmail}
          <form action="/auth/signout" method="post" className="mt-2">
            <button className="text-brand underline">Sign out</button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3">
        <Link href="/dashboard" className="font-semibold text-brand-dark">
          TrackYourGastos
        </Link>
        <button className="text-slate-600" onClick={() => setOpen(!open)} aria-label="menu">
          ☰
        </button>
      </header>
      {open && (
        <div className="md:hidden bg-white border-b border-slate-200">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block px-4 py-2 text-sm border-t border-slate-100"
              onClick={() => setOpen(false)}
            >
              {n.icon} {n.label}
            </Link>
          ))}
          <form action="/auth/signout" method="post" className="p-4 border-t border-slate-100">
            <button className="text-brand underline text-sm">Sign out</button>
          </form>
        </div>
      )}

      <main className="flex-1 pb-24 md:pb-6">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex justify-around py-2 z-30">
        {NAV.slice(0, 5).map((n) => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex flex-col items-center text-xs ${active ? "text-brand" : "text-slate-600"}`}
            >
              <span className="text-lg">{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
