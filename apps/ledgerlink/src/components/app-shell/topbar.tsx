import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { Plus, LogOut } from "@/components/ui/icons";
import { initials } from "@/lib/format";

export function TopBar({ displayName }: { displayName: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-card/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-white text-sm font-bold">L</div>
        <span className="font-semibold">LedgerLink</span>
      </div>

      <div className="hidden md:block" />

      <div className="flex items-center gap-2">
        <Link
          href="/obligations/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3 text-sm font-medium text-white hover:bg-ink/90"
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New obligation</span>
          <span className="sm:hidden">New</span>
        </Link>
        <div className="hidden items-center gap-2 sm:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas text-xs font-semibold text-subtle">
            {initials(displayName) || "U"}
          </div>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            title="Sign out"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-subtle hover:bg-canvas hover:text-ink"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </form>
      </div>
    </header>
  );
}
