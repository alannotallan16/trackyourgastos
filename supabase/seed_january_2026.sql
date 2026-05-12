-- ============================================================================
-- January 2026 expense import (31 expenses, total 43,475.29 PHP).
--
-- Run AFTER 0004_link_profiles.sql so that profiles + presets exist.
-- This script is NOT idempotent -- running it twice will create duplicates.
-- Two rows are dated to their hinted day (Grocery 1/11, Grocery 1/18);
-- everything else is dated 2026-01-31.
-- ============================================================================

do $$
declare
  alan uuid; cel uuid; len uuid;
  c_grocery uuid; c_util uuid; c_rent uuid; c_sub uuid;
  c_din uuid; c_pet uuid; c_shop uuid; c_house uuid; c_other uuid;
  p_equal uuid; p_alan uuid; p_cel uuid; p_len uuid;
  exp_id uuid;
  jan date := '2026-01-31';
begin
  select id into alan from public.profiles where short_name = 'alan';
  select id into cel  from public.profiles where short_name = 'cel';
  select id into len  from public.profiles where short_name = 'len';
  if alan is null or cel is null or len is null then
    raise exception 'Profiles not linked. Run 0004_link_profiles.sql first.';
  end if;

  select id into c_grocery from public.categories where name = 'Grocery';
  select id into c_util    from public.categories where name = 'Utilities';
  select id into c_rent    from public.categories where name = 'Rent';
  select id into c_sub     from public.categories where name = 'Subscription';
  select id into c_din     from public.categories where name = 'Dining';
  select id into c_pet     from public.categories where name = 'Pets';
  select id into c_shop    from public.categories where name = 'Shopping';
  select id into c_house   from public.categories where name = 'Household';
  select id into c_other   from public.categories where name = 'Other';

  select id into p_equal from public.split_presets where name = 'Equal 3-way';
  select id into p_alan  from public.split_presets where name = 'Alan only';
  select id into p_cel   from public.split_presets where name = 'Cel only';
  select id into p_len   from public.split_presets where name = 'Len only';

  -- ------------------------------------------------------------------
  -- 1. Mansfield Water 626.60 -- Alan paid, equal 3-way
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Mansfield Water', 626.60, c_util, alan, p_equal, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 208.87), (exp_id, cel, 'equal', 208.87), (exp_id, len, 'equal', 208.86);

  -- 2. Bigas 210.00 -- Alan paid, equal 3-way
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Bigas', 210.00, c_grocery, alan, p_equal, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 70.00), (exp_id, cel, 'equal', 70.00), (exp_id, len, 'equal', 70.00);

  -- 3. Pelco 8,035.39 -- Alan paid, custom fixed (Alan 4000 / Cel 2017.70 / Len 2017.69)
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, created_by)
  values (jan, 'Pelco', 8035.39, c_util, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, fixed_amount, calculated_amount) values
    (exp_id, alan, 'fixed', 4000.00, 4000.00),
    (exp_id, cel,  'fixed', 2017.70, 2017.70),
    (exp_id, len,  'fixed', 2017.69, 2017.69);

  -- 4. Olivia's 3,631.68 -- Cel paid, equal 3-way
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Olivia''s', 3631.68, c_din, cel, p_equal, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 1210.56), (exp_id, cel, 'equal', 1210.56), (exp_id, len, 'equal', 1210.56);

  -- 5. Pet express 2,132.00 -- Cel paid, equal 3-way
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Pet express', 2132.00, c_pet, cel, p_equal, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 710.67), (exp_id, cel, 'equal', 710.67), (exp_id, len, 'equal', 710.66);

  -- 6. Smc dept 177.00 -- Cel paid, equal 3-way
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Smc dept', 177.00, c_shop, cel, p_equal, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 59.00), (exp_id, cel, 'equal', 59.00), (exp_id, len, 'equal', 59.00);

  -- 7. Cbtl 370.00 -- Cel paid, custom (Alan 195 / Len 175)
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, created_by)
  values (jan, 'Cbtl', 370.00, c_din, cel, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, fixed_amount, calculated_amount) values
    (exp_id, alan, 'fixed', 195.00, 195.00),
    (exp_id, len,  'fixed', 175.00, 175.00);

  -- 8. Taters 145.00 -- Cel paid, Len only
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Taters', 145.00, c_din, cel, p_len, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, percentage, calculated_amount) values
    (exp_id, len, 'percentage', 100, 145.00);

  -- 9. Cbtl 790.00 -- Cel paid, Alan only
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Cbtl', 790.00, c_din, cel, p_alan, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, percentage, calculated_amount) values
    (exp_id, alan, 'percentage', 100, 790.00);

  -- 10. Shopee 1,016.00 -- Cel paid, equal 3-way
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Shopee', 1016.00, c_shop, cel, p_equal, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 338.67), (exp_id, cel, 'equal', 338.67), (exp_id, len, 'equal', 338.66);

  -- 11. Gupit 400.00 -- Cel paid, Len only
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Gupit', 400.00, c_other, cel, p_len, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, percentage, calculated_amount) values
    (exp_id, len, 'percentage', 100, 400.00);

  -- 12. Polish 590.00 -- Len paid, Cel only
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Polish', 590.00, c_other, len, p_cel, len) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, percentage, calculated_amount) values
    (exp_id, cel, 'percentage', 100, 590.00);

  -- 13. Grocery 1/11 4,442.26 -- Cel paid, equal 3-way, dated Jan 11
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values ('2026-01-11', 'Grocery 1/11', 4442.26, c_grocery, cel, p_equal, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 1480.75), (exp_id, cel, 'equal', 1480.75), (exp_id, len, 'equal', 1480.76);

  -- 14. Milas 1,275.00 -- Alan paid, equal 3-way
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Milas', 1275.00, c_din, alan, p_equal, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 425.00), (exp_id, cel, 'equal', 425.00), (exp_id, len, 'equal', 425.00);

  -- 15. Signature 7 134.00 -- Len paid, equal 3-way
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Signature 7', 134.00, c_din, len, p_equal, len) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 44.67), (exp_id, cel, 'equal', 44.67), (exp_id, len, 'equal', 44.66);

  -- 16. Bigas 195.00 -- Len paid, equal 3-way
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Bigas', 195.00, c_grocery, len, p_equal, len) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 65.00), (exp_id, cel, 'equal', 65.00), (exp_id, len, 'equal', 65.00);

  -- 17. Grocery 1/18 3,148.33 -- Cel paid, equal 3-way, dated Jan 18
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values ('2026-01-18', 'Grocery 1/18', 3148.33, c_grocery, cel, p_equal, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 1049.44), (exp_id, cel, 'equal', 1049.44), (exp_id, len, 'equal', 1049.45);

  -- 18. Watsons deo 192.00 -- Cel paid, Len only
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Watsons deo', 192.00, c_shop, cel, p_len, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, percentage, calculated_amount) values
    (exp_id, len, 'percentage', 100, 192.00);

  -- 19. Ace hardware 717.00 -- Alan paid, equal 3-way
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Ace hardware', 717.00, c_house, alan, p_equal, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 239.00), (exp_id, cel, 'equal', 239.00), (exp_id, len, 'equal', 239.00);

  -- 20. Smc dept 1,643.00 -- Cel paid, equal 3-way
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Smc dept', 1643.00, c_shop, cel, p_equal, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 547.67), (exp_id, cel, 'equal', 547.67), (exp_id, len, 'equal', 547.66);

  -- 21. Cbtl 175.00 -- Cel paid, Len only
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Cbtl', 175.00, c_din, cel, p_len, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, percentage, calculated_amount) values
    (exp_id, len, 'percentage', 100, 175.00);

  -- 22. Pet express 444.00 -- Cel paid, equal 3-way
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Pet express', 444.00, c_pet, cel, p_equal, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 148.00), (exp_id, cel, 'equal', 148.00), (exp_id, len, 'equal', 148.00);

  -- 23. Netflix 626.88 -- Cel paid, equal 3-way
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Netflix', 626.88, c_sub, cel, p_equal, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 208.96), (exp_id, cel, 'equal', 208.96), (exp_id, len, 'equal', 208.96);

  -- 24. rent 1,500.00 -- Alan paid, Len only
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'rent', 1500.00, c_rent, alan, p_len, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, percentage, calculated_amount) values
    (exp_id, len, 'percentage', 100, 1500.00);

  -- 25. Mandaue 8 of 12 936.15 -- Alan paid, Len only
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Mandaue 8 of 12', 936.15, c_shop, alan, p_len, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, percentage, calculated_amount) values
    (exp_id, len, 'percentage', 100, 936.15);

  -- 26. Ikea 5 of 6 4,618.00 -- Alan paid, custom fixed (Alan 2724.88 / Cel 1394.56 / Len 498.56)
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, created_by)
  values (jan, 'Ikea 5 of 6', 4618.00, c_house, alan, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, fixed_amount, calculated_amount) values
    (exp_id, alan, 'fixed', 2724.88, 2724.88),
    (exp_id, cel,  'fixed', 1394.56, 1394.56),
    (exp_id, len,  'fixed',  498.56,  498.56);

  -- 27. globe 1,999.00 -- Alan paid, equal 3-way
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'globe', 1999.00, c_util, alan, p_equal, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 666.33), (exp_id, cel, 'equal', 666.33), (exp_id, len, 'equal', 666.34);

  -- 28. Petshop 440.00 -- Len paid, equal 3-way
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Petshop', 440.00, c_pet, len, p_equal, len) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 146.67), (exp_id, cel, 'equal', 146.67), (exp_id, len, 'equal', 146.66);

  -- 29. Shopee 1,136.00 -- Cel paid, equal 3-way
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Shopee', 1136.00, c_shop, cel, p_equal, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 378.67), (exp_id, cel, 'equal', 378.67), (exp_id, len, 'equal', 378.66);

  -- 30. Lbc 314.00 -- Cel paid, Len only
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Lbc', 314.00, c_other, cel, p_len, cel) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, percentage, calculated_amount) values
    (exp_id, len, 'percentage', 100, 314.00);

  -- 31. Shopee 1,416.00 -- Alan paid, equal 3-way
  insert into public.expenses (expense_date, merchant, total_amount, category_id, paid_by_user_id, split_preset_id, created_by)
  values (jan, 'Shopee', 1416.00, c_shop, alan, p_equal, alan) returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 472.00), (exp_id, cel, 'equal', 472.00), (exp_id, len, 'equal', 472.00);
end $$;
