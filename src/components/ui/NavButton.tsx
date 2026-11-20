"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";

interface Props {
  href: string;
  children: ReactNode;
  className?: string;
  loadingLabel?: string;
}

/**
 * Link styled as a button that also shows an immediate pressed state while
 * the destination route navigates. The browser fires the Link href normally
 * when JS is unavailable; when it is, we intercept and dispatch through
 * router.push inside a transition so the pending flag can drive the UI.
 */
export function NavButton({ href, children, className = "btn-primary text-sm", loadingLabel = "Loading…" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clicked, setClicked] = useState(false);
  const busy = pending || clicked;

  return (
    <Link
      href={href}
      prefetch
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        setClicked(true);
        startTransition(() => router.push(href));
      }}
      className={`${className} ${busy ? "pointer-events-none opacity-80" : ""}`}
      aria-busy={busy}
    >
      {busy ? (
        <>
          <span
            aria-hidden="true"
            className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent animate-spin"
          />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </Link>
  );
}
