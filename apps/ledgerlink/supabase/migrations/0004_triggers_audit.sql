-- LedgerLink — 0004 triggers: profile bootstrap, updated_at, audit logging

-- Create a profile row automatically when an auth user is created.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- updated_at maintenance
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','contacts','obligations','invoices'] loop
    execute format('drop trigger if exists %I_set_updated on %I;', t, t);
    execute format(
      'create trigger %I_set_updated before update on %I for each row execute function set_updated_at();',
      t, t);
  end loop;
end $$;

-- Audit logging for financial mutations. Historical records are never silently
-- lost: every insert/update/delete captures before/after jsonb.
create or replace function audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if (tg_op = 'DELETE') then
    v_owner := old.owner_id; v_before := to_jsonb(old); v_after := null;
  elsif (tg_op = 'UPDATE') then
    v_owner := new.owner_id; v_before := to_jsonb(old); v_after := to_jsonb(new);
  else
    v_owner := new.owner_id; v_before := null; v_after := to_jsonb(new);
  end if;

  insert into audit_logs(owner_id, actor, actor_label, action, entity_type, entity_id, before, after)
  values (
    v_owner,
    auth.uid(),
    case when auth.uid() is null then 'system' else 'owner' end,
    tg_op || '_' || tg_table_name,
    tg_table_name,
    coalesce((v_after->>'id')::uuid, (v_before->>'id')::uuid),
    v_before,
    v_after
  );

  if (tg_op = 'DELETE') then return old; else return new; end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['obligations','installments','payments','invoices','linked_obligations'] loop
    execute format('drop trigger if exists %I_audit on %I;', t, t);
    execute format(
      'create trigger %I_audit after insert or update or delete on %I for each row execute function audit_row();',
      t, t);
  end loop;
end $$;
