import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfiles } from "@/lib/data";
import { PageHeader } from "@/components/ui/PageHeader";
import { ArrowRight, LogOut } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

const MANAGE_LINKS = [
  { href: "/categories", label: "Categories & merchant rules" },
  { href: "/presets", label: "Split presets" },
  { href: "/recurring", label: "Recurring expenses" },
  { href: "/reports", label: "Reports & exports" }
];

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const profiles = await getProfiles();
  const me = profiles.find((p) => p.id === user?.id);

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4">
      <PageHeader title="Settings" />

      <div className="card space-y-2">
        <p className="text-sm">
          <span className="text-slate-500">Signed in as:</span>{" "}
          <span className="font-medium text-brand-navy">{user?.email}</span>
        </p>
        <p className="text-sm">
          <span className="text-slate-500">Profile:</span>{" "}
          <span className="font-medium text-brand-navy">{me?.display_name ?? "(no profile linked)"}</span>
        </p>
        {!me && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Your auth user isn't linked to a profile yet. Run{" "}
            <code className="font-mono">supabase/migrations/0004_link_profiles.sql</code> with the correct email.
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold text-brand-navy mb-3">Household members</h2>
        <ul className="text-sm divide-y divide-slate-100">
          {profiles.map((p) => (
            <li key={p.id} className="flex justify-between py-2">
              <span className="font-medium">{p.display_name}</span>
              <span className="text-xs text-slate-500 uppercase tracking-wide">{p.short_name}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold text-brand-navy mb-3">Manage</h2>
        <ul className="divide-y divide-slate-100">
          {MANAGE_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="flex items-center justify-between py-2.5 text-sm text-brand-navy hover:text-brand-green"
              >
                <span>{l.label}</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <form action="/auth/signout" method="post">
        <button className="btn-secondary">
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </form>
    </div>
  );
}
