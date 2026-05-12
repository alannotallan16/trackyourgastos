import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const merchant = (searchParams.get("merchant") ?? "").trim();
  const date = searchParams.get("date");
  const total = Number(searchParams.get("total"));
  if (!merchant || !date || !total) return NextResponse.json({ duplicates: [] });

  const start = new Date(date);
  const end = new Date(date);
  start.setDate(start.getDate() - 1);
  end.setDate(end.getDate() + 1);
  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("expenses")
    .select("id, merchant, expense_date, total_amount")
    .gte("expense_date", startIso)
    .lte("expense_date", endIso)
    .ilike("merchant", `%${merchant}%`);

  const dupes = (data ?? []).filter((e: any) => Math.abs(Number(e.total_amount) - total) < 0.5);
  return NextResponse.json({ duplicates: dupes });
}
