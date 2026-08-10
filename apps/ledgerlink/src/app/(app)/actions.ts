"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toCentavos, toDecimalString } from "@/lib/money";
import {
  generateAmortized,
  generateFlatFactor,
  generateFlatNoInterest,
  allocatePayment,
  type InstallmentRow,
  type Allocatable,
} from "@/lib/schedule";
import type { Direction, InterestType, Frequency } from "@/lib/types";
import { addDays, addWeeks, addMonths, addQuarters, addYears, parseISO } from "date-fns";
import { randomBytes } from "crypto";

async function requireUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

function stepDate(base: Date, freq: Frequency, i: number): Date {
  switch (freq) {
    case "weekly": return addWeeks(base, i);
    case "biweekly": return addWeeks(base, i * 2);
    case "monthly": return addMonths(base, i);
    case "quarterly": return addQuarters(base, i);
    case "semiannual": return addMonths(base, i * 6);
    case "annual": return addYears(base, i);
    default: return addMonths(base, i);
  }
}

/** Parse a pasted schedule. One row per line: `date, total[, principal, interest, fees]`. */
function parseManualSchedule(text: string): InstallmentRow[] & { _dates: string[] } {
  const rows: InstallmentRow[] = [];
  const dates: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, idx) => {
    const parts = line.split(/[,\t]/).map((p) => p.trim());
    const date = parts[0];
    const total = toCentavos(parts[1] ?? "0");
    const principal = parts[2] !== undefined && parts[2] !== "" ? toCentavos(parts[2]) : total;
    const interest = parts[3] !== undefined && parts[3] !== "" ? toCentavos(parts[3]) : total - principal;
    const fees = parts[4] !== undefined && parts[4] !== "" ? toCentavos(parts[4]) : 0;
    rows.push({ seq: idx + 1, principal, interest, fees, total: principal + interest + fees });
    dates.push(date);
  });
  (rows as any)._dates = dates;
  return rows as any;
}

const obligationSchema = z.object({
  direction: z.enum(["owed_to_me", "i_owe"]),
  name: z.string().min(1),
  counterparty_name: z.string().min(1),
  contact_id: z.string().uuid().optional().or(z.literal("")),
  currency_code: z.string().default("PHP"),
  principal: z.string(),
  interest_rate: z.string().optional(),
  interest_type: z.enum(["none", "flat_factor", "simple", "amortized"]),
  processing_fee: z.string().optional(),
  other_fees: z.string().optional(),
  start_date: z.string(),
  frequency: z.enum(["one_time", "weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual", "custom"]),
  num_installments: z.string().optional(),
  grace_period_days: z.string().optional(),
  notes: z.string().optional(),
  schedule_mode: z.enum(["single", "generate", "manual"]),
  manual_schedule: z.string().optional(),
});

export async function createObligationAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = obligationSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.errors[0].message);
  const d = parsed.data;

  const principalC = toCentavos(d.principal);
  const feeC = toCentavos(d.processing_fee ?? "0");
  const otherC = toCentavos(d.other_fees ?? "0");
  const n = Math.max(1, parseInt(d.num_installments || "1", 10) || 1);
  const start = parseISO(d.start_date);

  // Build the schedule rows first so we can validate reconciliation.
  let rows: InstallmentRow[] = [];
  let dates: string[] = [];
  if (d.schedule_mode === "manual" && d.manual_schedule?.trim()) {
    const parsedRows = parseManualSchedule(d.manual_schedule);
    rows = parsedRows;
    dates = (parsedRows as any)._dates;
  } else if (d.schedule_mode === "generate" && d.frequency !== "one_time") {
    if (d.interest_type === "amortized") {
      const rate = (parseFloat(d.interest_rate || "0") || 0) / 100 / 12;
      rows = generateAmortized(principalC, rate, n);
    } else if (d.interest_type === "flat_factor") {
      const factor = (parseFloat(d.interest_rate || "0") || 0) / 100;
      rows = generateFlatFactor(principalC, factor, n);
    } else {
      rows = generateFlatNoInterest(principalC, n);
    }
    dates = rows.map((_, i) => stepDate(start, d.frequency, i).toISOString().slice(0, 10));
    // spread fees onto the first installment
    if (feeC + otherC > 0 && rows[0]) {
      rows[0] = { ...rows[0], fees: feeC + otherC, total: rows[0].total + feeC + otherC };
    }
  } else {
    // single installment
    const total = principalC + feeC + otherC;
    rows = [{ seq: 1, principal: principalC, interest: 0, fees: feeC + otherC, total }];
    dates = [d.start_date];
  }

  const { data: obligation, error } = await supabase
    .from("obligations")
    .insert({
      owner_id: userId,
      direction: d.direction as Direction,
      name: d.name,
      counterparty_name: d.counterparty_name,
      contact_id: d.contact_id || null,
      currency_code: d.currency_code || "PHP",
      principal_original: toDecimalString(principalC),
      interest_rate: d.interest_rate ? d.interest_rate : null,
      interest_type: d.interest_type as InterestType,
      processing_fee: toDecimalString(feeC),
      other_fees: toDecimalString(otherC),
      start_date: d.start_date,
      frequency: d.frequency as Frequency,
      num_installments: rows.length,
      grace_period_days: parseInt(d.grace_period_days || "0", 10) || 0,
      notes: d.notes || null,
    })
    .select("id")
    .single();
  if (error || !obligation) throw new Error(error?.message ?? "Failed to create obligation");

  if (rows.length) {
    const insertRows = rows.map((r, i) => ({
      owner_id: userId,
      obligation_id: obligation.id,
      seq: i + 1,
      due_date: dates[i] || d.start_date,
      principal_amount: toDecimalString(r.principal),
      interest_amount: toDecimalString(r.interest),
      fees_amount: toDecimalString(r.fees),
      total_amount: toDecimalString(r.total),
    }));
    const { error: insErr } = await supabase.from("installments").insert(insertRows);
    if (insErr) throw new Error(insErr.message);
  }

  revalidatePath("/obligations");
  revalidatePath("/dashboard");
  redirect(`/obligations/${obligation.id}`);
}

const paymentSchema = z.object({
  obligation_id: z.string().uuid(),
  amount: z.string(),
  paid_at: z.string(),
  method: z.enum(["cash", "bank_transfer", "gcash", "maya", "credit_card", "debit_card", "check", "other"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
  installment_id: z.string().optional(),
});

/** Owner records a payment (auto-approved) and it's allocated across installments. */
export async function recordPaymentAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.errors[0].message);
  const p = parsed.data;
  const amountC = toCentavos(p.amount);
  if (amountC <= 0) throw new Error("Amount must be greater than zero");

  const { data: obligation } = await supabase
    .from("obligations")
    .select("id, direction")
    .eq("id", p.obligation_id)
    .single();
  if (!obligation) throw new Error("Obligation not found");

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      owner_id: userId,
      obligation_id: p.obligation_id,
      amount: toDecimalString(amountC),
      paid_at: p.paid_at,
      method: p.method,
      reference: p.reference || null,
      notes: p.notes || null,
      direction: obligation.direction,
      status: "approved",
      submitted_by: "owner",
      reviewed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !payment) throw new Error(error?.message ?? "Failed to record payment");

  await allocateApprovedPayment(supabase, userId, p.obligation_id, payment.id, amountC, p.installment_id);

  revalidatePath(`/obligations/${p.obligation_id}`);
  revalidatePath("/dashboard");
  revalidatePath("/payments");
}

/** Approve or reject a submitted (pending) payment. */
export async function reviewPaymentAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const paymentId = String(formData.get("payment_id"));
  const decision = String(formData.get("decision"));
  const reason = String(formData.get("reason") ?? "");

  const { data: payment } = await supabase
    .from("payments")
    .select("id, obligation_id, amount, status")
    .eq("id", paymentId)
    .single();
  if (!payment) throw new Error("Payment not found");
  if (payment.status !== "pending") throw new Error("Payment already reviewed");

  if (decision === "approve") {
    await supabase
      .from("payments")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", paymentId);
    await allocateApprovedPayment(supabase, userId, payment.obligation_id, payment.id, toCentavos(payment.amount));
    await supabase.from("notifications").insert({
      owner_id: userId,
      type: "payment_approved",
      title: "Payment approved",
      entity_type: "payment",
      entity_id: paymentId,
    });
  } else {
    if (!reason.trim()) throw new Error("A rejection reason is required");
    await supabase
      .from("payments")
      .update({ status: "rejected", rejection_reason: reason, reviewed_at: new Date().toISOString() })
      .eq("id", paymentId);
  }

  revalidatePath("/payments");
  revalidatePath(`/obligations/${payment.obligation_id}`);
  revalidatePath("/dashboard");
}

/** Allocate an approved payment FIFO across unpaid installments (or a chosen one first). */
async function allocateApprovedPayment(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  obligationId: string,
  paymentId: string,
  amountC: number,
  preferredInstallmentId?: string,
) {
  const { data: ledger } = await supabase
    .from("installment_ledger")
    .select("id, seq, remaining, status")
    .eq("obligation_id", obligationId)
    .order("seq");
  const rows = (ledger ?? []) as { id: string; seq: number; remaining: string; status: string }[];

  const targets: Allocatable[] = rows
    .filter((r) => r.status !== "waived" && r.status !== "cancelled" && toCentavos(r.remaining) > 0)
    .map((r) => ({ id: r.id, remaining: toCentavos(r.remaining) }));

  // If a specific installment was chosen, put it first.
  if (preferredInstallmentId) {
    targets.sort((a, b) => (a.id === preferredInstallmentId ? -1 : b.id === preferredInstallmentId ? 1 : 0));
  }

  const { allocations } = allocatePayment(amountC, targets);
  if (allocations.length) {
    await supabase.from("payment_allocations").insert(
      allocations.map((a) => ({
        owner_id: userId,
        payment_id: paymentId,
        installment_id: a.installmentId,
        amount: toDecimalString(a.amount),
      })),
    );
  }
}

/* -------------------------------- contacts -------------------------------- */
export async function createContactAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");
  await supabase.from("contacts").insert({
    owner_id: userId,
    name,
    email: String(formData.get("email") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
  });
  revalidatePath("/contacts");
}

/* -------------------------------- invoices -------------------------------- */
export async function createInvoiceAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const amountC = toCentavos(String(formData.get("amount") ?? "0"));
  if (amountC <= 0) throw new Error("Amount must be greater than zero");

  // next invoice number
  const { count } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", userId);
  const number = `INV-${String((count ?? 0) + 1).padStart(6, "0")}`;
  const token = randomBytes(24).toString("hex");

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      owner_id: userId,
      obligation_id: String(formData.get("obligation_id") ?? "") || null,
      installment_id: String(formData.get("installment_id") ?? "") || null,
      contact_id: String(formData.get("contact_id") ?? "") || null,
      number,
      title: String(formData.get("title") ?? "") || "Payment request",
      amount: toDecimalString(amountC),
      due_date: String(formData.get("due_date") ?? "") || null,
      status: "sent",
      public_token: token,
      sent_at: new Date().toISOString(),
      notes: String(formData.get("notes") ?? "") || null,
    })
    .select("id")
    .single();
  if (error || !invoice) throw new Error(error?.message ?? "Failed to create invoice");

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function cancelInvoiceAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("invoice_id"));
  await supabase.from("invoices").update({ status: "cancelled" }).eq("id", id);
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
}

/* ----------------------------- linked obligations ----------------------------- */
export async function createLinkAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const source = String(formData.get("source_obligation_id"));
  const target = String(formData.get("target_obligation_id"));
  if (!source || !target || source === target) throw new Error("Pick two different obligations");
  const { error } = await supabase.from("linked_obligations").insert({
    owner_id: userId,
    source_obligation_id: source,
    target_obligation_id: target,
    note: String(formData.get("note") ?? "") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/links");
}

export async function deleteLinkAction(formData: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("linked_obligations").delete().eq("id", String(formData.get("link_id")));
  revalidatePath("/links");
}

/* -------------------------------- settings -------------------------------- */
export async function updateProfileAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  await supabase
    .from("profiles")
    .update({
      display_name: String(formData.get("display_name") ?? ""),
      timezone: String(formData.get("timezone") ?? "Asia/Manila"),
      default_currency: String(formData.get("default_currency") ?? "PHP"),
      notif_prefs: {
        payment_due: formData.get("payment_due") === "on",
        overdue: formData.get("overdue") === "on",
        payment_received: formData.get("payment_received") === "on",
        proof_submitted: formData.get("proof_submitted") === "on",
        invoice_viewed: formData.get("invoice_viewed") === "on",
      },
    })
    .eq("id", userId);
  revalidatePath("/settings");
}

export async function seedDemoAction() {
  const { supabase, userId } = await requireUser();
  await supabase.rpc("seed_demo", { p_owner: userId });
  revalidatePath("/dashboard");
  revalidatePath("/obligations");
  redirect("/dashboard");
}
