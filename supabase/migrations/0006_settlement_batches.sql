-- ============================================================================
-- Settlement batches (replaces single-pair settlements)
--
-- A batch represents one "household reconciliation event" — the user picks a
-- group of expenses, the app computes each person's net across that group,
-- generates minimum payments to bring everyone to zero, and stores them as
-- separate result rows under the batch. Each generated payment can be
-- individually paid down via settlement_payments.
--
--   settlement_batches            one row per reconciliation
--     └─ settlement_batch_items   one row per included expense_split
--     └─ settlement_batch_results one row per generated debtor→creditor payment
--           └─ settlement_payments one row per recorded real-world payment
--
-- This migration drops the old settlements / settlement_items /
-- settlement_payments tables (user-approved clean slate). expense_splits
-- gains settlement_batch_id (replacing settlement_id) — the columns
-- settlement_status / settled_at survive with the same semantics.
--
-- Run AFTER 0005_settlements_v2.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Drop the legacy tables (clean slate per direction)
-- ---------------------------------------------------------------------------
drop table if exists public.settlement_payments cascade;
drop table if exists public.settlement_items cascade;
drop table if exists public.settlements cascade;

drop function if exists public.set_settlement_number() cascade;
drop function if exists public.next_settlement_number() cascade;
drop sequence if exists public.settlement_number_seq cascade;

-- Reset expense_splits to "unsettled" since their old references are gone.
alter table public.expense_splits drop column if exists settlement_id;
alter table public.expense_splits
  add column if not exists settlement_batch_id uuid;

update public.expense_splits
  set settlement_status = 'unpaid',
      settlement_batch_id = null,
      settled_at = null;

-- ---------------------------------------------------------------------------
-- settlement_batches
-- ---------------------------------------------------------------------------
create table public.settlement_batches (
  id uuid primary key default gen_random_uuid(),
  settlement_number text not null unique,
  status text not null default 'open'
    check (status in ('open','partially_paid','paid','cancelled')),
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index settlement_batches_status_idx on public.settlement_batches (status);

create sequence public.settlement_batch_number_seq start 1;

create or replace function public.next_settlement_batch_number()
returns text language sql volatile as $$
  select 'ST-' || lpad(nextval('public.settlement_batch_number_seq')::text, 4, '0');
$$;

create or replace function public.set_settlement_batch_number()
returns trigger language plpgsql as $$
begin
  if new.settlement_number is null then
    new.settlement_number := public.next_settlement_batch_number();
  end if;
  return new;
end $$;

drop trigger if exists trg_set_settlement_batch_number on public.settlement_batches;
create trigger trg_set_settlement_batch_number before insert on public.settlement_batches
  for each row execute function public.set_settlement_batch_number();

drop trigger if exists trg_settlement_batches_touch on public.settlement_batches;
create trigger trg_settlement_batches_touch before update on public.settlement_batches
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- settlement_batch_items: every expense_split included in a batch
-- (denormalised user_id + share_amount makes batch summaries cheap to query)
-- ---------------------------------------------------------------------------
create table public.settlement_batch_items (
  id uuid primary key default gen_random_uuid(),
  settlement_batch_id uuid not null references public.settlement_batches(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  expense_split_id uuid not null references public.expense_splits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  share_amount numeric(14,2) not null check (share_amount >= 0),
  created_at timestamptz not null default now(),
  unique (settlement_batch_id, expense_split_id)
);
create index settlement_batch_items_batch_idx on public.settlement_batch_items (settlement_batch_id);
create index settlement_batch_items_expense_idx on public.settlement_batch_items (expense_id);
create index settlement_batch_items_split_idx on public.settlement_batch_items (expense_split_id);

-- ---------------------------------------------------------------------------
-- settlement_batch_results: generated debtor → creditor payments
-- ---------------------------------------------------------------------------
create table public.settlement_batch_results (
  id uuid primary key default gen_random_uuid(),
  settlement_batch_id uuid not null references public.settlement_batches(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id) on delete restrict,
  to_user_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  remaining_amount numeric(14,2) not null,
  currency text not null default 'PHP',
  status text not null default 'open'
    check (status in ('open','partially_paid','paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);
create index settlement_batch_results_batch_idx on public.settlement_batch_results (settlement_batch_id);
create index settlement_batch_results_status_idx on public.settlement_batch_results (status);

drop trigger if exists trg_settlement_batch_results_touch on public.settlement_batch_results;
create trigger trg_settlement_batch_results_touch before update on public.settlement_batch_results
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- settlement_payments: recreated with FK to batch_result
-- ---------------------------------------------------------------------------
create table public.settlement_payments (
  id uuid primary key default gen_random_uuid(),
  settlement_batch_result_id uuid not null references public.settlement_batch_results(id) on delete cascade,
  payment_date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'PHP',
  payment_method text,
  notes text,
  reference_number text,
  attachment_path text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index settlement_payments_result_idx on public.settlement_payments (settlement_batch_result_id);
create index settlement_payments_date_idx on public.settlement_payments (payment_date desc);

-- ---------------------------------------------------------------------------
-- expense_splits.settlement_batch_id FK (set after table exists)
-- ---------------------------------------------------------------------------
alter table public.expense_splits
  add constraint expense_splits_settlement_batch_fk
  foreign key (settlement_batch_id) references public.settlement_batches(id) on delete set null;

create index if not exists expense_splits_settlement_batch_idx
  on public.expense_splits (settlement_batch_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.settlement_batches enable row level security;
alter table public.settlement_batch_items enable row level security;
alter table public.settlement_batch_results enable row level security;
alter table public.settlement_payments enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'settlement_batches', 'settlement_batch_items',
    'settlement_batch_results', 'settlement_payments'
  ] loop
    execute format('drop policy if exists "household read %1$s" on public.%1$s', t);
    execute format(
      'create policy "household read %1$s" on public.%1$s for select using (public.is_household_member())',
      t
    );
    execute format('drop policy if exists "household write %1$s" on public.%1$s', t);
    execute format(
      'create policy "household write %1$s" on public.%1$s for all using (public.is_household_member()) with check (public.is_household_member())',
      t
    );
  end loop;
end $$;
