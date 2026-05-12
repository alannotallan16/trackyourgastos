"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePayment } from "../actions";
import { Trash2 } from "@/components/ui/icons";

interface Props {
  paymentId: string;
  amountLabel: string;
}

export function DeletePaymentButton({ paymentId, amountLabel }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-xs text-brand-danger hover:underline disabled:opacity-50"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Undo this ${amountLabel} payment? It will be removed from the settlement.`)) return;
        start(async () => {
          try {
            await deletePayment(paymentId);
            router.refresh();
          } catch (e: any) {
            alert(e?.message ?? "Failed to undo.");
          }
        });
      }}
    >
      <Trash2 className="h-3.5 w-3.5" />
      {pending ? "Undoing…" : "Undo"}
    </button>
  );
}
