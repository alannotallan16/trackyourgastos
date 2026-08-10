-- LedgerLink — 0003 ledger views (authoritative balances)
-- These views ARE the source of truth for balances/status. The client never
-- computes or sends a balance. security_invoker=on so per-user RLS on the base
-- tables still applies when querying through the view.

-- ---------- per-installment ledger ----------
create or replace view installment_ledger
with (security_invoker = on) as
select
  i.id,
  i.owner_id,
  i.obligation_id,
  i.seq,
  i.due_date,
  i.principal_amount,
  i.interest_amount,
  i.fees_amount,
  i.total_amount            as total_due,
  coalesce(a.paid, 0)       as paid,
  greatest(i.total_amount - coalesce(a.paid, 0), 0) as remaining,
  case
    when i.override_status = 'waived'    then 'waived'
    when i.override_status = 'cancelled' then 'cancelled'
    when coalesce(a.paid, 0) >= i.total_amount then 'paid'
    when (i.due_date + (o.grace_period_days || ' days')::interval)::date < current_date then 'overdue'
    when coalesce(a.paid, 0) > 0 then 'partial'
    when i.due_date <= current_date then 'due'
    else 'upcoming'
  end as status
from installments i
join obligations o on o.id = i.obligation_id
left join (
  select pa.installment_id, sum(pa.amount) as paid
  from payment_allocations pa
  join payments p on p.id = pa.payment_id
  where p.status = 'approved'
  group by pa.installment_id
) a on a.installment_id = i.id;

-- ---------- per-obligation ledger ----------
create or replace view obligation_ledger
with (security_invoker = on) as
with base as (
  select
    o.*,
    coalesce(s.scheduled_total, o.principal_original + o.processing_fee + o.other_fees) as scheduled_total,
    coalesce(s.installment_count, 0) as installment_count,
    coalesce(p.paid_total, 0)        as paid_total,
    coalesce(od.overdue_amount, 0)   as overdue_amount
  from obligations o
  left join (
    select obligation_id,
           sum(total_amount) filter (where override_status <> 'cancelled') as scheduled_total,
           count(*) as installment_count
    from installments group by obligation_id
  ) s on s.obligation_id = o.id
  left join (
    select obligation_id, sum(amount) as paid_total
    from payments where status = 'approved' group by obligation_id
  ) p on p.obligation_id = o.id
  left join (
    select obligation_id, sum(remaining) as overdue_amount
    from installment_ledger where status = 'overdue' group by obligation_id
  ) od on od.obligation_id = o.id
),
nextdue as (
  select distinct on (obligation_id)
    obligation_id, due_date as next_due_date, remaining as next_due_amount
  from installment_ledger
  where remaining > 0 and status not in ('waived','cancelled')
  order by obligation_id, due_date asc
)
select
  b.id, b.owner_id, b.direction, b.name, b.counterparty_name, b.contact_id,
  b.currency_code, b.status, b.principal_original, b.start_date, b.due_date,
  b.scheduled_total, b.installment_count, b.paid_total, b.overdue_amount,
  greatest(b.scheduled_total - b.paid_total, 0) as remaining,
  case when b.scheduled_total > 0
       then least(100, round(b.paid_total / b.scheduled_total * 100, 2))
       else 0 end as progress_pct,
  nd.next_due_date, nd.next_due_amount
from base b
left join nextdue nd on nd.obligation_id = b.id;

-- ---------- linked-obligation coverage (this calendar month) ----------
create or replace view link_coverage
with (security_invoker = on) as
select
  l.id, l.owner_id, l.source_obligation_id, l.target_obligation_id, l.note,
  so.name as source_name, so.counterparty_name as source_counterparty,
  to2.name as target_name, to2.counterparty_name as target_counterparty,
  coalesce(inc.expected, 0) as incoming_expected,
  coalesce(outg.due, 0)     as outgoing_due,
  coalesce(rec.received, 0) as incoming_received,
  case when coalesce(outg.due, 0) > 0
       then round(coalesce(inc.expected, 0) / outg.due * 100, 2)
       else null end as coverage_pct,
  greatest(coalesce(outg.due, 0) - coalesce(inc.expected, 0), 0) as shortfall,
  case
    when coalesce(outg.due, 0) = 0 then 'covered'
    when coalesce(inc.expected, 0) >= outg.due then 'covered'
    when coalesce(inc.expected, 0) > 0 then 'partially_covered'
    else 'underfunded'
  end as coverage_status
from linked_obligations l
join obligations so  on so.id  = l.source_obligation_id
join obligations to2 on to2.id = l.target_obligation_id
left join (
  select obligation_id, sum(total_amount) as expected
  from installments
  where override_status <> 'cancelled'
    and due_date >= date_trunc('month', current_date)::date
    and due_date <  (date_trunc('month', current_date) + interval '1 month')::date
  group by obligation_id
) inc on inc.obligation_id = l.source_obligation_id
left join (
  select obligation_id, sum(total_amount) as due
  from installments
  where override_status <> 'cancelled'
    and due_date >= date_trunc('month', current_date)::date
    and due_date <  (date_trunc('month', current_date) + interval '1 month')::date
  group by obligation_id
) outg on outg.obligation_id = l.target_obligation_id
left join (
  select obligation_id, sum(amount) as received
  from payments
  where status = 'approved'
    and paid_at >= date_trunc('month', current_date)::date
    and paid_at <  (date_trunc('month', current_date) + interval '1 month')::date
  group by obligation_id
) rec on rec.obligation_id = l.source_obligation_id;
