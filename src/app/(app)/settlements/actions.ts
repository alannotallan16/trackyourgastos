"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Schema = z.object({
  from_user_id: z.string().uuid(),
  to_user_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  currency: z.string().default("PHP"),
  settled_on: z.string().min(1),
  notes: z.string().nullable().optional()
});

export type SettlementPayload = z.infer<typeof Schema>;

export async function saveSettlement(payload: SettlementPayload) {
  const parsed = Schema.parse(payload);
  if (parsed.from_user_id === parsed.to_user_id) throw new Error("Payer and recipient must differ");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase.from("settlements").insert({
    ...parsed,
    notes: parsed.notes ?? null,
    created_by: user.id
  });
  if (error) throw error;
  revalidatePath("/settlements");
  revalidatePath("/dashboard");
}

export async function deleteSettlement(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("settlements").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/settlements");
  revalidatePath("/dashboard");
}
