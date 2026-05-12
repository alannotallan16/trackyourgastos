-- ============================================================================
-- Historical expenses import — Jan/Feb 2026.
-- Run ONCE. Re-running creates duplicate rows.
-- ============================================================================

do $$
declare
  alan uuid; cel uuid; len uuid;
  c_dining uuid; c_grocery uuid; c_pets uuid; c_util uuid;
  c_household uuid; c_shop uuid; c_sub uuid; c_rent uuid;
  c_transport uuid; c_other uuid;
  exp_id uuid;
  d_jan  date := '2026-01-31';
  d_125  date := '2026-01-25';
  d_131  date := '2026-01-31';
  d_208  date := '2026-02-08';
  d_215  date := '2026-02-15';
  d_feb  date := '2026-02-28';
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
  select id into c_sub       from public.categories where name = 'Subscription';
  select id into c_rent      from public.categories where name = 'Rent';
  select id into c_transport from public.categories where name = 'Transportation';
  select id into c_other     from public.categories where name = 'Other';

  -- ============ JANUARY ============

  -- 1. Laybare — Cel paid, Len-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_jan, 'Laybare', 100.00, 'PHP', c_other, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, len, 'fixed', 100.00);

  -- 2. SmT — Cel paid (Cel 299.50, Len 398.50)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_jan, 'SmT', 698.00, 'PHP', c_other, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, cel, 'fixed', 299.50), (exp_id, len, 'fixed', 398.50);

  -- 3. Poutito — Cel paid (Cel + Len 50/50)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_jan, 'Poutito', 203.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, cel, 'fixed', 101.50), (exp_id, len, 'fixed', 101.50);

  -- 4. Merienda — Cel paid, Len-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_jan, 'Merienda', 65.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, len, 'fixed', 65.00);

  -- 5. Grocery 1/25 — Cel paid, 3-way equal
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_125, 'Grocery 1/25', 2520.78, 'PHP', c_grocery, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 840.26), (exp_id, cel, 'fixed', 840.26), (exp_id, len, 'fixed', 840.26);

  -- 6. Petsup (544) — Cel paid (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_jan, 'Petsup', 544.00, 'PHP', c_pets, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 181.33), (exp_id, cel, 'fixed', 181.33), (exp_id, len, 'fixed', 181.34);

  -- 7. Kenny — Cel paid (Alan 385, Cel 360, Len 265)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_jan, 'Kenny', 1010.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 385.00), (exp_id, cel, 'fixed', 360.00), (exp_id, len, 'fixed', 265.00);

  -- 8. Dainty — Cel paid, Alan-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_jan, 'Dainty', 2501.92, 'PHP', c_other, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 2501.92);

  -- 9. Sudah (700) — Alan paid (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_jan, 'Sudah', 700.00, 'PHP', c_dining, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 233.33), (exp_id, cel, 'fixed', 233.33), (exp_id, len, 'fixed', 233.34);

  -- 10. Grocery 1/31 — Cel paid, 3-way equal
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_131, 'Grocery 1/31', 3523.92, 'PHP', c_grocery, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 1174.64), (exp_id, cel, 'fixed', 1174.64), (exp_id, len, 'fixed', 1174.64);

  -- ============ FEBRUARY ============

  -- 11. Jollibee (690) — Cel paid, 3-way equal
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Jollibee', 690.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 230.00), (exp_id, cel, 'fixed', 230.00), (exp_id, len, 'fixed', 230.00);

  -- 12. Petstore Marquee — Cel paid (Len absorbs -0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Petstore Marquee', 410.00, 'PHP', c_pets, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 136.67), (exp_id, cel, 'fixed', 136.67), (exp_id, len, 'fixed', 136.66);

  -- 13. Petsup (883) — Cel paid (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Petsup', 883.00, 'PHP', c_pets, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 294.33), (exp_id, cel, 'fixed', 294.33), (exp_id, len, 'fixed', 294.34);

  -- 14. Bigas + Tissue — Len paid, 3-way equal
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Bigas + Tissue', 375.00, 'PHP', c_grocery, len, len) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 125.00), (exp_id, cel, 'fixed', 125.00), (exp_id, len, 'fixed', 125.00);

  -- 15. KFC — Cel paid (Cel + Len 50/50)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'KFC', 750.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, cel, 'fixed', 375.00), (exp_id, len, 'fixed', 375.00);

  -- 16. Pelco (8040.45) — Alan paid (Alan 4000, Cel 2020.23, Len 2020.22)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Pelco', 8040.45, 'PHP', c_util, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 4000.00), (exp_id, cel, 'fixed', 2020.23), (exp_id, len, 'fixed', 2020.22);

  -- 17. Petsup (623) — Cel paid (Len absorbs -0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Petsup', 623.00, 'PHP', c_pets, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 207.67), (exp_id, cel, 'fixed', 207.67), (exp_id, len, 'fixed', 207.66);

  -- 18. Army Navy — Cel paid, Len-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Army Navy', 1040.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, len, 'fixed', 1040.00);

  -- 19. Japan Hope — Cel paid (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Japan Hope', 262.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 87.33), (exp_id, cel, 'fixed', 87.33), (exp_id, len, 'fixed', 87.34);

  -- 20. Landers — Cel paid (custom split)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Landers', 8865.18, 'PHP', c_grocery, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 4345.15), (exp_id, cel, 'fixed', 2238.46), (exp_id, len, 'fixed', 2281.57);

  -- 21. Landers Food — Cel paid (Alan 274.50, Cel 274.50, Len 144)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Landers Food', 693.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 274.50), (exp_id, cel, 'fixed', 274.50), (exp_id, len, 'fixed', 144.00);

  -- 22. SM Store — Cel paid (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'SM Store', 3202.00, 'PHP', c_shop, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 1067.33), (exp_id, cel, 'fixed', 1067.33), (exp_id, len, 'fixed', 1067.34);

  -- 23. Marugame — Cel paid, Len-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Marugame', 915.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, len, 'fixed', 915.00);

  -- 24. Krispy Kreme — Cel paid, 3-way equal
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Krispy Kreme', 525.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 175.00), (exp_id, cel, 'fixed', 175.00), (exp_id, len, 'fixed', 175.00);

  -- 25. Pancake House — Cel paid, Alan-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Pancake House', 1978.69, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 1978.69);

  -- 26. Grocery 2/8 — Cel paid (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_208, 'Grocery 2/8', 2503.12, 'PHP', c_grocery, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 834.37), (exp_id, cel, 'fixed', 834.37), (exp_id, len, 'fixed', 834.38);

  -- 27. Mitsuki — Cel paid, Alan-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Mitsuki', 5860.00, 'PHP', c_other, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 5860.00);

  -- 28. Grocery 2/15 — Cel paid (Len absorbs -0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_215, 'Grocery 2/15', 3358.34, 'PHP', c_grocery, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 1119.45), (exp_id, cel, 'fixed', 1119.45), (exp_id, len, 'fixed', 1119.44);

  -- 29. Jollibee (431) — Cel paid (Len absorbs -0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Jollibee', 431.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 143.67), (exp_id, cel, 'fixed', 143.67), (exp_id, len, 'fixed', 143.66);

  -- 30. 1000CC — Cel paid (Alan 260, Cel 215, Len 160)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, '1000CC', 635.00, 'PHP', c_other, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 260.00), (exp_id, cel, 'fixed', 215.00), (exp_id, len, 'fixed', 160.00);

  -- 31. Porac — Alan paid (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Porac', 757.00, 'PHP', c_other, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 252.33), (exp_id, cel, 'fixed', 252.33), (exp_id, len, 'fixed', 252.34);

  -- 32. Nike (2995) — Alan paid, Len-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Nike', 2995.00, 'PHP', c_shop, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, len, 'fixed', 2995.00);

  -- 33. Nike (2440) — Len paid (Cel + Len 50/50)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Nike', 2440.00, 'PHP', c_shop, len, len) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, cel, 'fixed', 1220.00), (exp_id, len, 'fixed', 1220.00);

  -- 34. Puregold — Len paid (Len absorbs -0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Puregold', 1465.97, 'PHP', c_grocery, len, len) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, cel, 'fixed', 732.99), (exp_id, len, 'fixed', 732.98);

  -- 35. Car Cover — Alan paid, Len-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Car Cover', 365.00, 'PHP', c_transport, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, len, 'fixed', 365.00);

  -- 36. Food Bazaar — Cel paid, Len-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Food Bazaar', 150.00, 'PHP', c_dining, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, len, 'fixed', 150.00);

  -- 37. Netflix — Cel paid, 3-way equal
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Netflix', 626.88, 'PHP', c_sub, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 208.96), (exp_id, cel, 'fixed', 208.96), (exp_id, len, 'fixed', 208.96);

  -- 38. rent — Alan paid, Len-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'rent', 1500.00, 'PHP', c_rent, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, len, 'fixed', 1500.00);

  -- 39. Mandaue 9 of 12 — Alan paid, Len-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Mandaue 9 of 12', 936.15, 'PHP', c_household, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, len, 'fixed', 936.15);

  -- 40. Ikea 6 of 6 — Alan paid (Alan 2724.88, Cel 1394.56, Len 498.56)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Ikea 6 of 6', 4618.00, 'PHP', c_household, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 2724.88), (exp_id, cel, 'fixed', 1394.56), (exp_id, len, 'fixed', 498.56);

  -- 41. globe — Alan paid (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'globe', 1999.00, 'PHP', c_util, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 666.33), (exp_id, cel, 'fixed', 666.33), (exp_id, len, 'fixed', 666.34);

  -- 42. Foods — Alan paid, Len-only share
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Foods', 700.00, 'PHP', c_grocery, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, len, 'fixed', 700.00);

  -- 43. Petbowl — Alan paid (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Petbowl', 346.00, 'PHP', c_pets, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 115.33), (exp_id, cel, 'fixed', 115.33), (exp_id, len, 'fixed', 115.34);

  -- 44. Banig — Alan paid (Len absorbs -0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Banig', 218.00, 'PHP', c_household, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 72.67), (exp_id, cel, 'fixed', 72.67), (exp_id, len, 'fixed', 72.66);

  -- 45. Fence — Alan paid (Len absorbs +0.01)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, created_by)
    values (d_feb, 'Fence', 658.00, 'PHP', c_household, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'fixed', 219.33), (exp_id, cel, 'fixed', 219.33), (exp_id, len, 'fixed', 219.34);
end $$;
