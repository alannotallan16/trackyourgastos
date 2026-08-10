-- LedgerLink — 0002 RLS
-- Per-user isolation enforced at the database. This is the primary IDOR defense:
-- even if application code forgets a filter, a user can only ever touch rows
-- whose owner_id = auth.uid(). The public invoice flow does NOT use these
-- policies — it goes through SECURITY DEFINER RPCs (0005) with the service role.

alter table profiles            enable row level security;
alter table contacts            enable row level security;
alter table categories          enable row level security;
alter table obligations         enable row level security;
alter table installments        enable row level security;
alter table payments            enable row level security;
alter table payment_allocations enable row level security;
alter table invoices            enable row level security;
alter table invoice_items       enable row level security;
alter table attachments         enable row level security;
alter table linked_obligations  enable row level security;
alter table notifications       enable row level security;
alter table audit_logs          enable row level security;

-- profiles: a user sees/edits only their own row
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- generic owner policy generator for the rest
do $$
declare t text;
begin
  foreach t in array array[
    'contacts','categories','obligations','installments','payments',
    'payment_allocations','invoices','invoice_items','attachments',
    'linked_obligations','notifications','audit_logs'
  ] loop
    execute format('drop policy if exists %I_owner on %I;', t, t);
    execute format(
      'create policy %I_owner on %I for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());',
      t, t);
  end loop;
end $$;

-- ---------- private storage bucket for documents / payment proofs ----------
insert into storage.buckets (id, name, public)
values ('ledgerlink-docs', 'ledgerlink-docs', false)
on conflict (id) do nothing;

-- Owners may manage objects under a folder named by their user id: "<uid>/...".
-- External uploads (invoice proofs) are written server-side with the service
-- role, which bypasses these policies.
drop policy if exists docs_read on storage.objects;
create policy docs_read on storage.objects for select
  using (bucket_id = 'ledgerlink-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists docs_write on storage.objects;
create policy docs_write on storage.objects for insert
  with check (bucket_id = 'ledgerlink-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists docs_delete on storage.objects;
create policy docs_delete on storage.objects for delete
  using (bucket_id = 'ledgerlink-docs' and (storage.foldername(name))[1] = auth.uid()::text);
