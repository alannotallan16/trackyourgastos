# PR #26 — Close batch, auto-split payments, household balances strip

Branch: `claude/close-batch-and-balances-strip` (off `main` after #25 merges).

## Rationale

After #25 the dashboard tells the household _what_ to pay and _which_ batch row each suggestion is composed of, but there are three gaps the row-by-row payment plan ran into:

1. **Zombie batches.** ST-0011 and ST-0014 still carry open rows that don't match today's reality (`Alan→Len ₱15k` when Alan's net is +₱1,002). The user can pay the stale row to close the batch, but there's no first-class way to say "forgive this row, the debt is already accounted for elsewhere." Writing a ₱15k fake payment would corrupt the integrity audit.
2. **Pair totals that span batches.** Cel owes Len across ST-0011 Cel→Len (₱60k left) and will owe her across any new batch; today Record jumps to one specific `batch_result`. For multi-batch pairs the user wants to say "pay Len ₱30k, allocate it across whatever's open."
3. **No per-person progress view.** Hero shows the signed-in user's net; Settle Up shows suggestions. There's no "where does everyone stand _now_" line, which is how the household actually tracks the installment plan.

11 items cover these plus the review feedback. One unit test seals the row-by-row sequence math.

---

## 1. Migration 0007 — `reconciled` status

`supabase/migrations/0007_close_batch.sql`

- `settlement_batches.status` check constraint extended to `('open','partially_paid','paid','cancelled','reconciled')`.
- `settlement_batch_results.status` check constraint extended to `('open','partially_paid','paid','reconciled')`.
- No column additions; no RLS changes; no trigger changes.

`src/lib/types.ts` — add `'reconciled'` to `SettlementBatchStatus` and `SettlementBatchResultStatus`.

## 2. Server action — `reconcileBatchRows(batchId, resultIds[])`

New export in `src/app/(app)/settlements/actions.ts`.

- Fetch batch + all its results.
- Reject if batch status is `cancelled`.
- Reject if any `resultId` doesn't belong to `batchId`, or is already `reconciled`/`paid`.
- For each selected result:
  - `status = 'reconciled'`
  - `remaining_amount = 0`
  - `amount_paid` **unchanged** — the audit still reads the real cash leg.
- **No** `settlement_payments` rows are inserted (the integrity audit stays truthful).
- After updating the selected rows, re-read all results for the batch and roll up:
  - Every result in `('paid','reconciled')` → batch `status = 'reconciled'` and flip batch's `expense_splits` to `settled` (reusing the same path as `rollupBatchStatus`).
  - Otherwise batch status stays as it was (`open` or `partially_paid`); splits stay `in_settlement`.
- `revalidatePath` the same set `recordPayment` revalidates.

## 3. Close batch dialog on `/settlements/[id]`

New `src/components/settlements/CloseBatchDialog.tsx` (client component).

- Trigger: a `Close batch` button on the detail page, visible only when batch is `open` or `partially_paid` and at least one result has `remaining_amount > 0`.
- Modal body:
  - One row per open-or-partially-paid result: `[x] From → To — remaining ₱X.XX`.
  - All checkboxes **checked by default**.
  - A paid result is listed in a muted subsection ("Already paid — no action needed") with a disabled checkbox; keeps the user oriented.
  - No "Total being reconciled" line (user's correction — sums different people's debts).
  - Optional notes textarea that passes through to a batch-level `notes` append (`"Closed by <name> on <date>: <notes>"`), not per-row.
- CTA: `Reconcile selected rows` (primary, red) + `Cancel`.
- Submits to `reconcileBatchRows` via `useTransition`.
- On success, closes modal and `revalidatePath` handles the refresh.

## 4. Server action — `recordPaymentForPair(fromId, toId, amount, …)`

New export in `settlements/actions.ts`.

- Inputs: `from_user_id`, `to_user_id`, `amount`, `payment_date`, `payment_method?`, `notes?`, `reference_number?`, `attachment_path?`, and `preview_only: boolean`.
- Fetch all open/partially-paid `settlement_batch_results` for the pair, oldest-first via `created_at` of their batch.
- Walk the list filling each row up to its `remaining_amount` until `amount` is exhausted.
- **Leftover handling** — if `amount` still has money after all open rows are filled:
  - Query `expense_splits` where `settlement_status = 'unpaid'` and the pair `(payer, payee)` matches (payer paid the expense, payee is the split user, or vice-versa). Hand the matching expenses to `createSettlementBatch` to mint a new batch, then allocate the leftover against that new batch's `from→to` result.
  - If the new batch has no `from→to` result (nothing unsettled between them), **hard error**: `"No open obligation for <from> → <to> for ₱X; cancel or reduce the amount."`
- `preview_only: true` returns the planned allocation (`{batch_number, result_id, apply_amount}[]` + optional new batch preview) without writing anything.
- `preview_only: false` runs the plan: inserts `settlement_payments` rows + updates each result + rolls up each batch. The new batch (if any) is created first so its result_id is available for the leftover payment row.
- Zod schema mirrors `PaymentSchema` but with `from_user_id`/`to_user_id` instead of `settlement_batch_result_id`.

## 5. Record modal — two-step preview-before-save

New `src/components/settlements/RecordPaymentForPairModal.tsx` (client).

- Step 1 — form: pair (pre-filled when launched from a Settle Up suggestion), amount, date, method (datalist from #7), optional notes/ref/attachment.
- Step 2 — preview: table of the allocation plan returned by `recordPaymentForPair({preview_only: true})`:
  ```
  ST-0011 Cel→Len   apply ₱30,000.00    was ₱60,000 left → will leave ₱30,000 left
  ST-0019 Cel→Len   apply ₱5,000.00     NEW BATCH — will create from 4 unsettled expenses (₱5,000.00)
  ```
- Back button returns to Step 1 without losing input.
- Confirm button calls `recordPaymentForPair({preview_only: false})`.
- Deep-link entry: Settle Up's Record button opens Step 1 with the pair + remaining-amount pre-filled (default `amount = min(remaining-in-matched-batches, suggestion.amount)` — not a free field, same behavior as today's Record except multi-batch-aware).

## 6. Create Settlement — bidirectional pair warning

Edit `src/app/(app)/settlements/CreateBatchModal.tsx`.

- Before the batch preview section, compute for the selected expenses' implied `(from, to)` pairs: for each pair `(A, B)` where both `A→B` and `B→A` have at least one open-or-partially-paid result in **any existing batch**, show an amber banner:
  ```
  Heads up — the household already has open debt in both directions between
  Alan and Mari Len. Current open totals: Alan→Len ₱12,500 (ST-0014), Len→Alan
  ₱8,238.68 (ST-0014). Consider reconciling existing rows before creating a
  new batch that would double-book this pair.
  ```
- Banner is informational — does not block the create.

## 7. Payment method datalist

- New constant `PAYMENT_METHODS = ['Bank transfer', 'Cash', 'GCash', 'Forgiven', 'Other']` in a new `src/lib/payment-methods.ts`.
- Wire into:
  - The existing per-row Record Payment form (`/settlements/[id]`).
  - The new `RecordPaymentForPairModal`.
- Rendered as `<datalist>` under a free `<input>` so users can also type a custom method.
- `'Forgiven'` is a convention label; the recorded payment behaves identically to any other method (money leg still writes a real `settlement_payments` row; use `reconcileBatchRows` when you don't want a cash leg).

## 8. `BatchStatusBadge` — reconciled styling

Edit the component that renders the status chip (search `partially_paid` in the codebase to find all sites; likely `SettlementsClient` and `/settlements/[id]`).

- `reconciled`: amber/orange chip, text "reconciled", tooltip "Closed without a cash payment — remaining balance forgiven or accounted for elsewhere."

## 9. `SettlementsClient` — show reconciled in History

- Currently History filters on `status in ('paid','cancelled')`. Add `'reconciled'`.
- Sort stays `created_at desc`.

## 10. Household balances strip in `SettleUpCard`

Edit `src/components/SettleUpCard.tsx`.

- New `householdBalances: UserBalance[]` prop (passed from `dashboard/page.tsx` — same `balances` already computed for the hero).
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
- No new section when the household is entirely at zero.
- Collapsible like the other sections — defaults to expanded because this is the whole point of the card now.

## 11. Unsettled-expense breakdown in balance-math audit

Edit `src/lib/balance-math.ts` and `BalanceMathSection.tsx`.

- Add to `UserMathRow`:
  - `unsettled_paid` — sum of `expense.total_amount` for expenses where **all** splits are `unpaid` and the user is the payer.
  - `unsettled_share` — sum of `expense_splits.calculated_amount` for splits that are `unpaid` and belong to an expense whose every split is `unpaid` and the user is the split owner.
  - `unsettled_net = unsettled_paid - unsettled_share`.
- "All splits unpaid" (not just "this split unpaid") is the criterion — matches the Settle Up unsettled nudge's definition and means a mixed-status expense doesn't partially count.
- Render as a new three-column section under the main decomposition table in `BalanceMathSection.tsx`:
  ```
  Unsettled expense effect per person (not yet in any batch)
    Alan       paid ₱A_p  share ₱A_s  net −₱5,213.62
    Mari Cel   paid ₱C_p  share ₱C_s  net +₱16,992.69
    Mari Len   paid ₱L_p  share ₱L_s  net −₱11,779.07
  Sum of nets should be ₱0.00 (currently ±₱X.XX)
  ```
- Sum-of-nets check is the audit's own correctness assertion.

---

## Test — row-by-row payment sequence (user-requested)

`src/lib/__tests__/balances-sequence.test.ts` (new) or wherever existing tests live (search first; if none, this bootstraps a `vitest` config).

- Setup three profiles A, C, L and a synthetic initial balance vector:
  - A: net = +1,002.41
  - C: net = −55,984.66
  - L: net = +54,982.25
  - (Achieved by one phantom "seed" expense + splits.)
- Apply four payments in order via a helper that only touches the `paid`/`owed` vectors (doesn't go through the DB):
  1. A → L ₱15,000.00
  2. L → A ₱8,238.68
  3. C → L ₱48,220.93
  4. C → A ₱7,763.73
- Assert `Math.abs(net) < 0.005` for all three users after the final payment.
- Assert intermediate step-by-step nets match the table from the chat so a future regression says _which_ step broke.
- Also assert that reordering (1 and 2 swapped; 3 and 4 swapped) still lands at zero — the result is path-independent.

## Non-goals

- No change to `recordPayment` (per-result). It stays the primitive `recordPaymentForPair` is built on top of.
- No change to the greedy `settlementSuggestions` logic — household balances strip is independent of the suggestion engine.
- No change to the hero or integrity banner.
- Not building a `deleteReconciliation` undo yet; a wrong reconcile needs manual DB fix (rare, low-blast-radius, user-approved tradeoff).

## Build + verification

- `npm run typecheck`
- `npm run build`
- `npm test -- balances-sequence` (bootstrapping a test runner if the repo doesn't have one; will flag if that's a separate PR)
- Push, open PR against `main`.

---

## Open questions / confirmations wanted before building

1. **Spec file location** — `docs/pr-26-spec.md` okay, or do you want it co-located in the PR body only?
2. **Close batch button copy** — "Close batch" or "Reconcile remaining"? (Spec currently uses "Close batch" as the button and "Reconcile selected rows" as the modal CTA.)
3. **Bidirectional warning threshold** — fire when _any_ open amount exists in both directions, or only above some floor (e.g. ₱100)?
4. **Test runner** — the repo currently has no test framework installed. Do you want me to add `vitest` as part of this PR, or defer the test to a follow-up PR and ship the row-by-row payment code without it? (The math itself is deterministic enough that I can run it as a `.ts` script in CI instead of a formal test if you prefer the smaller diff.)
