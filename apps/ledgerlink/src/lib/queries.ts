import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toCentavos } from "@/lib/money";
import type {
  Contact,
  Direction,
  Installment,
  InstallmentLedger,
  Invoice,
  LinkCoverage,
  Obligation,
  ObligationLedger,
  Payment,
  Profile,
} from "@/lib/types";
import { startOfMonth, endOfMonth, addMonths, parseISO } from "date-fns";

function monthBounds(base = new Date()) {
  return { start: startOfMonth(base), end: endOfMonth(base) };
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function listObligations(direction?: Direction): Promise<ObligationLedger[]> {
  const supabase = createSupabaseServerClient();
  let q = supabase.from("obligation_ledger").select("*").order("start_date", { ascending: false });
  if (direction) q = q.eq("direction", direction);
  const { data } = await q.returns<ObligationLedger[]>();
  return data ?? [];
}

export async function getObligationDetail(id: string) {
  const supabase = createSupabaseServerClient();
  const [{ data: obligation }, { data: ledger }, { data: installments }, { data: payments }, { data: links }] =
    await Promise.all([
      supabase.from("obligations").select("*").eq("id", id).maybeSingle().returns<Obligation>(),
      supabase.from("obligation_ledger").select("*").eq("id", id).maybeSingle().returns<ObligationLedger>(),
      supabase.from("installment_ledger").select("*").eq("obligation_id", id).order("seq").returns<InstallmentLedger[]>(),
      supabase
        .from("payments")
        .select("*")
        .eq("obligation_id", id)
        .order("paid_at", { ascending: false })
        .returns<Payment[]>(),
      supabase
        .from("link_coverage")
        .select("*")
        .or(`source_obligation_id.eq.${id},target_obligation_id.eq.${id}`)
        .returns<LinkCoverage[]>(),
    ]);
  return {
    obligation: obligation ?? null,
    ledger: ledger ?? null,
    installments: installments ?? [],
    payments: payments ?? [],
    links: links ?? [],
  };
}

export async function listContacts(): Promise<Contact[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("contacts").select("*").order("name").returns<Contact[]>();
  return data ?? [];
}

export async function getContactDetail(id: string) {
  const supabase = createSupabaseServerClient();
  const [{ data: contact }, { data: obligations }] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", id).maybeSingle().returns<Contact>(),
    supabase.from("obligation_ledger").select("*").eq("contact_id", id).order("start_date", { ascending: false }).returns<ObligationLedger[]>(),
  ]);
  return { contact: contact ?? null, obligations: obligations ?? [] };
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("*").maybeSingle().returns<Profile>();
  return data ?? null;
}

export async function listPayments(status?: "pending" | "approved" | "rejected"): Promise<
  (Payment & { obligation: { name: string; counterparty_name: string } | null })[]
> {
  const supabase = createSupabaseServerClient();
  let q = supabase
    .from("payments")
    .select("*, obligation:obligations(name, counterparty_name)")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return (data as any) ?? [];
}

export async function listInvoices(): Promise<(Invoice & { contact: { name: string } | null })[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("invoices")
    .select("*, contact:contacts(name)")
    .order("created_at", { ascending: false });
  return (data as any) ?? [];
}

export async function getInvoiceById(
  id: string,
): Promise<(Invoice & { contact: { name: string } | null; obligation: { name: string } | null }) | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("invoices")
    .select("*, contact:contacts(name), obligation:obligations(name)")
    .eq("id", id)
    .maybeSingle();
  return (data as any) ?? null;
}

export async function listLinks(): Promise<LinkCoverage[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("link_coverage").select("*").returns<LinkCoverage[]>();
  return data ?? [];
}

export async function listInstallmentsInRange(from: Date, to: Date) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("installment_ledger")
    .select("*, obligation:obligations(name, direction, counterparty_name)")
    .gte("due_date", iso(from))
    .lte("due_date", iso(to))
    .order("due_date");
  return (data as any as (InstallmentLedger & {
    obligation: { name: string; direction: Direction; counterparty_name: string };
  })[]) ?? [];
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

export async function getDashboard() {
  const supabase = createSupabaseServerClient();
  const { start, end } = monthBounds();

  const [ledgers, upcoming, pending, monthPayments, links] = await Promise.all([
    listObligations(),
    supabase
      .from("installment_ledger")
      .select("*, obligation:obligations(name, direction, counterparty_name)")
      .in("status", ["due", "overdue", "upcoming", "partial"])
      .gte("due_date", iso(start))
      .lte("due_date", iso(addMonths(end, 1)))
      .order("due_date")
      .limit(12),
    listPayments("pending"),
    supabase
      .from("payments")
      .select("amount, direction, status, paid_at")
      .eq("status", "approved")
      .gte("paid_at", iso(start))
      .lte("paid_at", iso(end)),
    listLinks(),
  ]);

  const active = ledgers.filter((o) => o.status !== "cancelled");
  const owedToMe = active.filter((o) => o.direction === "owed_to_me");
  const iOwe = active.filter((o) => o.direction === "i_owe");

  const sumRemaining = (arr: ObligationLedger[]) => arr.reduce((a, o) => a + toCentavos(o.remaining), 0);
  const sumOverdue = (arr: ObligationLedger[]) => arr.reduce((a, o) => a + toCentavos(o.overdue_amount), 0);

  const upcomingRows =
    (upcoming.data as any as (InstallmentLedger & {
      obligation: { name: string; direction: Direction; counterparty_name: string };
    })[]) ?? [];

  const dueThisMonth = upcomingRows
    .filter((r) => {
      const d = parseISO(r.due_date);
      return d >= start && d <= end;
    })
    .reduce(
      (acc, r) => {
        const rem = toCentavos(r.remaining);
        if (r.obligation.direction === "owed_to_me") acc.incoming += rem;
        else acc.outgoing += rem;
        return acc;
      },
      { incoming: 0, outgoing: 0 },
    );

  const monthFlow = (monthPayments.data ?? []).reduce(
    (acc: { collected: number; paid: number }, p: any) => {
      const c = toCentavos(p.amount);
      if (p.direction === "owed_to_me") acc.collected += c;
      else acc.paid += c;
      return acc;
    },
    { collected: 0, paid: 0 },
  );

  const topOwedToMe = [...owedToMe].sort((a, b) => toCentavos(b.remaining) - toCentavos(a.remaining)).slice(0, 5);
  const topIOwe = [...iOwe].sort((a, b) => toCentavos(b.remaining) - toCentavos(a.remaining)).slice(0, 5);

  return {
    totals: {
      owedToMe: sumRemaining(owedToMe),
      iOwe: sumRemaining(iOwe),
      overdue: sumOverdue(active),
      dueThisMonthIncoming: dueThisMonth.incoming,
      dueThisMonthOutgoing: dueThisMonth.outgoing,
      collected: monthFlow.collected,
      paid: monthFlow.paid,
    },
    upcoming: upcomingRows,
    pending,
    links,
    topOwedToMe,
    topIOwe,
    counts: { owedToMe: owedToMe.length, iOwe: iOwe.length },
  };
}
