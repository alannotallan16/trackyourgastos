"use client";

import Link from "next/link";
import type { Profile } from "@/lib/types";
import type { UserBalance } from "@/lib/balances";
import { formatMoney } from "@/lib/format";

interface Props {
  me: Profile;
  others: Profile[];
  balances: UserBalance[];
}

/**
 * The first-screen hero on the dashboard, tailored to whoever is logged in.
 *
 * Reads the signed-in person's net:
 *   net > 0 → "You're owed ₱X"  (and names who owes them)
 *   net < 0 → "You owe ₱X"      (and names who they owe)
 *   net ≈ 0 → "You're all settled"
 *
 * The other two household members' nets drop down to a compact row underneath
 * so the picture of the whole house is still one glance away.
 */
export function YourBalanceHero({ me, others, balances }: Props) {
  const myBalance = balances.find((b) => b.user_id === me.id);
  const net = myBalance?.net ?? 0;
  const absNet = Math.abs(net);
  const owed = net > 0.005;
  const owe = net < -0.005;
  const settled = !owed && !owe;

  // Build a "to whom / by whom" sentence by running the greedy matcher just
  // against this household subset. Done inline because the Dashboard already
  // has the full suggestions list; we just want it phrased in second person.
  const counterparties = buildCounterparties(me.id, balances, others);

  return (
    <section className="card p-5 md:p-6 bg-white relative overflow-hidden">
      {/* Subtle brand wash in the corner. Hides neatly if the user prefers plain. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-gradient opacity-10 blur-2xl"
      />

      <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {settled ? "Household status" : owed ? "You're owed" : "You owe"}
          </p>
          <p
            className={`mt-1 text-4xl md:text-5xl font-semibold tabular-nums ${
              owed ? "text-emerald-700" : owe ? "text-red-600" : "text-brand-navy"
            }`}
          >
            {settled ? "₱0.00" : formatMoney(absNet)}
          </p>

          {!settled && counterparties.length > 0 && (
            <ul className="mt-2 text-sm text-slate-600 space-y-0.5">
              {counterparties.length === 1 ? (
                // Only one counterparty — don't re-print the already-huge headline amount
                // next to their name. Just name them.
                <li>
                  {owed ? "from" : "to"} <strong className="text-brand-navy">{counterparties[0].name}</strong>
                </li>
              ) : (
                counterparties.map((c) => (
                  <li key={c.user_id}>
                    {owed ? "from" : "to"} <strong className="text-brand-navy">{c.name}</strong>{" "}
                    <span className="tabular-nums text-slate-500">· {formatMoney(c.amount)}</span>
                  </li>
                ))
              )}
            </ul>
          )}
          {settled && (
            <p className="mt-2 text-sm text-slate-600">
              Your paid total matches your share of the household.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {/* One primary CTA, only when the signed-in user owes money. When they're
                the creditor they can't force anyone to pay, so there's nothing to do here. */}
            {owe && (
              <Link href="/settlements" className="btn-primary text-sm">
                Record payment
              </Link>
            )}
            <Link href="/expenses" className="btn-secondary text-sm">
              Review expenses
            </Link>
          </div>
        </div>

        {/* Other two members' nets at a glance */}
        <div className="shrink-0 min-w-0 md:w-56 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Household</p>
          <ul className="space-y-1.5">
            {others.map((p) => {
              const b = balances.find((x) => x.user_id === p.id);
              const n = b?.net ?? 0;
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-2"
                >
                  <span className="text-sm text-brand-navy truncate">{p.display_name}</span>
                  <span
                    className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
                      n > 0.005 ? "text-emerald-700" : n < -0.005 ? "text-red-600" : "text-slate-500"
                    }`}
                  >
                    {n > 0.005 ? "+" : ""}
                    {formatMoney(n)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function buildCounterparties(
  meId: string,
  balances: UserBalance[],
  others: Profile[]
): { user_id: string; name: string; amount: number }[] {
  // Clone balances as mutable {user_id, net} for the greedy pass.
  const working = balances.map((b) => ({ user_id: b.user_id, net: b.net }));
  const creditors = working.filter((b) => b.net > 0.005).sort((a, b) => b.net - a.net);
  const debtors = working.filter((b) => b.net < -0.005).sort((a, b) => a.net - b.net);

  const out: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const pay = Math.min(-d.net, c.net);
    if (pay > 0.005) {
      out.push({ from: d.user_id, to: c.user_id, amount: Math.round(pay * 100) / 100 });
      d.net += pay;
      c.net -= pay;
    }
    if (Math.abs(d.net) < 0.005) i++;
    if (Math.abs(c.net) < 0.005) j++;
  }

  const otherById = new Map(others.map((p) => [p.id, p.display_name]));
  return out
    .filter((x) => x.from === meId || x.to === meId)
    .map((x) => ({
      user_id: x.from === meId ? x.to : x.from,
      name: otherById.get(x.from === meId ? x.to : x.from) ?? "—",
      amount: x.amount
    }));
}
