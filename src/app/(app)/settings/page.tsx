import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfiles } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profiles = await getProfiles();
  const me = profiles.find((p) => p.id === user?.id);

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <div className="card space-y-2">
        <p className="text-sm"><span className="text-slate-500">Signed in as:</span> {user?.email}</p>
        <p className="text-sm"><span className="text-slate-500">Profile:</span> {me?.display_name ?? "(no profile linked)"}</p>
        {!me && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            Your auth user isn't linked to a profile yet. Run <code>supabase/migrations/0004_link_profiles.sql</code> with the correct email.
          </p>
        )}
      </div>
      <div className="card">
        <h2 className="font-medium mb-2">Household members</h2>
        <ul className="text-sm space-y-1">
          {profiles.map((p) => (
            <li key={p.id} className="flex justify-between border-b border-slate-100 py-1">
              <span>{p.display_name}</span>
              <span className="text-slate-500">{p.short_name}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h2 className="font-medium mb-2">Manage</h2>
        <ul className="text-sm space-y-1 list-disc list-inside">
          <li><Link className="text-brand underline" href="/categories">Categories &amp; merchant rules</Link></li>
          <li><Link className="text-brand underline" href="/presets">Split presets</Link></li>
          <li><Link className="text-brand underline" href="/recurring">Recurring expenses</Link></li>
          <li><Link className="text-brand underline" href="/reports">Reports &amp; exports</Link></li>
        </ul>
      </div>
      <form action="/auth/signout" method="post">
        <button className="btn-secondary">Sign out</button>
      </form>
    </div>
  );
}
