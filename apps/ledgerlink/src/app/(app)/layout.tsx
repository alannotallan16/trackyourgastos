import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar, BottomNav } from "@/components/app-shell/nav";
import { TopBar } from "@/components/app-shell/topbar";
import type { Profile } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()
    .returns<Profile>();

  const displayName = profile?.display_name || user.email?.split("@")[0] || "You";

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar displayName={displayName} />
        <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 md:pb-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
