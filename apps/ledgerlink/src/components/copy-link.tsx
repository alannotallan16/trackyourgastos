"use client";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { Copy, Check, ExternalLink } from "@/components/ui/icons";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <code className="flex-1 truncate rounded-xl border border-line bg-canvas px-3 py-2 text-xs">{url}</code>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard may be blocked; the link is visible above */
            }
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-sm font-medium hover:bg-canvas"
        >
          <ExternalLink className="h-4 w-4" /> Open
        </a>
      </div>
    </div>
  );
}
