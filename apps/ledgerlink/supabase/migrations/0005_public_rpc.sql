-- LedgerLink — 0005 public invoice RPCs
-- The external debtor flow (no account) is authorized ONLY by an unguessable
-- token. These SECURITY DEFINER functions expose a fixed, minimal surface and
-- are the single place token logic lives. They bypass RLS by design but reveal
-- nothing beyond the single invoice the token names.

-- View an invoice by token; marks it viewed. Returns safe fields only.
create or replace function public_invoice_view(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_inv invoices; v_owner profiles; v_paid numeric;
begin
  select * into v_inv from invoices where public_token = p_token;
  if not found then return null; end if;

  if v_inv.status in ('sent','draft') then
    update invoices set status = 'viewed', viewed_at = coalesce(viewed_at, now())
    where id = v_inv.id;
  elsif v_inv.viewed_at is null then
    update invoices set viewed_at = now() where id = v_inv.id;
  end if;

  select * into v_owner from profiles where id = v_inv.owner_id;

  -- approved external/owner payments already credited to this invoice's obligation
  select coalesce(sum(amount),0) into v_paid
  from payments
  where obligation_id = v_inv.obligation_id and status = 'approved';

  return jsonb_build_object(
    'number', v_inv.number,
    'title', v_inv.title,
    'amount', v_inv.amount,
    'currency_code', v_inv.currency_code,
    'due_date', v_inv.due_date,
    'status', case when v_inv.status in ('sent','draft') then 'viewed' else v_inv.status end,
    'notes', v_inv.notes,
    'creditor_name', coalesce(nullif(v_owner.display_name, ''), 'The sender'),
    'payable', v_inv.obligation_id is not null,
    'obligation_paid', v_paid
  );
end $$;

-- Submit a payment against an invoice's obligation. Creates a PENDING payment
-- (external), returns its id + the owner id (so the caller can file the proof
-- under the owner's storage folder). Never reduces a balance until approved.
create or replace function public_invoice_submit(
  p_token text,
  p_amount numeric,
  p_method payment_method,
  p_reference text,
  p_note text,
  p_submitter_name text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_inv invoices; v_payment_id uuid;
begin
  select * into v_inv from invoices where public_token = p_token;
  if not found then raise exception 'invalid token'; end if;
  if v_inv.status in ('cancelled','paid') then raise exception 'invoice not open'; end if;
  if v_inv.obligation_id is null then raise exception 'invoice has no linked obligation'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;

  insert into payments(
    owner_id, obligation_id, contact_id, amount, currency_code, paid_at, method,
    reference, notes, direction, status, submitted_by, submitter_name
  )
  select
    v_inv.owner_id, v_inv.obligation_id, v_inv.contact_id, p_amount, v_inv.currency_code,
    current_date, p_method, p_reference, p_note, o.direction, 'pending', 'external', p_submitter_name
  from obligations o where o.id = v_inv.obligation_id
  returning id into v_payment_id;

  insert into notifications(owner_id, type, title, body, entity_type, entity_id)
  values (v_inv.owner_id, 'proof_submitted',
          'Payment submitted for ' || v_inv.number,
          coalesce(p_submitter_name,'Someone') || ' submitted ' || v_inv.currency_code || ' ' || p_amount::text,
          'payment', v_payment_id);

  return jsonb_build_object('payment_id', v_payment_id, 'owner_id', v_inv.owner_id);
end $$;

grant execute on function public_invoice_view(text) to anon, authenticated, service_role;
grant execute on function public_invoice_submit(text, numeric, payment_method, text, text, text)
  to anon, authenticated, service_role;
