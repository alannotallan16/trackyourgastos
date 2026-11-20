-- ============================================================================
-- 0007_close_batch.sql
--
-- Adds the "reconciled" terminal status (both batch-level and result-level) and
-- a reconciled_amount column on settlement_batch_results that captures the
-- forgiven leg at close time without polluting amount_paid. amount_paid must
-- stay exactly equal to the sum of settlement_payments rows for the integrity
-- audit to keep working.
--
-- Also adds two RPC functions so reconcile-many-rows and
-- record-payment-across-a-pair each run in a single Postgres transaction:
--
--   reconcile_batch_rows(batch_id uuid, result_ids uuid[])
--   record_payment_for_pair(from, to, amount, date, method, notes,
--                           ref, attachment, created_by, preview_only)
--
-- Run AFTER 0006_settlement_batches.sql. Back up settlement_batches and
-- settlement_batch_results first (those are the two tables altered here).
-- Safe to re-run: every create is "or replace", column add is "if not exists",
-- constraints are drop-if-exists / add.
-- ============================================================================

-- 1. Add reconciled_amount column --------------------------------------------
alter table public.settlement_batch_results
  add column if not exists reconciled_amount numeric(14,2) not null default 0
    check (reconciled_amount >= 0);

-- 2. Extend batch-level status check -----------------------------------------
alter table public.settlement_batches
  drop constraint if exists settlement_batches_status_check;
alter table public.settlement_batches
  add constraint settlement_batches_status_check
    check (status in ('open','partially_paid','paid','cancelled','reconciled'));

-- 3. Extend result-level status check ----------------------------------------
alter table public.settlement_batch_results
  drop constraint if exists settlement_batch_results_status_check;
alter table public.settlement_batch_results
  add constraint settlement_batch_results_status_check
    check (status in ('open','partially_paid','paid','reconciled'));

-- 4. Internal helper: roll up a batch's status from its results' statuses,
--    and sync the batch's expense_splits. Used by both RPCs below. SECURITY
--    DEFINER because the RPCs that call it already gate on
--    is_household_member(); this helper is revoked from public/anon below.
create or replace function public.rollup_batch_status(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_terminal int;
  v_any_progress int;
  v_any_reconciled boolean;
begin
  select
    count(*),
    count(*) filter (where status in ('paid','reconciled')),
    count(*) filter (where status in ('partially_paid','paid','reconciled')),
    bool_or(status = 'reconciled')
  into v_total, v_terminal, v_any_progress, v_any_reconciled
  from public.settlement_batch_results
  where settlement_batch_id = p_batch_id;

  if v_total = 0 then
    return;
  end if;

  if v_terminal = v_total then
    -- Every result is terminal. Batch is "reconciled" if ANY result was
    -- reconciled (not just paid), else "paid". Splits flip to settled.
    update public.settlement_batches
      set status = case when v_any_reconciled then 'reconciled' else 'paid' end
      where id = p_batch_id;

    update public.expense_splits
      set settlement_status = 'settled',
          settled_at = now()
      where id in (
        select expense_split_id
        from public.settlement_batch_items
        where settlement_batch_id = p_batch_id
      );
  else
    update public.settlement_batches
      set status = case when v_any_progress > 0 then 'partially_paid' else 'open' end
      where id = p_batch_id;

    update public.expense_splits
      set settlement_status = 'in_settlement',
          settled_at = null
      where id in (
        select expense_split_id
        from public.settlement_batch_items
        where settlement_batch_id = p_batch_id
      );
  end if;
end;
$$;

-- 5. RPC: reconcile_batch_rows ----------------------------------------------
create or replace function public.reconcile_batch_rows(
  p_batch_id uuid,
  p_result_ids uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_touched int;
begin
  if not public.is_household_member() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select status into v_status
    from public.settlement_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Batch not found' using errcode = 'P0002';
  end if;
  if v_status in ('cancelled','reconciled') then
    raise exception 'Batch is already %', v_status using errcode = 'P0001';
  end if;

  if array_length(p_result_ids, 1) is null then
    raise exception 'No rows selected' using errcode = 'P0001';
  end if;

  -- Validate: every id belongs to this batch AND is not already terminal.
  if exists (
    select 1 from unnest(p_result_ids) as rid
    where not exists (
      select 1 from public.settlement_batch_results r
      where r.id = rid
        and r.settlement_batch_id = p_batch_id
        and r.status in ('open','partially_paid')
    )
  ) then
    raise exception 'One or more selected rows are not open in this batch'
      using errcode = 'P0001';
  end if;

  update public.settlement_batch_results
    set status = 'reconciled',
        reconciled_amount = remaining_amount,
        remaining_amount = 0
    where id = any(p_result_ids);
  get diagnostics v_touched = row_count;

  perform public.rollup_batch_status(p_batch_id);

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'reconciled_count', v_touched
  );
end;
$$;

-- 6. RPC: record_payment_for_pair -------------------------------------------
create or replace function public.record_payment_for_pair(
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_notes text,
  p_reference_number text,
  p_attachment_path text,
  p_created_by uuid,
  p_preview_only boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pair_open numeric;
  v_remaining numeric;
  v_apply numeric;
  v_allocation jsonb := '[]'::jsonb;
  v_touched_batches uuid[] := array[]::uuid[];
  r record;
begin
  if not public.is_household_member() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive' using errcode = 'P0001';
  end if;
  if p_from_user_id = p_to_user_id then
    raise exception 'Payer and payee must differ' using errcode = 'P0001';
  end if;

  select coalesce(sum(remaining_amount), 0) into v_pair_open
    from public.settlement_batch_results
    where from_user_id = p_from_user_id
      and to_user_id   = p_to_user_id
      and status in ('open','partially_paid');

  if p_amount > v_pair_open + 0.005 then
    raise exception '₱% is more than the ₱% open between this pair. Create a settlement first.',
      to_char(p_amount, 'FM999,999,990.00'),
      to_char(v_pair_open, 'FM999,999,990.00')
      using errcode = 'P0001';
  end if;

  v_remaining := p_amount;
  for r in
    select r.id            as result_id,
           r.settlement_batch_id,
           r.remaining_amount,
           r.currency,
           b.settlement_number,
           b.created_at     as batch_created_at
    from public.settlement_batch_results r
    join public.settlement_batches b on b.id = r.settlement_batch_id
    where r.from_user_id = p_from_user_id
      and r.to_user_id   = p_to_user_id
      and r.status in ('open','partially_paid')
    order by b.created_at asc, r.id asc
    for update of r
  loop
    exit when v_remaining <= 0.005;
    v_apply := least(v_remaining, r.remaining_amount);
    v_allocation := v_allocation || jsonb_build_object(
      'result_id',      r.result_id,
      'batch_id',       r.settlement_batch_id,
      'batch_number',   r.settlement_number,
      'apply_amount',   round(v_apply, 2),
      'was_remaining',  round(r.remaining_amount, 2),
      'will_leave',     round(r.remaining_amount - v_apply, 2)
    );
    v_remaining := v_remaining - v_apply;

    if not p_preview_only then
      insert into public.settlement_payments (
        settlement_batch_result_id, payment_date, amount, currency,
        payment_method, notes, reference_number, attachment_path, created_by
      ) values (
        r.result_id, p_payment_date, round(v_apply, 2), r.currency,
        p_payment_method, p_notes, p_reference_number, p_attachment_path, p_created_by
      );

      update public.settlement_batch_results
        set amount_paid = round(amount_paid + v_apply, 2),
            remaining_amount = greatest(0, round(remaining_amount - v_apply, 2)),
            status = case
              when round(remaining_amount - v_apply, 2) <= 0.005 then 'paid'
              else 'partially_paid'
            end
        where id = r.result_id;

      v_touched_batches := v_touched_batches || r.settlement_batch_id;
    end if;
  end loop;

  if not p_preview_only then
    perform public.rollup_batch_status(bid)
    from unnest(array(select distinct unnest(v_touched_batches))) as bid;
  end if;

  return jsonb_build_object(
    'preview_only', p_preview_only,
    'amount',       round(p_amount, 2),
    'pair_open',    round(v_pair_open, 2),
    'allocation',   v_allocation
  );
end;
$$;

-- 7. Lock down anon; grant only authenticated users --------------------------
revoke all on function public.rollup_batch_status(uuid) from public, anon;

revoke all on function public.reconcile_batch_rows(uuid, uuid[]) from public, anon;
grant execute on function public.reconcile_batch_rows(uuid, uuid[]) to authenticated;

revoke all on function public.record_payment_for_pair(
  uuid, uuid, numeric, date, text, text, text, text, uuid, boolean
) from public, anon;
grant execute on function public.record_payment_for_pair(
  uuid, uuid, numeric, date, text, text, text, text, uuid, boolean
) to authenticated;
