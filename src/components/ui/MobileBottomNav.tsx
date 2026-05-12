"use client";

import Link from "next/link";
import { useState } from "react";
import { Home, Receipt, Plus, ArrowLeftRight, MoreHorizontal, X, Repeat, BarChart3, Tag, Scissors, Settings, LogOut } from "./icons";

const PRIMARY = [
  { href: "/dashboard", label: "Dashboard", Icon: Home },
  { href: "/expenses", label: "Expenses", Icon: Receipt },
  { href: "/expenses/new", label: "Add", Icon: Plus, fab: true },
  { href: "/settlements", label: "Settle", Icon: ArrowLeftRight }
];

const MORE = [
  { href: "/recurring", label: "Recurring", Icon: Repeat },
  { href: "/reports", label: "Reports", Icon: BarChart3 },
  { href: "/categories", label: "Categories", Icon: Tag },
  { href: "/presets", label: "Splits", Icon: Scissors },
  { href: "/settings", label: "Settings", Icon: Settings }
];

interface Props {
  pathname: string;
}

export function MobileBottomNav({ pathname }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-end justify-around border-t border-slate-200 bg-white px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {PRIMARY.map((n) => {
          if (n.fab) {
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-label="Add expense"
                className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-fab active:brightness-95"
              >
                <n.Icon className="h-6 w-6" />
              </Link>
            );
          }
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex w-16 flex-col items-center gap-0.5 py-1 text-[11px] ${
                active ? "text-brand-green" : "text-slate-500"
              }`}
            >
              <n.Icon className="h-5 w-5" />
              <span>{n.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex w-16 flex-col items-center gap-0.5 py-1 text-[11px] text-slate-500"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex items-end" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-brand-navy/50"
            onClick={() => setMoreOpen(false)}
          />
          <div className="relative w-full rounded-t-3xl bg-white p-4 shadow-card-hover">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-sm font-semibold text-brand-navy">More</h2>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MORE.map((n) => {
                const active = isActive(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm ${
                      active ? "bg-emerald-50 text-brand-green" : "text-brand-navy hover:bg-slate-50"
                    }`}
                  >
                    <n.Icon className="h-5 w-5" />
                    <span>{n.label}</span>
                  </Link>
                );
              })}
            </div>
            <form action="/auth/signout" method="post" className="mt-3">
              <button className="btn-secondary w-full justify-center">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
