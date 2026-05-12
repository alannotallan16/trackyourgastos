-- ============================================================================
-- Optional sample expenses (idempotent-ish; safe to run multiple times only
-- after wiping). Run AFTER 0004_link_profiles.sql so profiles exist.
-- ============================================================================

do $$
declare
  alan uuid; cel uuid; len uuid;
  c_grocery uuid; c_util uuid; c_rent uuid; c_sub uuid; c_din uuid; c_pet uuid; c_shop uuid;
  preset_equal uuid;
  exp_id uuid;
begin
  select id into alan from public.profiles where short_name = 'alan';
  select id into cel  from public.profiles where short_name = 'cel';
  select id into len  from public.profiles where short_name = 'len';
  if alan is null or cel is null or len is null then return; end if;

  select id into c_grocery from public.categories where name = 'Grocery';
  select id into c_util    from public.categories where name = 'Utilities';
  select id into c_rent    from public.categories where name = 'Rent';
  select id into c_sub     from public.categories where name = 'Subscription';
  select id into c_din     from public.categories where name = 'Dining';
  select id into c_pet     from public.categories where name = 'Pets';
  select id into c_shop    from public.categories where name = 'Shopping';
  select id into preset_equal from public.split_presets where name = 'Equal 3-way';

  -- Helper inline: insert one sample expense + 3 equal splits
  -- Landers grocery (Alan paid)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, split_preset_id, created_by)
  values (current_date - 5, 'Landers', 3000.00, 'PHP', c_grocery, alan, preset_equal, alan)
  returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 1000.00), (exp_id, cel, 'equal', 1000.00), (exp_id, len, 'equal', 1000.00);

  -- Pelco (Cel paid)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, split_preset_id, created_by)
  values (current_date - 4, 'Pelco', 1500.00, 'PHP', c_util, cel, preset_equal, cel)
  returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 500.00), (exp_id, cel, 'equal', 500.00), (exp_id, len, 'equal', 500.00);

  -- Netflix (Len paid)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, split_preset_id, created_by)
  values (current_date - 3, 'Netflix', 549.00, 'PHP', c_sub, len, preset_equal, len)
  returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 183.00), (exp_id, cel, 'equal', 183.00), (exp_id, len, 'equal', 183.00);

  -- Rent (Alan paid)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, split_preset_id, created_by)
  values (date_trunc('month', current_date), 'Rent', 18000.00, 'PHP', c_rent, alan, preset_equal, alan)
  returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 6000.00), (exp_id, cel, 'equal', 6000.00), (exp_id, len, 'equal', 6000.00);

  -- Globe (Cel paid)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, split_preset_id, created_by)
  values (current_date - 2, 'Globe', 1999.00, 'PHP', c_util, cel, preset_equal, cel)
  returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 666.33), (exp_id, cel, 'equal', 666.33), (exp_id, len, 'equal', 666.34);

  -- Petsup (Len paid)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, split_preset_id, created_by)
  values (current_date - 1, 'Petsup', 850.00, 'PHP', c_pet, len, preset_equal, len)
  returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 283.33), (exp_id, cel, 'equal', 283.33), (exp_id, len, 'equal', 283.34);

  -- Jollibee (Alan paid)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, split_preset_id, created_by)
  values (current_date, 'Jollibee', 540.00, 'PHP', c_din, alan, preset_equal, alan)
  returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 180.00), (exp_id, cel, 'equal', 180.00), (exp_id, len, 'equal', 180.00);

  -- Shopee (Cel paid)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, split_preset_id, created_by)
  values (current_date - 6, 'Shopee', 1250.00, 'PHP', c_shop, cel, preset_equal, cel)
  returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 416.67), (exp_id, cel, 'equal', 416.67), (exp_id, len, 'equal', 416.66);

  -- SM Store (Len paid)
  insert into public.expenses (expense_date, merchant, total_amount, currency, category_id, paid_by_user_id, split_preset_id, created_by)
  values (current_date - 7, 'SM Store', 2300.00, 'PHP', c_grocery, len, preset_equal, len)
  returning id into exp_id;
  insert into public.expense_splits (expense_id, user_id, split_type, calculated_amount) values
    (exp_id, alan, 'equal', 766.67), (exp_id, cel, 'equal', 766.67), (exp_id, len, 'equal', 766.66);

  -- Sample recurring templates
  insert into public.recurring_expenses (merchant, category_id, amount, currency, paid_by_user_id, split_preset_id, frequency, next_due_date, active, created_by)
  values
    ('Netflix', c_sub, 549.00, 'PHP', len, preset_equal, 'monthly', date_trunc('month', current_date + interval '1 month'), true, len),
    ('Globe',   c_util, 1999.00, 'PHP', cel, preset_equal, 'monthly', date_trunc('month', current_date + interval '1 month'), true, cel),
    ('Pelco',   c_util, 1500.00, 'PHP', cel, preset_equal, 'monthly', date_trunc('month', current_date + interval '1 month'), true, cel),
    ('Rent',    c_rent, 18000.00, 'PHP', alan, preset_equal, 'monthly', date_trunc('month', current_date + interval '1 month'), true, alan);
end $$;
