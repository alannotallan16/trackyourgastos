// Domain types shared across the app. DB rows arrive from Supabase as `any` and
// are cast to these via `.returns<T>()` at the query site.

export type Direction = "owed_to_me" | "i_owe";
export type InterestType = "none" | "flat_factor" | "simple" | "amortized";
export type Frequency =
  | "one_time" | "weekly" | "biweekly" | "monthly"
  | "quarterly" | "semiannual" | "annual" | "custom";
export type ObligationStatus = "active" | "completed" | "defaulted" | "cancelled";
export type PaymentMethod =
  | "cash" | "bank_transfer" | "gcash" | "maya"
  | "credit_card" | "debit_card" | "check" | "other";
export type PaymentStatus = "pending" | "approved" | "rejected";
export type InvoiceStatus =
  | "draft" | "sent" | "viewed" | "partially_paid"
  | "paid" | "overdue" | "cancelled" | "disputed";
export type InstallmentStatus =
  | "upcoming" | "due" | "partial" | "paid" | "overdue" | "waived" | "cancelled";
export type CoverageStatus = "covered" | "partially_covered" | "underfunded";

export type Contact = {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

export type Obligation = {
  id: string;
  owner_id: string;
  direction: Direction;
  name: string;
  contact_id: string | null;
  counterparty_name: string;
  currency_code: string;
  principal_original: string;
  interest_rate: string | null;
  interest_type: InterestType;
  processing_fee: string;
  other_fees: string;
  start_date: string;
  due_date: string | null;
  frequency: Frequency;
  num_installments: number | null;
  category_id: string | null;
  grace_period_days: number;
  status: ObligationStatus;
  notes: string | null;
  created_at: string;
};

// obligation_ledger view (authoritative balances)
export type ObligationLedger = {
  id: string;
  owner_id: string;
  direction: Direction;
  name: string;
  counterparty_name: string;
  contact_id: string | null;
  currency_code: string;
  status: ObligationStatus;
  principal_original: string;
  start_date: string;
  due_date: string | null;
  scheduled_total: string;
  installment_count: number;
  paid_total: string;
  overdue_amount: string;
  remaining: string;
  progress_pct: string;
  next_due_date: string | null;
  next_due_amount: string | null;
};

export type Installment = {
  id: string;
  owner_id: string;
  obligation_id: string;
  seq: number;
  due_date: string;
  principal_amount: string;
  interest_amount: string;
  fees_amount: string;
  total_amount: string;
  override_status: "none" | "waived" | "cancelled";
};

// installment_ledger view
export type InstallmentLedger = Omit<Installment, "override_status" | "total_amount"> & {
  total_due: string;
  paid: string;
  remaining: string;
  status: InstallmentStatus;
};

export type Payment = {
  id: string;
  owner_id: string;
  obligation_id: string;
  contact_id: string | null;
  amount: string;
  currency_code: string;
  paid_at: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  direction: Direction;
  status: PaymentStatus;
  submitted_by: "owner" | "external";
  submitter_name: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type Invoice = {
  id: string;
  owner_id: string;
  obligation_id: string | null;
  installment_id: string | null;
  contact_id: string | null;
  number: string;
  title: string;
  amount: string;
  currency_code: string;
  due_date: string | null;
  status: InvoiceStatus;
  public_token: string;
  notes: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  created_at: string;
};

export type LinkCoverage = {
  id: string;
  owner_id: string;
  source_obligation_id: string;
  target_obligation_id: string;
  note: string | null;
  source_name: string;
  source_counterparty: string;
  target_name: string;
  target_counterparty: string;
  incoming_expected: string;
  outgoing_due: string;
  incoming_received: string;
  coverage_pct: string | null;
  shortfall: string;
  coverage_status: CoverageStatus;
};

export type Profile = {
  id: string;
  display_name: string;
  timezone: string;
  default_currency: string;
  notif_prefs: Record<string, boolean>;
};

export type Attachment = {
  id: string;
  owner_id: string;
  entity_type: "obligation" | "installment" | "payment" | "invoice" | "contact";
  entity_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: "owner" | "external";
  created_at: string;
};

export type Notification = {
  id: string;
  owner_id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};
