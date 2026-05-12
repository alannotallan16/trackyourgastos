-- ============================================================================
-- Historical expenses import — Vince trip, dated 2026-03-31.
-- Safe to run once. Re-running will create duplicate rows.
-- ============================================================================

do $$
declare
  alan uuid; cel uuid; len uuid;
  c_travel uuid; c_dining uuid; c_transport uuid; c_other uuid;
  exp_id uuid;
  d date := '2026-03-31';
begin
  select id into alan from public.profiles where short_name = 'alan';
  select id into cel  from public.profiles where short_name = 'cel';
  select id into len  from public.profiles where short_name = 'len';
  if alan is null or cel is null or len is null then
    raise exception 'Profiles not found — link auth users via 0004_link_profiles.sql first.';
  end if;

  -- Ensure Travel category exists (not in the default seed)
  insert into public.categories (name) values ('Travel') on conflict (name) do nothing;

  select id into c_travel    from public.categories where name = 'Travel';
  select id into c_dining    from public.categories where name = 'Dining';
  select id into c_transport from public.categories where name = 'Transportation';
  select id into c_other     from public.categories where name = 'Other';

  -- 1. Baggage 02/21/26 — Len paid, 3-way equal
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d, 'Baggage 02/21/26', 7080.00, 'PHP', c_travel, len, len)
    returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 2360.00),
    (exp_id, cel,  'fixed', 2360.00),
    (exp_id, len,  'fixed', 2360.00);

  -- 2. Insurance 02/21/26 — Len paid, 3-way equal
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d, 'Insurance 02/21/26', 1083.00, 'PHP', c_travel, len, len)
    returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 361.00),
    (exp_id, cel,  'fixed', 361.00),
    (exp_id, len,  'fixed', 361.00);

  -- 3. Vince Hotel Deposit — Alan paid, 3-way equal (Len absorbs 0.01 for rounding)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d, 'Vince Hotel Deposit', 6257.00, 'PHP', c_travel, alan, alan)
    returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 2085.67),
    (exp_id, cel,  'fixed', 2085.67),
    (exp_id, len,  'fixed', 2085.66);

  -- 4. Withdraw — Alan paid, split between Alan & Len ONLY (no Cel)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d, 'Withdraw', 56856.16, 'PHP', c_other, alan, alan)
    returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 37904.11),
    (exp_id, len,  'fixed', 18952.05);

  -- 5. Airport transfer — Alan paid, 3-way equal (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d, 'Airport transfer', 2117.83, 'PHP', c_transport, alan, alan)
    returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 705.94),
    (exp_id, cel,  'fixed', 705.94),
    (exp_id, len,  'fixed', 705.95);

  -- 6. Grab — Alan paid, 3-way equal (Len absorbs -0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d, 'Grab', 4873.76, 'PHP', c_transport, alan, alan)
    returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 1624.59),
    (exp_id, cel,  'fixed', 1624.59),
    (exp_id, len,  'fixed', 1624.58);

  -- 7. Vince remaining — Alan paid, 3-way equal
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d, 'Vince remaining', 25136.16, 'PHP', c_travel, alan, alan)
    returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 8378.72),
    (exp_id, cel,  'fixed', 8378.72),
    (exp_id, len,  'fixed', 8378.72);

  -- 8. Airplane food — Alan paid, 3-way equal
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d, 'Airplane food', 600.00, 'PHP', c_dining, alan, alan)
    returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 200.00),
    (exp_id, cel,  'fixed', 200.00),
    (exp_id, len,  'fixed', 200.00);

  -- 9. Bos coffee — Alan paid, 3-way equal (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d, 'Bos coffee', 640.00, 'PHP', c_dining, alan, alan)
    returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 213.33),
    (exp_id, cel,  'fixed', 213.33),
    (exp_id, len,  'fixed', 213.34);

  -- 10. Pay parking — Cel paid, 3-way equal
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d, 'Pay parking', 1680.00, 'PHP', c_transport, cel, cel)
    returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 560.00),
    (exp_id, cel,  'fixed', 560.00),
    (exp_id, len,  'fixed', 560.00);

  -- 11. Jollibee — Cel paid, 3-way equal (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d, 'Jollibee', 652.00, 'PHP', c_dining, cel, cel)
    returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 217.33),
    (exp_id, cel,  'fixed', 217.33),
    (exp_id, len,  'fixed', 217.34);
end $$;
