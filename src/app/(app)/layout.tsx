import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Resolve the profile linked to this auth user so the sidebar chip can show
  // the household display name ("Alan") instead of the email ("lanskie16@…").
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <AppShell userEmail={user.email} userDisplayName={profile?.display_name ?? null}>
      {children}
    </AppShell>
  );
}
