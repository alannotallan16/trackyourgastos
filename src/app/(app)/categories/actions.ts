"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CatSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(40)
});

export async function saveCategory(payload: z.infer<typeof CatSchema>) {
  const parsed = CatSchema.parse(payload);
  const supabase = createClient();
  if (parsed.id) {
    const { error } = await supabase.from("categories").update({ name: parsed.name }).eq("id", parsed.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("categories").insert({ name: parsed.name });
    if (error) throw error;
  }
  revalidatePath("/categories");
}

export async function deleteCategory(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/categories");
}

const RuleSchema = z.object({
  id: z.string().uuid().optional(),
  keyword: z.string().min(1),
  suggested_category_id: z.string().uuid().nullable().optional(),
  suggested_split_preset_id: z.string().uuid().nullable().optional()
});

export async function saveRule(payload: z.infer<typeof RuleSchema>) {
  const parsed = RuleSchema.parse(payload);
  const supabase = createClient();
  if (parsed.id) {
    const { error } = await supabase.from("merchant_rules").update({
      keyword: parsed.keyword,
      suggested_category_id: parsed.suggested_category_id ?? null,
      suggested_split_preset_id: parsed.suggested_split_preset_id ?? null
    }).eq("id", parsed.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("merchant_rules").insert({
      keyword: parsed.keyword,
      suggested_category_id: parsed.suggested_category_id ?? null,
      suggested_split_preset_id: parsed.suggested_split_preset_id ?? null
    });
    if (error) throw error;
  }
  revalidatePath("/categories");
}

export async function deleteRule(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("merchant_rules").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/categories");
}
