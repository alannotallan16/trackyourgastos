-- LedgerLink — 0006 demo seed function
-- Call after creating an auth user:   select seed_demo('<user-uuid>');
-- Idempotent-ish: it no-ops if the user already has obligations.

create or replace function seed_demo(p_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c_sister uuid; c_jun uuid; c_cust uuid;
  ob_ub uuid; ob_sis uuid; ob_done uuid; ob_overdue uuid; ob_bankB uuid;
  r numeric := 0.016175;         -- monthly rate derived from the UnionBank schedule
  pay numeric := 23658.87;       -- UnionBank monthly amortization
  bal numeric; d date; inte numeric; prin numeric; i int;
  inst1 uuid; inst2 uuid; inst3 uuid; pay_id uuid; tok text;
begin
  if exists (select 1 from obligations where owner_id = p_owner) then
    return;
  end if;

  insert into profiles(id, display_name) values (p_owner, 'Demo User')
    on conflict (id) do update set display_name = coalesce(nullif(profiles.display_name,''),'Demo User');

  -- ---- contacts ----
  insert into contacts(owner_id,name,email,phone,notes)
    values (p_owner,'Mari Cel (Sister)','sister@example.com','+639170000001','Received the UnionBank proceeds')
    returning id into c_sister;
  insert into contacts(owner_id,name,email)
    values (p_owner,'Jun (Friend)','jun@example.com') returning id into c_jun;
  insert into contacts(owner_id,name,email)
    values (p_owner,'ABC Trading (Client)','ap@abctrading.example') returning id into c_cust;

  -- ================= OBLIGATION A: I owe UnionBank =================
  insert into obligations(owner_id,direction,name,counterparty_name,currency_code,
      principal_original,interest_rate,interest_type,processing_fee,start_date,
      frequency,num_installments,grace_period_days,status,notes)
    values (p_owner,'i_owe','UnionBank EasyCash','UnionBank','PHP',
      904160.70,21.23,'amortized',900.00,date '2026-08-15',
      'monthly',60,3,'active','Proceeds given to sister; see linked obligation')
    returning id into ob_ub;

  bal := 904160.70; d := date '2026-08-15';
  for i in 1..60 loop
    inte := round(bal * r, 2);
    if i < 60 then prin := round(pay - inte, 2); else prin := bal; end if;
    if prin > bal then prin := bal; end if;
    insert into installments(owner_id,obligation_id,seq,due_date,principal_amount,interest_amount,fees_amount,total_amount)
      values (p_owner, ob_ub, i, d, prin, inte, 0, prin + inte);
    bal := bal - prin;
    d := d + interval '1 month';
  end loop;
  -- I paid UnionBank installment 1
  select id into inst1 from installments where obligation_id = ob_ub and seq = 1;
  insert into payments(owner_id,obligation_id,amount,paid_at,method,reference,direction,status,submitted_by)
    values (p_owner, ob_ub, pay, date '2026-08-15','bank_transfer','UB-AUTO-0001','i_owe','approved','owner')
    returning id into pay_id;
  insert into payment_allocations(owner_id,payment_id,installment_id,amount) values (p_owner,pay_id,inst1,pay);

  -- ================= OBLIGATION B: Sister owes me (mirrors A) =================
  insert into obligations(owner_id,direction,name,contact_id,counterparty_name,currency_code,
      principal_original,interest_type,start_date,frequency,num_installments,grace_period_days,status,notes)
    values (p_owner,'owed_to_me','Sister — UnionBank repayment',c_sister,'Mari Cel (Sister)','PHP',
      904160.70,'none',date '2026-08-15','monthly',60,5,'active','Repays my UnionBank EasyCash')
    returning id into ob_sis;

  bal := 904160.70; d := date '2026-08-15';
  for i in 1..60 loop
    inte := round(bal * r, 2);
    if i < 60 then prin := round(pay - inte, 2); else prin := bal; end if;
    if prin > bal then prin := bal; end if;
    insert into installments(owner_id,obligation_id,seq,due_date,principal_amount,interest_amount,fees_amount,total_amount)
      values (p_owner, ob_sis, i, d, prin, inte, 0, prin + inte);
    bal := bal - prin;
    d := d + interval '1 month';
  end loop;
  select id into inst1 from installments where obligation_id = ob_sis and seq = 1;
  select id into inst2 from installments where obligation_id = ob_sis and seq = 2;
  select id into inst3 from installments where obligation_id = ob_sis and seq = 3;

  -- Sister fully paid installment 1 (approved)
  insert into payments(owner_id,obligation_id,contact_id,amount,paid_at,method,reference,direction,status,submitted_by,submitter_name)
    values (p_owner, ob_sis, c_sister, pay, date '2026-08-14','gcash','GC-8842','owed_to_me','approved','owner','Mari Cel')
    returning id into pay_id;
  insert into payment_allocations(owner_id,payment_id,installment_id,amount) values (p_owner,pay_id,inst1,pay);

  -- Sister partially paid installment 2 (PHP 15,000 of 23,658.87)
  insert into payments(owner_id,obligation_id,contact_id,amount,paid_at,method,reference,direction,status,submitted_by,submitter_name)
    values (p_owner, ob_sis, c_sister, 15000.00, date '2026-09-15','gcash','GC-9001','owed_to_me','approved','owner','Mari Cel')
    returning id into pay_id;
  insert into payment_allocations(owner_id,payment_id,installment_id,amount) values (p_owner,pay_id,inst2,15000.00);

  -- Sister submitted proof for installment 3 — PENDING review
  insert into payments(owner_id,obligation_id,contact_id,amount,paid_at,method,reference,notes,direction,status,submitted_by,submitter_name)
    values (p_owner, ob_sis, c_sister, pay, date '2026-10-15','maya','MAYA-7781','Sent via Maya','owed_to_me','pending','external','Mari Cel')
    returning id into pay_id;

  -- Invoice to sister for installment 3
  tok := encode(gen_random_bytes(24),'hex');
  insert into invoices(owner_id,obligation_id,installment_id,contact_id,number,title,amount,due_date,status,public_token,notes)
    values (p_owner, ob_sis, inst3, c_sister,'INV-000001','Monthly repayment for UnionBank EasyCash',
            pay, date '2026-10-15','sent',tok,'Installment 3 of 60');

  -- Link: Sister repayment (source) funds UnionBank (target)
  insert into linked_obligations(owner_id,source_obligation_id,target_obligation_id,note)
    values (p_owner, ob_sis, ob_ub, 'Sister repayment funds UnionBank EasyCash');

  -- ================= Completed loan: Jun paid back 50,000 =================
  insert into obligations(owner_id,direction,name,contact_id,counterparty_name,currency_code,
      principal_original,interest_type,start_date,frequency,num_installments,status,notes)
    values (p_owner,'owed_to_me','Jun personal loan',c_jun,'Jun (Friend)','PHP',
      50000.00,'none',date '2026-05-01','one_time',1,'completed','Paid in full')
    returning id into ob_done;
  insert into installments(owner_id,obligation_id,seq,due_date,principal_amount,interest_amount,fees_amount,total_amount)
    values (p_owner, ob_done, 1, date '2026-06-01', 50000.00, 0, 0, 50000.00) returning id into inst1;
  insert into payments(owner_id,obligation_id,contact_id,amount,paid_at,method,direction,status,submitted_by)
    values (p_owner, ob_done, c_jun, 50000.00, date '2026-05-28','cash','owed_to_me','approved','owner')
    returning id into pay_id;
  insert into payment_allocations(owner_id,payment_id,installment_id,amount) values (p_owner,pay_id,inst1,50000.00);

  -- ================= Overdue receivable: client owes 120,000 =================
  insert into obligations(owner_id,direction,name,contact_id,counterparty_name,currency_code,
      principal_original,interest_type,start_date,frequency,num_installments,status,notes)
    values (p_owner,'owed_to_me','ABC Trading invoice',c_cust,'ABC Trading (Client)','PHP',
      120000.00,'none',date '2026-05-10','monthly',3,'active','Overdue receivable')
    returning id into ob_overdue;
  d := date '2026-06-10';
  for i in 1..3 loop
    insert into installments(owner_id,obligation_id,seq,due_date,principal_amount,interest_amount,fees_amount,total_amount)
      values (p_owner, ob_overdue, i, d, 40000.00, 0, 0, 40000.00);
    d := d + interval '1 month';
  end loop;

  -- ================= Outgoing bank obligation: PSBank auto loan =================
  insert into obligations(owner_id,direction,name,counterparty_name,currency_code,
      principal_original,interest_rate,interest_type,processing_fee,start_date,frequency,num_installments,status,notes)
    values (p_owner,'i_owe','PSBank Auto Loan','PSBank','PHP',
      300000.00,12.00,'amortized',1500.00,date '2026-07-05','monthly',12,'active','Car financing')
    returning id into ob_bankB;
  d := date '2026-07-05';
  for i in 1..12 loop
    insert into installments(owner_id,obligation_id,seq,due_date,principal_amount,interest_amount,fees_amount,total_amount)
      values (p_owner, ob_bankB, i, d, 24000.00, 3000.00, 0, 27000.00);
    d := d + interval '1 month';
  end loop;
  -- first installment paid, second one now overdue/unpaid (depending on today)
  select id into inst1 from installments where obligation_id = ob_bankB and seq = 1;
  insert into payments(owner_id,obligation_id,amount,paid_at,method,reference,direction,status,submitted_by)
    values (p_owner, ob_bankB, 27000.00, date '2026-07-05','bank_transfer','PS-0001','i_owe','approved','owner')
    returning id into pay_id;
  insert into payment_allocations(owner_id,payment_id,installment_id,amount) values (p_owner,pay_id,inst1,27000.00);
end $$;

grant execute on function seed_demo(uuid) to authenticated, service_role;
