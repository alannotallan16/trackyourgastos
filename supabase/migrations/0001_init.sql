-- ============================================================================
-- TrackYourGastos: initial schema
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: maps Supabase auth.users to display names (Alan, Mari Cel, Mari Len)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  short_name text not null unique,        -- 'alan' | 'cel' | 'len'
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text,
  color text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- split presets (e.g. "Equal 3-way", "Alan only", "Cel/Len 50/50")
-- ---------------------------------------------------------------------------
create table if not exists public.split_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  split_type text not null check (split_type in ('equal','percentage','fixed')),
  created_at timestamptz not null default now()
);

create table if not exists public.split_preset_members (
  preset_id uuid not null references public.split_presets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  percentage numeric(7,4),
  fixed_amount numeric(14,2),
  primary key (preset_id, user_id)
);

-- ---------------------------------------------------------------------------
-- merchant rules (keyword -> suggested category + split preset)
-- ---------------------------------------------------------------------------
create table if not exists public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  suggested_category_id uuid references public.categories(id) on delete set null,
  suggested_split_preset_id uuid references public.split_presets(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists merchant_rules_keyword_idx on public.merchant_rules (lower(keyword));

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  merchant text not null,
  total_amount numeric(14,2) not null check (total_amount >= 0),
  currency text not null default 'PHP',
  exchange_rate numeric(14,6),     -- to PHP; nullable
  category_id uuid references public.categories(id) on delete set null,
  paid_by_user_id uuid not null references public.profiles(id) on delete restrict,
  split_preset_id uuid references public.split_presets(id) on delete set null,
  notes text,
  receipt_file_id uuid,            -- FK added later (circular)
  recurring_expense_id uuid,       -- FK added later
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expenses_date_idx on public.expenses (expense_date desc);
create index if not exists expenses_paid_by_idx on public.expenses (paid_by_user_id);
create index if not exists expenses_category_idx on public.expenses (category_id);

-- ---------------------------------------------------------------------------
-- expense_splits: per-user calculated share for one expense
-- ---------------------------------------------------------------------------
create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  split_type text not null check (split_type in ('equal','percentage','fixed')),
  percentage numeric(7,4),
  fixed_amount numeric(14,2),
  calculated_amount numeric(14,2) not null,
  unique (expense_id, user_id)
);
create index if not exists expense_splits_user_idx on public.expense_splits (user_id);

-- ---------------------------------------------------------------------------
-- receipt_files
-- ---------------------------------------------------------------------------
create table if not exists public.receipt_files (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  file_name text,
  mime_type text,
  size_bytes integer,
  ocr_text text,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.expenses
  add constraint expenses_receipt_file_fk
  foreign key (receipt_file_id) references public.receipt_files(id) on delete set null;

-- ---------------------------------------------------------------------------
-- recurring_expenses
-- ---------------------------------------------------------------------------
create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  merchant text not null,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(14,2) not null,
  currency text not null default 'PHP',
  paid_by_user_id uuid not null references public.profiles(id) on delete restrict,
  split_preset_id uuid references public.split_presets(id) on delete set null,
  frequency text not null check (frequency in ('weekly','monthly','yearly')),
  next_due_date date not null,
  active boolean not null default true,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recurring_next_due_idx on public.recurring_expenses (next_due_date) where active;

alter table public.expenses
  add constraint expenses_recurring_fk
  foreign key (recurring_expense_id) references public.recurring_expenses(id) on delete set null;

-- ---------------------------------------------------------------------------
-- settlements
-- ---------------------------------------------------------------------------
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id) on delete restrict,
  to_user_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'PHP',
  settled_on date not null default current_date,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);
create index if not exists settlements_date_idx on public.settlements (settled_on desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_expenses_touch on public.expenses;
create trigger trg_expenses_touch before update on public.expenses
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_recurring_touch on public.recurring_expenses;
create trigger trg_recurring_touch before update on public.recurring_expenses
  for each row execute function public.touch_updated_at();
