-- ============================================================================
-- Seed data: categories + common merchant rules.
--
-- NOTE: profiles for Alan / Mari Cel / Mari Len are linked to auth.users rows
-- and must be created via the Supabase Auth dashboard or the seed script in
-- scripts/seed.ts (uses the service-role key). After auth users exist, run
-- supabase/migrations/0004_link_profiles.sql or the helper SQL in README.
-- ============================================================================

-- ---------- categories ----------
insert into public.categories (name) values
  ('Grocery'),
  ('Utilities'),
  ('Pets'),
  ('Dining'),
  ('Rent'),
  ('Shopping'),
  ('Transportation'),
  ('Subscription'),
  ('Household'),
  ('Other')
on conflict (name) do nothing;

-- ---------- merchant rules ----------
insert into public.merchant_rules (keyword, suggested_category_id)
select v.keyword, c.id
from (values
  ('landers',    'Grocery'),
  ('sm store',   'Grocery'),
  ('sm super',   'Grocery'),
  ('puregold',   'Grocery'),
  ('robinsons supermarket', 'Grocery'),
  ('netflix',    'Subscription'),
  ('spotify',    'Subscription'),
  ('youtube',    'Subscription'),
  ('hbo',        'Subscription'),
  ('disney',     'Subscription'),
  ('icloud',     'Subscription'),
  ('pelco',      'Utilities'),
  ('meralco',    'Utilities'),
  ('manila water','Utilities'),
  ('globe',      'Utilities'),
  ('pldt',       'Utilities'),
  ('converge',   'Utilities'),
  ('sky',        'Utilities'),
  ('rent',       'Rent'),
  ('petshop',    'Pets'),
  ('petsup',     'Pets'),
  ('pet express','Pets'),
  ('vet',        'Pets'),
  ('jollibee',   'Dining'),
  ('mcdonald',   'Dining'),
  ('starbucks',  'Dining'),
  ('chowking',   'Dining'),
  ('kfc',        'Dining'),
  ('mang inasal','Dining'),
  ('grab',       'Transportation'),
  ('angkas',     'Transportation'),
  ('joyride',    'Transportation'),
  ('shopee',     'Shopping'),
  ('lazada',     'Shopping'),
  ('zalora',     'Shopping'),
  ('uniqlo',     'Shopping'),
  ('ikea',       'Household'),
  ('ace hardware','Household')
) as v(keyword, category_name)
join public.categories c on c.name = v.category_name
where not exists (
  select 1 from public.merchant_rules m where lower(m.keyword) = lower(v.keyword)
);
