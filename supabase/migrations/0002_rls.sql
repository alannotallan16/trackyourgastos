-- ============================================================================
-- Row Level Security: only the 3 household profiles can read/write.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.split_presets enable row level security;
alter table public.split_preset_members enable row level security;
alter table public.merchant_rules enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.receipt_files enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.settlements enable row level security;

-- helper: is the calling user a member of the household?
create or replace function public.is_household_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

-- ---------- profiles ----------
drop policy if exists "household reads profiles" on public.profiles;
create policy "household reads profiles" on public.profiles
  for select using (public.is_household_member());

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------- shared lookup tables ----------
do $$
declare t text;
begin
  foreach t in array array[
    'categories','split_presets','split_preset_members','merchant_rules'
  ] loop
    execute format('drop policy if exists "household read %1$s" on public.%1$s', t);
    execute format('create policy "household read %1$s" on public.%1$s for select using (public.is_household_member())', t);
    execute format('drop policy if exists "household write %1$s" on public.%1$s', t);
    execute format('create policy "household write %1$s" on public.%1$s for all using (public.is_household_member()) with check (public.is_household_member())', t);
  end loop;
end $$;

-- ---------- expenses + splits ----------
drop policy if exists "household read expenses" on public.expenses;
create policy "household read expenses" on public.expenses
  for select using (public.is_household_member());

drop policy if exists "household write expenses" on public.expenses;
create policy "household write expenses" on public.expenses
  for all using (public.is_household_member()) with check (public.is_household_member());

drop policy if exists "household read splits" on public.expense_splits;
create policy "household read splits" on public.expense_splits
  for select using (public.is_household_member());

drop policy if exists "household write splits" on public.expense_splits;
create policy "household write splits" on public.expense_splits
  for all using (public.is_household_member()) with check (public.is_household_member());

-- ---------- receipts ----------
drop policy if exists "household read receipts" on public.receipt_files;
create policy "household read receipts" on public.receipt_files
  for select using (public.is_household_member());

drop policy if exists "household write receipts" on public.receipt_files;
create policy "household write receipts" on public.receipt_files
  for all using (public.is_household_member()) with check (public.is_household_member());

-- ---------- recurring ----------
drop policy if exists "household read recurring" on public.recurring_expenses;
create policy "household read recurring" on public.recurring_expenses
  for select using (public.is_household_member());

drop policy if exists "household write recurring" on public.recurring_expenses;
create policy "household write recurring" on public.recurring_expenses
  for all using (public.is_household_member()) with check (public.is_household_member());

-- ---------- settlements ----------
drop policy if exists "household read settlements" on public.settlements;
create policy "household read settlements" on public.settlements
  for select using (public.is_household_member());

drop policy if exists "household write settlements" on public.settlements;
create policy "household write settlements" on public.settlements
  for all using (public.is_household_member()) with check (public.is_household_member());

-- ============================================================================
-- Storage bucket for receipts
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "household read receipt objects" on storage.objects;
create policy "household read receipt objects" on storage.objects
  for select using (bucket_id = 'receipts' and public.is_household_member());

drop policy if exists "household write receipt objects" on storage.objects;
create policy "household write receipt objects" on storage.objects
  for insert with check (bucket_id = 'receipts' and public.is_household_member());

drop policy if exists "household update receipt objects" on storage.objects;
create policy "household update receipt objects" on storage.objects
  for update using (bucket_id = 'receipts' and public.is_household_member())
  with check (bucket_id = 'receipts' and public.is_household_member());

drop policy if exists "household delete receipt objects" on storage.objects;
create policy "household delete receipt objects" on storage.objects
  for delete using (bucket_id = 'receipts' and public.is_household_member());
