import type { MerchantRule } from "./types";

/** Match a merchant name against keyword rules, longest keyword wins. */
export function suggestFromMerchant(
  merchant: string,
  rules: MerchantRule[]
): { category_id: string | null; split_preset_id: string | null } {
  const m = merchant.toLowerCase();
  let best: MerchantRule | null = null;
  for (const r of rules) {
    if (m.includes(r.keyword.toLowerCase())) {
      if (!best || r.keyword.length > best.keyword.length) best = r;
    }
  }
  return {
    category_id: best?.suggested_category_id ?? null,
    split_preset_id: best?.suggested_split_preset_id ?? null
  };
}
