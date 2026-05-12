-- ============================================================================
-- Historical expenses import — March/April 2026.
-- Run ONCE. Re-running creates duplicate rows.
-- ============================================================================

do $$
declare
  alan uuid; cel uuid; len uuid;
  c_dining uuid; c_grocery uuid; c_pets uuid; c_sub uuid; c_rent uuid;
  c_household uuid; c_util uuid; c_transport uuid; c_shop uuid; c_other uuid;
  exp_id uuid;
  d_mar  date := '2026-03-31';  -- pre-3/29 bucket
  d_329  date := '2026-03-29';
  d_405  date := '2026-04-05';
  d_412  date := '2026-04-12';
  d_apr  date := '2026-04-30';  -- post-4/12 / no explicit date
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
  select id into c_sub       from public.categories where name = 'Subscription';
  select id into c_rent      from public.categories where name = 'Rent';
  select id into c_household from public.categories where name = 'Household';
  select id into c_util      from public.categories where name = 'Utilities';
  select id into c_transport from public.categories where name = 'Transportation';
  select id into c_shop      from public.categories where name = 'Shopping';
  select id into c_other     from public.categories where name = 'Other';

  -- ============ MARCH (pre Grocery 3/29) ============

  -- 1. Sudah — Len paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Sudah', 1800.00, 'PHP', c_dining, len, len) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 600.00), (exp_id, cel, 'fixed', 600.00), (exp_id, len, 'fixed', 600.00);

  -- 2. Sing sing beef — Alan paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Sing sing beef', 458.00, 'PHP', c_dining, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 152.67), (exp_id, cel, 'fixed', 152.67), (exp_id, len, 'fixed', 152.66);

  -- 3. Bigas — Alan paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Bigas', 350.00, 'PHP', c_grocery, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 116.67), (exp_id, cel, 'fixed', 116.67), (exp_id, len, 'fixed', 116.66);

  -- 4. Singen — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Singen', 655.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 218.33), (exp_id, cel, 'fixed', 218.33), (exp_id, len, 'fixed', 218.34);

  -- 5. Petsup+leash — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Petsup+leash', 1061.00, 'PHP', c_pets, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 353.67), (exp_id, cel, 'fixed', 353.67), (exp_id, len, 'fixed', 353.66);

  -- 6. Meowtech — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Meowtech', 1011.00, 'PHP', c_pets, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 337.00), (exp_id, cel, 'fixed', 337.00), (exp_id, len, 'fixed', 337.00);

  -- 7. Netflix (1st) — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Netflix', 626.88, 'PHP', c_sub, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 208.96), (exp_id, cel, 'fixed', 208.96), (exp_id, len, 'fixed', 208.96);

  -- 8. rent (1st) — Alan paid, Len-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'rent', 1500.00, 'PHP', c_rent, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, len, 'fixed', 1500.00);

  -- 9. Mandaue 10 of 12 — Alan paid, Len-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Mandaue 10 of 12', 936.15, 'PHP', c_household, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, len, 'fixed', 936.15);

  -- 10. globe (1st) — Alan paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'globe', 1999.00, 'PHP', c_util, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 666.33), (exp_id, cel, 'fixed', 666.33), (exp_id, len, 'fixed', 666.34);

  -- 11. Netflix (2nd) — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Netflix', 626.88, 'PHP', c_sub, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 208.96), (exp_id, cel, 'fixed', 208.96), (exp_id, len, 'fixed', 208.96);

  -- 12. rent (2nd) — Alan paid, Len-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'rent', 1500.00, 'PHP', c_rent, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, len, 'fixed', 1500.00);

  -- 13. Mandaue 11 of 12 — Alan paid, Len-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Mandaue 11 of 12', 936.15, 'PHP', c_household, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, len, 'fixed', 936.15);

  -- 14. globe (2nd) — Alan paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'globe', 1999.00, 'PHP', c_util, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 666.33), (exp_id, cel, 'fixed', 666.33), (exp_id, len, 'fixed', 666.34);

  -- 15. Pet express (1st) — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Pet express', 1281.00, 'PHP', c_pets, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 427.00), (exp_id, cel, 'fixed', 427.00), (exp_id, len, 'fixed', 427.00);

  -- 16. Shell — Cel paid, Cel + Len only
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Shell', 915.00, 'PHP', c_transport, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, cel, 'fixed', 457.50), (exp_id, len, 'fixed', 457.50);

  -- 17. Ben san — Cel paid, Alan-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Ben san', 2350.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 2350.00);

  -- 18. Sm clark — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Sm clark', 3130.00, 'PHP', c_shop, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 1043.33), (exp_id, cel, 'fixed', 1043.33), (exp_id, len, 'fixed', 1043.34);

  -- 19. Pet express (2nd) — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Pet express', 1251.00, 'PHP', c_pets, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 417.00), (exp_id, cel, 'fixed', 417.00), (exp_id, len, 'fixed', 417.00);

  -- 20. Sm clark hypermrkt — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_mar, 'Sm clark hypermrkt', 519.00, 'PHP', c_grocery, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 173.00), (exp_id, cel, 'fixed', 173.00), (exp_id, len, 'fixed', 173.00);

  -- 21. Grocery 3/29 — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_329, 'Grocery 3/29', 6667.77, 'PHP', c_grocery, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 2222.59), (exp_id, cel, 'fixed', 2222.59), (exp_id, len, 'fixed', 2222.59);

  -- ============ APRIL ============

  -- 22. Jollibee — Cel paid, Cel + Len only
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_apr, 'Jollibee', 518.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, cel, 'fixed', 259.00), (exp_id, len, 'fixed', 259.00);

  -- 23. Savory — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_apr, 'Savory', 1900.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 633.33), (exp_id, cel, 'fixed', 633.33), (exp_id, len, 'fixed', 633.34);

  -- 24. Grocery 4/5 — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_405, 'Grocery 4/5', 2716.03, 'PHP', c_grocery, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 905.34), (exp_id, cel, 'fixed', 905.34), (exp_id, len, 'fixed', 905.35);

  -- 25. Northpark — Cel paid (Alan 2000, Cel 368, Len 368)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_apr, 'Northpark', 2736.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 2000.00), (exp_id, cel, 'fixed', 368.00), (exp_id, len, 'fixed', 368.00);

  -- 26. Daiso — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_apr, 'Daiso', 196.00, 'PHP', c_shop, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 65.33), (exp_id, cel, 'fixed', 65.33), (exp_id, len, 'fixed', 65.34);

  -- 27. Petshop marquee — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_apr, 'Petshop marquee', 590.00, 'PHP', c_pets, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 196.67), (exp_id, cel, 'fixed', 196.67), (exp_id, len, 'fixed', 196.66);

  -- 28. Landers — Cel paid (custom split)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_apr, 'Landers', 6464.61, 'PHP', c_grocery, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 1804.20), (exp_id, cel, 'fixed', 2304.15), (exp_id, len, 'fixed', 2356.26);

  -- 29. Grocery 4/12 — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_412, 'Grocery 4/12', 1968.52, 'PHP', c_grocery, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 656.17), (exp_id, cel, 'fixed', 656.17), (exp_id, len, 'fixed', 656.18);

  -- 30. Greenwich — Cel paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_apr, 'Greenwich', 858.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 286.00), (exp_id, cel, 'fixed', 286.00), (exp_id, len, 'fixed', 286.00);

  -- 31. Tokyo tokyo — Cel paid, Cel 369 + Len 400
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_apr, 'Tokyo tokyo', 769.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, cel, 'fixed', 369.00), (exp_id, len, 'fixed', 400.00);

  -- 32. Polish — Len paid, Cel + Len only
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_apr, 'Polish', 1180.00, 'PHP', c_other, len, len) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, cel, 'fixed', 590.00), (exp_id, len, 'fixed', 590.00);

  -- 33. Plus fab — Cel paid, Len-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_apr, 'Plus fab', 1099.00, 'PHP', c_shop, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, len, 'fixed', 1099.00);

  -- 34. Kuya — Len paid, Cel-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_apr, 'Kuya', 500.00, 'PHP', c_other, len, len) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, cel, 'fixed', 500.00);

  -- 35. Special — Len paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_apr, 'Special', 89.00, 'PHP', c_other, len, len) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 29.67), (exp_id, cel, 'fixed', 29.67), (exp_id, len, 'fixed', 29.66);

  -- 36. Mr DIY — Alan paid (custom)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_apr, 'Mr DIY', 2622.00, 'PHP', c_household, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 946.00), (exp_id, cel, 'fixed', 536.00), (exp_id, len, 'fixed', 1140.00);

  -- 37. Pelco march — Alan paid (Alan 4500, Cel 2668.29, Len 2668.29)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_apr, 'Pelco march', 9836.58, 'PHP', c_util, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 4500.00), (exp_id, cel, 'fixed', 2668.29), (exp_id, len, 'fixed', 2668.29);

  -- 38. Sing sing — Alan paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_apr, 'Sing sing', 206.00, 'PHP', c_dining, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 68.67), (exp_id, cel, 'fixed', 68.67), (exp_id, len, 'fixed', 68.66);

  -- 39. Mansfield water — Alan paid
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_apr, 'Mansfield water', 450.60, 'PHP', c_util, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 150.20), (exp_id, cel, 'fixed', 150.20), (exp_id, len, 'fixed', 150.20);

  -- 40. Pelco — Alan paid, Cel 4000 + Len 3500
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_apr, 'Pelco', 7500.00, 'PHP', c_util, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, cel, 'fixed', 4000.00), (exp_id, len, 'fixed', 3500.00);
end $$;
