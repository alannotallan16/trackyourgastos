-- LedgerLink — 0001 schema
-- Money is NUMERIC(20,4). Never float. Ids are uuid. Every user-owned table
-- carries owner_id -> profiles.id and is locked down by RLS in 0002.

create extension if not exists "pgcrypto";

-- ---------- enums ----------
do $$ begin
  create type direction as enum ('owed_to_me', 'i_owe');
exception when duplicate_object then null; end $$;

do $$ begin
  create type interest_type as enum ('none', 'flat_factor', 'simple', 'amortized');
exception when duplicate_object then null; end $$;

do $$ begin
  create type frequency as enum
    ('one_time','weekly','biweekly','monthly','quarterly','semiannual','annual','custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type obligation_status as enum ('active','completed','defaulted','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type installment_override as enum ('none','waived','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum
    ('cash','bank_transfer','gcash','maya','credit_card','debit_card','check','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type submitter as enum ('owner','external');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invoice_status as enum
    ('draft','sent','viewed','partially_paid','paid','overdue','cancelled','disputed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attachment_entity as enum ('obligation','installment','payment','invoice','contact');
exception when duplicate_object then null; end $$;

-- ---------- profiles ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  timezone text not null default 'Asia/Manila',
  default_currency text not null default 'PHP',
  notif_prefs jsonb not null default
    '{"payment_due":true,"overdue":true,"payment_received":true,"proof_submitted":true,"invoice_viewed":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- contacts ----------
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contacts_owner_idx on contacts(owner_id);

-- ---------- categories ----------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  color text not null default '#64748B',
  created_at timestamptz not null default now()
);
create index if not exists categories_owner_idx on categories(owner_id);

-- ---------- obligations (debt accounts) ----------
create table if not exists obligations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  direction direction not null,
  name text not null,
  contact_id uuid references contacts(id) on delete set null,
  counterparty_name text not null default '',
  currency_code text not null default 'PHP',
  principal_original numeric(20,4) not null check (principal_original >= 0),
  interest_rate numeric(12,6),
  interest_type interest_type not null default 'none',
  processing_fee numeric(20,4) not null default 0 check (processing_fee >= 0),
  other_fees numeric(20,4) not null default 0 check (other_fees >= 0),
  start_date date not null default current_date,
  due_date date,
  frequency frequency not null default 'monthly',
  num_installments int check (num_installments is null or num_installments > 0),
  category_id uuid references categories(id) on delete set null,
  grace_period_days int not null default 0 check (grace_period_days >= 0),
  status obligation_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists obligations_owner_idx on obligations(owner_id);
create index if not exists obligations_owner_dir_idx on obligations(owner_id, direction);
create index if not exists obligations_contact_idx on obligations(contact_id);

-- ---------- installments ----------
create table if not exists installments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  obligation_id uuid not null references obligations(id) on delete cascade,
  seq int not null,
  due_date date not null,
  principal_amount numeric(20,4) not null default 0 check (principal_amount >= 0),
  interest_amount numeric(20,4) not null default 0 check (interest_amount >= 0),
  fees_amount numeric(20,4) not null default 0 check (fees_amount >= 0),
  total_amount numeric(20,4) not null check (total_amount >= 0),
  override_status installment_override not null default 'none',
  created_at timestamptz not null default now(),
  unique (obligation_id, seq),
  -- parts must reconcile to the whole (rounding handled in app before insert)
  constraint installment_reconciles
    check (total_amount = principal_amount + interest_amount + fees_amount)
);
create index if not exists installments_obligation_idx on installments(obligation_id, seq);
create index if not exists installments_owner_due_idx on installments(owner_id, due_date);

-- ---------- payments ----------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  obligation_id uuid not null references obligations(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  amount numeric(20,4) not null check (amount > 0),
  currency_code text not null default 'PHP',
  paid_at date not null default current_date,
  method payment_method not null default 'bank_transfer',
  reference text,
  notes text,
  direction direction not null,
  status payment_status not null default 'approved',
  submitted_by submitter not null default 'owner',
  submitter_name text,
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payments_owner_idx on payments(owner_id);
create index if not exists payments_obligation_idx on payments(obligation_id, status);
create index if not exists payments_status_idx on payments(owner_id, status);

-- ---------- payment_allocations ----------
create table if not exists payment_allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  payment_id uuid not null references payments(id) on delete cascade,
  installment_id uuid not null references installments(id) on delete cascade,
  amount numeric(20,4) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, installment_id)
);
create index if not exists alloc_payment_idx on payment_allocations(payment_id);
create index if not exists alloc_installment_idx on payment_allocations(installment_id);

-- ---------- invoices ----------
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  obligation_id uuid references obligations(id) on delete set null,
  installment_id uuid references installments(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  number text not null,
  title text not null default '',
  amount numeric(20,4) not null check (amount > 0),
  currency_code text not null default 'PHP',
  due_date date,
  status invoice_status not null default 'draft',
  public_token text not null unique,
  notes text,
  sent_at timestamptz,
  viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, number)
);
create index if not exists invoices_owner_idx on invoices(owner_id, status);
create index if not exists invoices_token_idx on invoices(public_token);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  amount numeric(20,4) not null check (amount >= 0),
  created_at timestamptz not null default now()
);
create index if not exists invoice_items_invoice_idx on invoice_items(invoice_id);

-- ---------- attachments (documents + payment proofs) ----------
create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  entity_type attachment_entity not null,
  entity_id uuid not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by submitter not null default 'owner',
  created_at timestamptz not null default now()
);
create index if not exists attachments_entity_idx on attachments(owner_id, entity_type, entity_id);

-- ---------- linked_obligations ----------
create table if not exists linked_obligations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  source_obligation_id uuid not null references obligations(id) on delete cascade, -- owed_to_me (incoming)
  target_obligation_id uuid not null references obligations(id) on delete cascade, -- i_owe (outgoing)
  note text,
  created_at timestamptz not null default now(),
  unique (source_obligation_id, target_obligation_id),
  check (source_obligation_id <> target_obligation_id)
);
create index if not exists links_owner_idx on linked_obligations(owner_id);

-- ---------- notifications ----------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_owner_idx on notifications(owner_id, read_at);

-- ---------- audit_logs ----------
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  actor uuid,
  actor_label text not null default 'owner',
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_owner_idx on audit_logs(owner_id, created_at desc);
create index if not exists audit_entity_idx on audit_logs(entity_type, entity_id);
