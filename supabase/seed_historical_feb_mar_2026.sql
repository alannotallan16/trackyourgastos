-- ============================================================================
-- Historical expenses import — Feb/March 2026.
-- Run ONCE. Re-running creates duplicate rows.
-- ============================================================================

do $$
declare
  alan uuid; cel uuid; len uuid;
  c_dining uuid; c_grocery uuid; c_pets uuid; c_util uuid;
  c_household uuid; c_shop uuid; c_other uuid;
  exp_id uuid;
  d_feb  date := '2026-02-28';
  d_221  date := '2026-02-21';
  d_223  date := '2026-02-23';
  d_301  date := '2026-03-01';
  d_307  date := '2026-03-07';
  d_309  date := '2026-03-09';
  d_mar  date := '2026-03-31';
begin
  select id into alan from public.profiles where short_name = 'alan';
  select id into cel  from public.profiles where short_name = 'cel';
  select id into len  from public.profiles where short_name = 'len';
  if alan is null or cel is null or len is null then
    raise exception 'Profiles not found.';
  end if;

  select id into c_dining    from public.categories where name = 'Dining';
  select id into c_grocery   from public.categories where name = 'Grocery';
  select id into c_pets      from public.categories where name = 'Pets';
  select id into c_util      from public.categories where name = 'Utilities';
  select id into c_household from public.categories where name = 'Household';
  select id into c_shop      from public.categories where name = 'Shopping';
  select id into c_other     from public.categories where name = 'Other';

  -- ============ FEBRUARY ============

  -- 1. Myeongrun — Cel paid (Alan 3112, Len 678)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Myeongrun', 3790.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 3112.00), (exp_id, len, 'fixed', 678.00);

  -- 2. Founders — Cel paid, Alan-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Founders', 588.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 588.00);

  -- 3. Pet Express 2/21 — Cel paid, 3-way (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_221, 'Pet Express 2/21', 1714.00, 'PHP', c_pets, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 571.33), (exp_id, cel, 'fixed', 571.33), (exp_id, len, 'fixed', 571.34);

  -- 4. Shakeys — Cel paid (Alan 945, Len 445)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Shakeys', 1390.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 945.00), (exp_id, len, 'fixed', 445.00);

  -- 5. Grocery 2/23 — Cel paid, 3-way equal
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_223, 'Grocery 2/23', 3565.71, 'PHP', c_grocery, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 1188.57), (exp_id, cel, 'fixed', 1188.57), (exp_id, len, 'fixed', 1188.57);

  -- ============ MARCH ============

  -- 6. Grocery 3/1 — Cel paid, 3-way equal
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_301, 'Grocery 3/1', 3636.39, 'PHP', c_grocery, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 1212.13), (exp_id, cel, 'fixed', 1212.13), (exp_id, len, 'fixed', 1212.13);

  -- 7. SMC 3/7 — Cel paid (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_307, 'SMC 3/7', 1804.00, 'PHP', c_other, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 601.33), (exp_id, cel, 'fixed', 601.33), (exp_id, len, 'fixed', 601.34);

  -- 8. Grocery 3/9 — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_309, 'Grocery 3/9', 2022.48, 'PHP', c_grocery, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 674.16), (exp_id, cel, 'fixed', 674.16), (exp_id, len, 'fixed', 674.16);

  -- 9. Galbi — Alan paid, Len-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Galbi', 500.00, 'PHP', c_dining, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, len, 'fixed', 500.00);

  -- 10. Petsup — Cel paid (Len absorbs -0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Petsup', 623.00, 'PHP', c_pets, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 207.67), (exp_id, cel, 'fixed', 207.67), (exp_id, len, 'fixed', 207.66);

  -- 11. Signature 7 (1st) — Cel paid (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Signature 7', 268.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 89.33), (exp_id, cel, 'fixed', 89.33), (exp_id, len, 'fixed', 89.34);

  -- 12. Singen — Cel paid (Len absorbs -0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Singen', 1229.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 409.67), (exp_id, cel, 'fixed', 409.67), (exp_id, len, 'fixed', 409.66);

  -- 13. Sudah (450) — Alan paid, 3-way equal
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Sudah', 450.00, 'PHP', c_dining, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 150.00), (exp_id, cel, 'fixed', 150.00), (exp_id, len, 'fixed', 150.00);

  -- 14. Water — Alan paid, 3-way equal
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Water', 450.60, 'PHP', c_util, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 150.20), (exp_id, cel, 'fixed', 150.20), (exp_id, len, 'fixed', 150.20);

  -- 15. Bigas (350) — Cel paid (Len absorbs -0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Bigas', 350.00, 'PHP', c_grocery, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 116.67), (exp_id, cel, 'fixed', 116.67), (exp_id, len, 'fixed', 116.66);

  -- 16. Signature 7 (2nd) — Cel paid (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Signature 7', 268.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 89.33), (exp_id, cel, 'fixed', 89.33), (exp_id, len, 'fixed', 89.34);

  -- 17. Sudah (1150) — Alan paid (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Sudah', 1150.00, 'PHP', c_dining, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 383.33), (exp_id, cel, 'fixed', 383.33), (exp_id, len, 'fixed', 383.34);

  -- 18. Bigas (700) — Alan paid (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Bigas', 700.00, 'PHP', c_grocery, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 233.33), (exp_id, cel, 'fixed', 233.33), (exp_id, len, 'fixed', 233.34);

  -- 19. Diy — Len paid, 3-way equal
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Diy', 219.00, 'PHP', c_household, len, len) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 73.00), (exp_id, cel, 'fixed', 73.00), (exp_id, len, 'fixed', 73.00);

  -- 20. Shanghai — Len paid, 3-way equal
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Shanghai', 288.00, 'PHP', c_dining, len, len) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 96.00), (exp_id, cel, 'fixed', 96.00), (exp_id, len, 'fixed', 96.00);

  -- 21. Watsons 3/9 — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_309, 'Watsons 3/9', 998.25, 'PHP', c_shop, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 332.75), (exp_id, cel, 'fixed', 332.75), (exp_id, len, 'fixed', 332.75);
end $$;
