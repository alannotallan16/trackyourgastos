-- ============================================================================
-- Settlements v2: reconciliation flow
--
-- Replaces the simple "settlements = money moved" model with three tables:
--   settlements          -- the agreement (open / partially_paid / paid / cancelled)
--   settlement_items     -- which expense shares are bundled into it
--   settlement_payments  -- individual payments recorded against a settlement
--
-- expense_splits gains settlement_status / settlement_id / settled_at so we
-- can show reconciliation badges in the expenses UI.
--
-- ⚠️ This migration drops all existing settlements rows (user-approved clean
--    slate). Run AFTER 0004_link_profiles.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Wipe old settlements (clean slate approved)
-- ---------------------------------------------------------------------------
truncate table public.settlements restart identity cascade;

-- Drop columns from the legacy schema we no longer use; re-add them with the
-- new shape. Doing this column-by-column to preserve the table & its FKs.
alter table public.settlements
  drop column if exists amount,
  drop column if exists settled_on;

alter table public.settlements
  add column if not exists settlement_number text,
  add column if not exists total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  add column if not exists amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  add column if not exists remaining_amount numeric(14,2) not null default 0,
  add column if not exists status text not null default 'open'
    check (status in ('open','partially_paid','paid','cancelled')),
  add column if not exists updated_at timestamptz not null default now();

-- After the truncate we can safely set settlement_number not null + unique.
alter table public.settlements
  alter column total_amount drop default,
  alter column amount_paid drop default,
  alter column remaining_amount drop default;

-- ---------------------------------------------------------------------------
-- Sequence + helper for settlement_number (ST-0001, ST-0002, …)
-- ---------------------------------------------------------------------------
create sequence if not exists public.settlement_number_seq start 1;

create or replace function public.next_settlement_number()
returns text language sql volatile as $$
  select 'ST-' || lpad(nextval('public.settlement_number_seq')::text, 4, '0');
$$;

-- Default new rows' settlement_number via trigger (idempotent over re-runs)
create or replace function public.set_settlement_number()
returns trigger language plpgsql as $$
begin
  if new.settlement_number is null then
    new.settlement_number := public.next_settlement_number();
  end if;
  return new;
end $$;

drop trigger if exists trg_set_settlement_number on public.settlements;
create trigger trg_set_settlement_number before insert on public.settlements
  for each row execute function public.set_settlement_number();

alter table public.settlements
  add constraint settlements_number_unique unique (settlement_number);

create index if not exists settlements_status_idx on public.settlements (status);
create index if not exists settlements_from_to_idx on public.settlements (from_user_id, to_user_id);

-- Reuse touch_updated_at from 0001_init.sql
drop trigger if exists trg_settlements_touch on public.settlements;
create trigger trg_settlements_touch before update on public.settlements
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- settlement_items: which expense shares are bundled into a settlement
-- ---------------------------------------------------------------------------
create table if not exists public.settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  expense_split_id uuid not null references public.expense_splits(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (settlement_id, expense_split_id)
);
create index if not exists settlement_items_settlement_idx on public.settlement_items (settlement_id);
create index if not exists settlement_items_split_idx on public.settlement_items (expense_split_id);

-- ---------------------------------------------------------------------------
-- settlement_payments: individual payments recorded against a settlement
-- ---------------------------------------------------------------------------
create table if not exists public.settlement_payments (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements(id) on delete cascade,
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
create index if not exists settlement_payments_settlement_idx on public.settlement_payments (settlement_id);
create index if not exists settlement_payments_date_idx on public.settlement_payments (payment_date desc);

-- ---------------------------------------------------------------------------
-- expense_splits: reconciliation status columns
-- ---------------------------------------------------------------------------
alter table public.expense_splits
  add column if not exists settlement_status text not null default 'unpaid'
    check (settlement_status in ('unpaid','in_settlement','settled')),
  add column if not exists settlement_id uuid references public.settlements(id) on delete set null,
  add column if not exists settled_at timestamptz;

create index if not exists expense_splits_settlement_status_idx on public.expense_splits (settlement_status);
create index if not exists expense_splits_settlement_id_idx on public.expense_splits (settlement_id);

-- Reset any rows that were tied to wiped settlements (defensive — truncate
-- cascade should have already cleared them).
update public.expense_splits
  set settlement_status = 'unpaid', settlement_id = null, settled_at = null
  where settlement_id is not null or settlement_status <> 'unpaid';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.settlement_items enable row level security;
alter table public.settlement_payments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settlement_items','settlement_payments'] loop
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
