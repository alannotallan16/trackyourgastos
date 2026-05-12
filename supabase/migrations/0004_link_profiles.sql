-- ============================================================================
-- Link auth.users to profiles for Alan / Mari Cel / Mari Len.
--
-- Run AFTER creating the three auth users in Supabase Auth (Dashboard >
-- Authentication > Add user), one per real email. Then update the emails
-- below, run this file, and the profiles + a default "Equal 3-way" split
-- preset will be created.
-- ============================================================================

-- Replace these emails with the real ones used to sign up:
do $$
declare
  alan_email text := 'lanskie16@gmail.com';
  cel_email  text := 'marieramos.hcs@gmail.com';
  len_email  text := 'ramosmari24@gmail.com';
  alan_id uuid;
  cel_id  uuid;
  len_id  uuid;
  preset_id uuid;
begin
  select id into alan_id from auth.users where email = alan_email;
  select id into cel_id  from auth.users where email = cel_email;
  select id into len_id  from auth.users where email = len_email;

  if alan_id is null or cel_id is null or len_id is null then
    raise exception 'One or more auth users are missing. Create them in Supabase Auth first.';
  end if;

  insert into public.profiles (id, display_name, short_name)
  values (alan_id, 'Alan', 'alan')
  on conflict (id) do update set display_name = excluded.display_name, short_name = excluded.short_name;

  insert into public.profiles (id, display_name, short_name)
  values (cel_id, 'Mari Cel', 'cel')
  on conflict (id) do update set display_name = excluded.display_name, short_name = excluded.short_name;

  insert into public.profiles (id, display_name, short_name)
  values (len_id, 'Mari Len', 'len')
  on conflict (id) do update set display_name = excluded.display_name, short_name = excluded.short_name;

  -- Default presets
  insert into public.split_presets (name, description, split_type)
  values ('Equal 3-way', 'Equal split between Alan, Mari Cel, Mari Len', 'equal')
  on conflict (name) do nothing
  returning id into preset_id;

  if preset_id is null then
    select id into preset_id from public.split_presets where name = 'Equal 3-way';
  end if;

  insert into public.split_preset_members (preset_id, user_id) values
    (preset_id, alan_id), (preset_id, cel_id), (preset_id, len_id)
  on conflict do nothing;

  -- Alan only / Cel only / Len only
  insert into public.split_presets (name, description, split_type) values
    ('Alan only', 'Paid by and shared 100% by Alan', 'percentage'),
    ('Cel only',  'Paid by and shared 100% by Mari Cel', 'percentage'),
    ('Len only',  'Paid by and shared 100% by Mari Len', 'percentage')
  on conflict (name) do nothing;

  insert into public.split_preset_members (preset_id, user_id, percentage)
  select sp.id, alan_id, 100 from public.split_presets sp where sp.name = 'Alan only'
  on conflict do nothing;
  insert into public.split_preset_members (preset_id, user_id, percentage)
  select sp.id, cel_id, 100 from public.split_presets sp where sp.name = 'Cel only'
  on conflict do nothing;
  insert into public.split_preset_members (preset_id, user_id, percentage)
  select sp.id, len_id, 100 from public.split_presets sp where sp.name = 'Len only'
  on conflict do nothing;

  -- Alan 50% / Cel 25% / Len 25%
  insert into public.split_presets (name, description, split_type) values
    ('Alan 50 / Cel 25 / Len 25', 'Weighted split', 'percentage')
  on conflict (name) do nothing;
  insert into public.split_preset_members (preset_id, user_id, percentage)
  select sp.id, alan_id, 50 from public.split_presets sp where sp.name = 'Alan 50 / Cel 25 / Len 25'
  on conflict do nothing;
  insert into public.split_preset_members (preset_id, user_id, percentage)
  select sp.id, cel_id, 25 from public.split_presets sp where sp.name = 'Alan 50 / Cel 25 / Len 25'
  on conflict do nothing;
  insert into public.split_preset_members (preset_id, user_id, percentage)
  select sp.id, len_id, 25 from public.split_presets sp where sp.name = 'Alan 50 / Cel 25 / Len 25'
  on conflict do nothing;
end $$;
