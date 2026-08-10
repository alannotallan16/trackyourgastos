"use client";
import { useState } from "react";
import { reviewPaymentAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/primitives";
import { Input } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/form";
import { Check, X } from "@/components/ui/icons";

export function ReviewPayment({ paymentId }: { paymentId: string }) {
  const [rejecting, setRejecting] = useState(false);

  if (rejecting) {
    return (
      <form action={reviewPaymentAction} className="flex items-center gap-2">
        <input type="hidden" name="payment_id" value={paymentId} />
        <input type="hidden" name="decision" value="reject" />
        <Input name="reason" placeholder="Reason for rejection" required className="h-8 w-44" />
        <SubmitButton variant="danger" className="h-8 px-3">Reject</SubmitButton>
        <Button type="button" variant="ghost" className="h-8 px-2" onClick={() => setRejecting(false)}>
          <X className="h-4 w-4" />
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <form action={reviewPaymentAction}>
        <input type="hidden" name="payment_id" value={paymentId} />
        <input type="hidden" name="decision" value="approve" />
        <SubmitButton variant="success" className="h-8 px-3">
          <Check className="h-4 w-4" /> Approve
        </SubmitButton>
      </form>
      <Button type="button" variant="secondary" className="h-8 px-3" onClick={() => setRejecting(true)}>
        Reject
      </Button>
    </div>
  );
}
