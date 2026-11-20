# PR #26 — Close batch, auto-split payments, household balances strip

Branch: `claude/close-batch-and-balances-strip` (rebased on `main` @ b07ed15 after #25 merge).

## Rationale

After #25 the dashboard tells the household _what_ to pay and _which_ batch row each suggestion is composed of, but three gaps the row-by-row payment plan ran into remain:

1. **Zombie batches.** ST-0011 and ST-0014 still carry open rows that don't match today's reality (`Alan→Len ₱15k` when Alan's net is +₱1,002). The user can pay the stale row to close the batch, but there's no first-class way to say "forgive this row, the debt is already accounted for elsewhere." Writing a ₱15k fake payment would corrupt the integrity audit.
2. **Pair totals that span batches.** Cel owes Len across ST-0011 Cel→Len (₱60k left) and will owe her across any new batch; today Record jumps to one specific `batch_result`. For multi-batch pairs the user wants to say "pay Len ₱30k, allocate it across whatever's open."
3. **No per-person progress view.** Hero shows the signed-in user's net; Settle Up shows suggestions. There's no "where does everyone stand _now_" line, which is how the household actually tracks the installment plan.

11 items cover these plus the review feedback. Two unit tests seal the sequence math and the pair-isolation contract.

---

## 1. Migration 0007 — `reconciled` status + `reconciled_amount` column

`supabase/migrations/0007_close_batch.sql`.

Touches:
- `settlement_batches` (CHECK constraint rewritten)
- `settlement_batch_results` (CHECK constraint rewritten, new `reconciled_amount` column)

**Back these two tables up before applying.** The RPC functions in items 2 and 4 are `create or replace`, so they can be redeployed; the two `alter table` statements are the ones that need a backup.

Full SQL:

```sql
-- ============================================================================
-- 0007_close_batch.sql
-- Adds the "reconciled" terminal status (both batch-level and result-level) and
-- a reconciled_amount column that captures the forgiven-leg at close time
-- without polluting amount_paid (which must stay exactly equal to the sum of
-- settlement_payments rows for the integrity audit to work).
--
-- Also adds two RPC functions so reconcile-many-rows and
-- record-payment-across-a-pair each run in a single Postgres transaction:
--
--   reconcile_batch_rows(batch_id uuid, result_ids uuid[])
--   record_payment_for_pair(from, to, amount, date, method, notes,
--                           ref, attachment, created_by, preview_only)
--
-- Run AFTER 0006_settlement_batches.sql.
-- Safe to re-run: every create is "or replace", column add is "if not exists",
-- constraints are drop-if-exists / add.
-- ============================================================================

-- 1. Add reconciled_amount column -------------------------------------------
alter table public.settlement_batch_results
  add column if not exists reconciled_amount numeric(14,2) not null default 0
    check (reconciled_amount >= 0);

-- 2. Extend batch-level status check ----------------------------------------
alter table public.settlement_batches
  drop constraint if exists settlement_batches_status_check;
alter table public.settlement_batches
  add constraint settlement_batches_status_check
    check (status in ('open','partially_paid','paid','cancelled','reconciled'));

-- 3. Extend result-level status check ---------------------------------------
alter table public.settlement_batch_results
  drop constraint if exists settlement_batch_results_status_check;
alter table public.settlement_batch_results
  add constraint settlement_batch_results_status_check
    check (status in ('open','partially_paid','paid','reconciled'));

-- 4. Internal helper: roll up a batch's status given its results' statuses.
--    Also keeps the batch's splits in sync. Used by both RPCs below.
create or replace function public.rollup_batch_status(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_terminal int;
  v_any_progress int;
begin
  select
    count(*),
    count(*) filter (where status in ('paid','reconciled')),
    count(*) filter (where status in ('partially_paid','paid','reconciled'))
  into v_total, v_terminal, v_any_progress
  from public.settlement_batch_results
  where settlement_batch_id = p_batch_id;

  if v_total = 0 then
    return;
  end if;

  if v_terminal = v_total then
    -- Every result is terminal: batch moves to reconciled if ANY result was
    -- reconciled (not just paid), else "paid". Splits flip to settled.
    update public.settlement_batches
      set status = case
        when exists (
          select 1 from public.settlement_batch_results
          where settlement_batch_id = p_batch_id and status = 'reconciled'
        ) then 'reconciled'
        else 'paid'
      end
      where id = p_batch_id;

    update public.expense_splits
      set settlement_status = 'settled',
          settled_at = now()
      where id in (
        select expense_split_id
        from public.settlement_batch_items
        where settlement_batch_id = p_batch_id
      );
  else
    update public.settlement_batches
      set status = case when v_any_progress > 0 then 'partially_paid' else 'open' end
      where id = p_batch_id;

    update public.expense_splits
      set settlement_status = 'in_settlement',
          settled_at = null
      where id in (
        select expense_split_id
        from public.settlement_batch_items
        where settlement_batch_id = p_batch_id
      );
  end if;
end;
$$;

-- 5. RPC: reconcile_batch_rows ---------------------------------------------
create or replace function public.reconcile_batch_rows(
  p_batch_id uuid,
  p_result_ids uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_touched int;
begin
  if not public.is_household_member() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select status into v_status
    from public.settlement_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Batch not found' using errcode = 'P0002';
  end if;
  if v_status in ('cancelled','reconciled') then
    raise exception 'Batch is already %', v_status using errcode = 'P0001';
  end if;

  if array_length(p_result_ids, 1) is null then
    raise exception 'No rows selected' using errcode = 'P0001';
  end if;

  -- Validate: every id belongs to this batch AND is not already terminal.
  if exists (
    select 1 from unnest(p_result_ids) as rid
    where not exists (
      select 1 from public.settlement_batch_results r
      where r.id = rid
        and r.settlement_batch_id = p_batch_id
        and r.status in ('open','partially_paid')
    )
  ) then
    raise exception 'One or more results are not open rows in this batch'
      using errcode = 'P0001';
  end if;

  update public.settlement_batch_results
    set status = 'reconciled',
        reconciled_amount = remaining_amount,
        remaining_amount = 0
    where id = any(p_result_ids);
  get diagnostics v_touched = row_count;

  perform public.rollup_batch_status(p_batch_id);

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'reconciled_count', v_touched
  );
end;
$$;

-- 6. RPC: record_payment_for_pair ------------------------------------------
create or replace function public.record_payment_for_pair(
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_notes text,
  p_reference_number text,
  p_attachment_path text,
  p_created_by uuid,
  p_preview_only boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pair_open numeric;
  v_remaining numeric;
  v_apply numeric;
  v_allocation jsonb := '[]'::jsonb;
  v_touched_batches uuid[] := array[]::uuid[];
  r record;
begin
  if not public.is_household_member() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive' using errcode = 'P0001';
  end if;
  if p_from_user_id = p_to_user_id then
    raise exception 'Payer and payee must differ' using errcode = 'P0001';
  end if;

  select coalesce(sum(remaining_amount), 0) into v_pair_open
    from public.settlement_batch_results
    where from_user_id = p_from_user_id
      and to_user_id   = p_to_user_id
      and status in ('open','partially_paid');

  if p_amount > v_pair_open + 0.005 then
    raise exception '% is more than the % open between this pair. Create a settlement first.',
      to_char(p_amount, 'FM999,999,990.00'),
      to_char(v_pair_open, 'FM999,999,990.00')
      using errcode = 'P0001';
  end if;

  v_remaining := p_amount;
  for r in
    select r.id            as result_id,
           r.settlement_batch_id,
           r.remaining_amount,
           r.currency,
           b.settlement_number,
           b.created_at     as batch_created_at
    from public.settlement_batch_results r
    join public.settlement_batches b on b.id = r.settlement_batch_id
    where r.from_user_id = p_from_user_id
      and r.to_user_id   = p_to_user_id
      and r.status in ('open','partially_paid')
    order by b.created_at asc, r.id asc
    for update of r
  loop
    exit when v_remaining <= 0.005;
    v_apply := least(v_remaining, r.remaining_amount);
    v_allocation := v_allocation || jsonb_build_object(
      'result_id',      r.result_id,
      'batch_id',       r.settlement_batch_id,
      'batch_number',   r.settlement_number,
      'apply_amount',   round(v_apply, 2),
      'was_remaining',  round(r.remaining_amount, 2),
      'will_leave',     round(r.remaining_amount - v_apply, 2)
    );
    v_remaining := v_remaining - v_apply;

    if not p_preview_only then
      insert into public.settlement_payments (
        settlement_batch_result_id, payment_date, amount, currency,
        payment_method, notes, reference_number, attachment_path, created_by
      ) values (
        r.result_id, p_payment_date, round(v_apply, 2), r.currency,
        p_payment_method, p_notes, p_reference_number, p_attachment_path, p_created_by
      );

      update public.settlement_batch_results
        set amount_paid = round(amount_paid + v_apply, 2),
            remaining_amount = greatest(0, round(remaining_amount - v_apply, 2)),
            status = case
              when round(remaining_amount - v_apply, 2) <= 0.005 then 'paid'
              else 'partially_paid'
            end
        where id = r.result_id;

      v_touched_batches := v_touched_batches || r.settlement_batch_id;
    end if;
  end loop;

  if not p_preview_only then
    perform public.rollup_batch_status(bid)
    from unnest(array(select distinct unnest(v_touched_batches))) as bid;
  end if;

  return jsonb_build_object(
    'preview_only', p_preview_only,
    'amount',       round(p_amount, 2),
    'pair_open',    round(v_pair_open, 2),
    'allocation',   v_allocation
  );
end;
$$;

-- 7. Lock down anon, grant only authenticated users --------------------------
-- rollup_batch_status is internal; callers never invoke it directly.
revoke all on function public.rollup_batch_status(uuid) from public, anon;

revoke all on function public.reconcile_batch_rows(uuid, uuid[]) from public, anon;
grant execute on function public.reconcile_batch_rows(uuid, uuid[]) to authenticated;

revoke all on function public.record_payment_for_pair(
  uuid, uuid, numeric, date, text, text, text, text, uuid, boolean
) from public, anon;
grant execute on function public.record_payment_for_pair(
  uuid, uuid, numeric, date, text, text, text, text, uuid, boolean
) to authenticated;
```

TypeScript side:
- `src/lib/types.ts` — add `'reconciled'` to `SettlementBatchStatus` and `SettlementBatchResultStatus`; add `reconciled_amount: number` to `SettlementBatchResult`.

## 2. Server action — `reconcileBatchRows(batchId, resultIds[])` via RPC

New export in `src/app/(app)/settlements/actions.ts`.

```ts
export async function reconcileBatchRows(batchId: string, resultIds: string[]) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");
  const { error } = await supabase.rpc("reconcile_batch_rows", {
    p_batch_id: batchId,
    p_result_ids: resultIds
  });
  if (error) throw new Error(error.message);
  revalidatePath("/settlements");
  revalidatePath(`/settlements/${batchId}`);
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}
```

All the mutation logic (validate, flip rows, rollup, flip splits) lives in the Postgres function, so the server action is a thin wrapper that only handles auth + revalidate. One Postgres transaction per call.

## 3. Close batch dialog on `/settlements/[id]`

New `src/components/settlements/CloseBatchDialog.tsx` (client component).

- Trigger: a **"Close batch"** button on the detail page (normal secondary style, not red), visible only when batch is `open` or `partially_paid` and at least one result has `remaining_amount > 0`.
- Modal body:
  - One row per open-or-partially-paid result: `[x] From → To — remaining ₱X.XX`.
  - All checkboxes **checked by default**.
  - A paid result is listed in a muted "Already paid — no action needed" subsection with a disabled checkbox; keeps the user oriented.
  - No "Total being reconciled" line (user's correction — sums different people's debts).
  - Optional notes textarea → passes through to a batch-level `notes` append (`"Closed by <name> on <date>: <notes>"`).
- CTA: **"Close selected rows"** (normal primary style — the same slate/green used for primary CTAs elsewhere, not red). Plus **"Cancel"** secondary.
- Submits to `reconcileBatchRows` via `useTransition`.

## 4. Server action — `recordPaymentForPair(fromId, toId, amount, …)` via RPC

New export in `settlements/actions.ts`. Delegates to the Postgres function.

Behavior (enforced by the Postgres function):
- Validates `amount > 0`, `from ≠ to`, caller is household member.
- Computes `pair_open = Σ remaining_amount for open|partially_paid rows where from/to matches`.
- **If `amount > pair_open + ₱0.005`** → hard error: `"₱X is more than the ₱Y open between this pair. Create a settlement first."` Nothing is written.
- Otherwise walks open rows oldest-batch-first, filling each up to its `remaining_amount` until `amount` is exhausted.
- When `preview_only: true`, returns the allocation JSON (list of `{result_id, batch_number, apply_amount, was_remaining, will_leave}`) without writing.
- When `preview_only: false`, inserts `settlement_payments` rows, updates each `settlement_batch_results`, rolls up each touched batch. All inside the function → one transaction.

**No auto-create-batch leftover path.** Expenses are three-way, so a batch built from unsettled expenses doesn't guarantee a single `from→to` result row for the pair — the user has to create a batch explicitly.

TS wrapper:

```ts
export async function recordPaymentForPair(payload: {
  from_user_id: string;
  to_user_id: string;
  amount: number;
  payment_date: string;
  payment_method?: string | null;
  notes?: string | null;
  reference_number?: string | null;
  attachment_path?: string | null;
  preview_only: boolean;
}): Promise<{ pair_open: number; allocation: AllocationRow[] }> { … }
```

Zod schema mirrors the inputs. On preview_only return, no revalidate. On real, revalidate the same set as `recordPayment`.

## 5. Record payment modal — two-step preview-before-save

New `src/components/settlements/RecordPaymentForPairModal.tsx` (client). **Two entry points**, both open the same modal:

- **A. From a Settle Up suggestion row** — pair pre-filled, read-only chip at top. Amount pre-filled with `min(pair_open, suggestion.amount)`.
- **B. From the standalone "Record payment" button on Settle Up (new in item 10)** — the top of Step 1 shows a `<select>` for payer and a `<select>` for payee (both bound to `profiles`, with the "same person both sides" combo blocked). On pair change, amount pre-fills with that pair's `pair_open` (computed client-side from the already-loaded `batchResults` prop — the RPC re-validates server-side so a stale client value can't bypass). If the pair has no open obligation, the form shows an inline error `"No open obligation for <A> → <B>. Create a settlement first."` and disables Preview.

Step 1 — form:
- Pair chip (variant A) or pair picker (variant B).
- **Amount** — editable `<input type="number" inputMode="decimal">`, pre-filled as above. Any positive value up to `pair_open` accepted. Over-the-cap input is blocked client-side with helper text `Max ₱X.XX (pair's open total)`; the RPC also hard-blocks server-side with the item 4 copy. Supports installment payments (Cel paying ₱20k now, ₱18k next week).
- Date (defaults today).
- Payment method — datalist from #7.
- Optional notes / reference / attachment.

Step 2 — preview:
- Submits inputs to `recordPaymentForPair({preview_only: true})` — **the RPC itself** returns the allocation. The UI does **not** reimplement the loop; it just renders the JSON that comes back.
- Rendered table:
  ```
  ST-0011 Cel→Len   apply ₱30,000.00   was ₱60,000.00 → will leave ₱30,000.00
  ST-0014 Cel→Len   apply ₱5,000.00    was ₱5,000.00  → will leave ₱0.00
  ```
  Only rows that received an allocation render. **No NEW BATCH row anywhere** (removed per item 4).
- **Back** returns to Step 1 without losing input.
- **Confirm** calls `recordPaymentForPair({preview_only: false})`.

## 6. Create Settlement — bidirectional pair warning

Edit `src/app/(app)/settlements/CreateBatchModal.tsx`.

- Compute for each unordered pair `{A, B}` implied by the selected expenses: `openAB = Σ remaining_amount for open|partially_paid rows where (from=A, to=B)` and `openBA = Σ remaining_amount for open|partially_paid rows where (from=B, to=A)`.
- **Threshold: fire when `max(openAB, openBA) > ₱1`.** Either direction alone is enough — don't require both.
- Banner (amber, non-blocking):
  ```
  Heads up — the household already has open debt between Alan and Mari Len.
  Current open totals: Alan→Len ₱12,500.00 (ST-0014), Len→Alan ₱0.00.
  Consider reconciling existing rows before creating a new batch that would
  layer on top of this pair.
  ```
- Each pair with open > ₱1 in either direction gets its own line inside one banner.

## 7. Payment method datalist

- New constant in `src/lib/payment-methods.ts`:
  ```ts
  export const PAYMENT_METHODS = ["Bank transfer", "Cash", "GCash", "Forgiven", "Other"] as const;
  ```
- Wire into:
  - The existing per-row Record Payment form (`/settlements/[id]`).
  - The new `RecordPaymentForPairModal`.
- Rendered as `<datalist>` under a free `<input>` so users can type a custom method too.
- `"Forgiven"` is a convention label; the recorded payment still writes a real `settlement_payments` row. When the user wants no cash leg, use `reconcileBatchRows` (item 2) instead.

## 8. `BatchStatusBadge` — reconciled styling

Edit the component rendering the chip (grep `partially_paid` to find the sites; expected: `SettlementsClient` and `/settlements/[id]`).

- `reconciled`: amber chip, text **"reconciled"**, tooltip **"Closed without payment. The balance is already counted elsewhere."**

## 9. `SettlementsClient` — show `reconciled` in History

- History filter adds `'reconciled'` alongside `'paid'` and `'cancelled'`.
- Sort stays `created_at desc`.

## 10. SettleUpCard — household balances strip + standalone Record payment

Edit `src/components/SettleUpCard.tsx`.

### 10a. Standalone "Record payment" button

- New primary button at the top-right of the card header, next to **"All settlements"**.
- Opens `RecordPaymentForPairModal` (item 5) in **variant B** — with the payer/payee picker.
- This is the escape hatch for payments the greedy suggestion won't propose. Alan's ₱15k to Len against ST-0011 is the motivating case: greedy doesn't route money through Alan because his net is +₱1,002, so no Settle Up suggestion for him exists — but the stale ST-0011 Alan→Len row is still there and he still needs to be able to record against it. The picker + `pair_open` pre-fill handles it.
- The per-suggestion Record link (variant A) still works the way it does today; this button is additive.

### 10b. Household balances strip

- New `householdBalances: UserBalance[]` prop (passed from `dashboard/page.tsx` — the same `balances` already computed for the hero).
- Renders as a new section **above** "Suggested payments":
  ```
  Household balances
    Alan           is owed  ₱1,002.41
    Mari Cel       owes     ₱55,984.66
    Mari Len       is owed  ₱54,982.25
  ```
- Each row:
  - Left: display name, with the signed-in user getting an emerald left border and a subtle "(you)" suffix.
  - Right: `is owed ₱X.XX` (emerald) / `owes ₱X.XX` (red) / `settled` (slate) based on sign.
- When **every** user's net is within ±₱0.005, render a single line instead: **"Everyone is settled"**.
- Collapsible like the other sections — defaults to expanded because this is the whole point of the card now.

## 11. Unsettled-expense breakdown in balance-math audit

Edit `src/lib/balance-math.ts` and `BalanceMathSection.tsx`.

- Add to `UserMathRow`:
  - `unsettled_paid` — sum of `expense.total_amount` for expenses where **every** split is `unpaid` and the user is the payer.
  - `unsettled_share` — sum of `expense_splits.calculated_amount` for splits that are `unpaid` and belong to an expense whose every split is `unpaid` and the user is the split owner.
  - `unsettled_net = unsettled_paid - unsettled_share`.
- Also compute and expose `mixed_status_expenses_count` — number of expenses where some splits are `unpaid` and others are `in_settlement` or `settled`. These are excluded from the breakdown above (otherwise the per-person numbers wouldn't sum to zero).
- Render as a new section under the main decomposition table in `BalanceMathSection.tsx`:
  ```
  Unsettled expense effect per person (expenses with all splits still unpaid)
    Alan       paid ₱A_p   share ₱A_s   net −₱5,213.62
    Mari Cel   paid ₱C_p   share ₱C_s   net +₱16,992.69
    Mari Len   paid ₱L_p   share ₱L_s   net −₱11,779.07
  Sum of nets: ₱0.00 (must be zero or there's a data issue)
  Mixed-status expenses excluded: 2
  ```
- The "Mixed-status" line is always rendered; when `0` it says `None`, so the user doesn't wonder whether the count was forgotten.

---

## Tests (vitest, bootstrapped in this PR)

Add `vitest` + `@vitest/ui` as devDependencies, config at `vitest.config.ts`, npm script `test`. Tests live under `src/lib/__tests__/`.

### Test A — row-by-row sequence (user-requested) via real `computeBalances`

`src/lib/__tests__/balances-sequence.test.ts`

- Build synthetic household: profiles A, C, L.
- Seed one expense with splits such that the resulting nets are exactly `A +1,002.41, C −55,984.66, L +54,982.25` — e.g. an expense paid by L for ₱111,969.32 split as `L 0, A 54,982.25+1,002.41, C 54,982.25+55,984.66` — the simplest arithmetic that lands there. (Helper `seedExpense(payer, amount, splitMap)` mints `Expense + ExpenseSplit[]` objects.)
- Seed four payments through real `SettlementPayment` + `SettlementBatchResult` fixtures:
  1. A → L ₱15,000.00
  2. L → A ₱8,238.68
  3. C → L ₱48,220.93
  4. C → A ₱7,763.73
- Call the real exported `computeBalances(profiles, expenses, splits, payments, results)`.
- Assert each user's `net` has `|net| < 0.005`.
- Assert intermediate step values (feed `payments` subsets `[1]`, `[1,2]`, `[1,2,3]`, `[1,2,3,4]`) match the chat's step table so a future regression names which step broke.
- Assert reordering `[2,1,3,4]` and `[1,2,4,3]` also lands at `|net| < 0.005` — path-independence.

### Test B — pair isolation for `recordPaymentForPair`

`src/lib/__tests__/record-payment-for-pair.test.ts`

Can't hit real Postgres from the TS test suite. A TS port of the RPC's allocation loop lives in `src/lib/payment-allocation.ts` **strictly for testing** — the RPC is the only code the running app calls, and the UI preview goes through the RPC with `preview_only: true`. The port carries a header comment:

```ts
/**
 * TEST-ONLY port of record_payment_for_pair's allocation loop. The SQL
 * function in migration 0007 is the source of truth; the running app
 * never calls this file at runtime. If the RPC body changes, update this
 * port and re-run Test B.
 */
```

- Build a set of `SettlementBatchResult`-shaped rows spanning multiple pairs:
  - `A→B` ST-0001 remaining ₱100 (open)
  - `A→B` ST-0002 remaining ₱50  (partially_paid)
  - `A→C` ST-0001 remaining ₱75  (open)
  - `B→A` ST-0003 remaining ₱20  (open)
  - `A→B` ST-0004 remaining ₱0   (paid — must not be considered)
- Call `allocate({from: A, to: B, amount: 120, rows})`.
- Assert allocation touches **only** `A→B` rows (ST-0001 ₱100 then ST-0002 ₱20), never `A→C`, `B→A`, or the paid row.
- Assert `pair_open` in the return equals ₱150 (A→B only).
- Over-cap: call with `amount: 200` → throws `"₱200.00 is more than the ₱150.00 open between this pair. Create a settlement first."`.
- Empty pair: call with `A→D` where no rows exist → throws the same error with `pair_open = 0`.

If the port drifts from the RPC body, the RPC is the source of truth — Test B will catch most logic bugs but the ultimate contract lives in SQL.

## Non-goals

- No change to `recordPayment` (per-result). It stays the primitive the single-row Record Payment form uses.
- No change to the greedy `settlementSuggestions` logic.
- No change to the hero or integrity banner.
- No `undoReconcile` action — a bad reconcile needs manual DB fix (rare, low blast radius, user-approved).

## Build + verification

- `npm run typecheck`
- `npm run build`
- `npm test` — runs both tests above.
- Apply `0007_close_batch.sql` in Supabase SQL Editor (after the backup of `settlement_batches` + `settlement_batch_results`).
- Push, open PR against `main`.

---

## Answers captured

- Spec location: `docs/pr-26-spec.md`.
- Close-batch button copy: **"Close batch"** (trigger) / **"Close selected rows"** (modal CTA, normal style, not red).
- Bidirectional threshold: **₱1 in either direction**.
- Vitest: **add in this PR**.

No outstanding questions. Waiting on your OK to build.
