"use client";

import { useTransition } from "react";
import { deleteExpense } from "@/app/(app)/expenses/actions";
import { Trash2 } from "@/components/ui/icons";

export function DeleteExpenseButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-danger text-sm"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this expense? This cannot be undone.")) return;
        start(() => deleteExpense(id));
      }}
    >
      <Trash2 className="h-4 w-4" />
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
