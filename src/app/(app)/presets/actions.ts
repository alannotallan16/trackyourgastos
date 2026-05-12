"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const MemberSchema = z.object({
  user_id: z.string().uuid(),
  percentage: z.coerce.number().nullable().optional(),
  fixed_amount: z.coerce.number().nullable().optional()
});

const PresetSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  split_type: z.enum(["equal", "percentage", "fixed"]),
  members: z.array(MemberSchema).min(1)
});

export type PresetPayload = z.infer<typeof PresetSchema>;

export async function savePreset(payload: PresetPayload) {
  const parsed = PresetSchema.parse(payload);
  const supabase = createClient();
  let id = parsed.id;
  if (id) {
    const { error } = await supabase.from("split_presets").update({
      name: parsed.name,
      description: parsed.description ?? null,
      split_type: parsed.split_type
    }).eq("id", id);
    if (error) throw error;
    await supabase.from("split_preset_members").delete().eq("preset_id", id);
  } else {
    const { data, error } = await supabase.from("split_presets").insert({
      name: parsed.name,
      description: parsed.description ?? null,
      split_type: parsed.split_type
    }).select("id").single();
    if (error) throw error;
    id = data!.id;
  }
  const rows = parsed.members.map((m) => ({
    preset_id: id!,
    user_id: m.user_id,
    percentage: m.percentage ?? null,
    fixed_amount: m.fixed_amount ?? null
  }));
  const { error: mErr } = await supabase.from("split_preset_members").insert(rows);
  if (mErr) throw mErr;
  revalidatePath("/presets");
}

export async function deletePreset(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("split_presets").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/presets");
}
