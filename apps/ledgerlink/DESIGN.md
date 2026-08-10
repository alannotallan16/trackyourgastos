# LedgerLink — Design Document

A personal **debt, lending, repayment & invoice tracker**. Not an expense tracker.
LedgerLink tracks money owed **to** you and money owed **by** you as first-class
*obligations*, with installment schedules, partial payments, payment proof
review, invoicing, and — its differentiator — **linked obligations** so you can
see whether the money coming in covers the money going out.

> This app lives in `apps/ledgerlink/` and is fully independent of the GastosHQ
> expense tracker at the repository root. It has its own `package.json`,
> Supabase schema, and deployment.

---

## 1. Requirements analysis

The brief describes a two-sided obligation ledger. The essential nouns are
**Obligation** (a debt account with a direction), **Installment** (a scheduled
due amount), **Payment** (money that moved, possibly needing approval),
**Invoice** (a request for payment, possibly shared with a non-user), **Contact**
(the counterparty), and **Link** (a funding relationship between two
obligations). Everything else (dashboard, reports, calendar, notifications) is a
*view* over those nouns.

Two design commitments fall straight out of the brief:

1. **Direction is intrinsic, not cosmetic.** `owed_to_me` and `i_owe` must never
   be aggregated together. The schema encodes direction on every obligation and
   every derived total keeps the two sides separate.
2. **The backend owns the numbers.** Balances, remaining amounts, and overdue
   status are computed by the database from the payment ledger — never trusted
   from the client. We implement this as SQL views/functions so there is exactly
   one source of truth.

### Ambiguities / decisions

| # | Ambiguity | Decision |
|---|-----------|----------|
| 1 | Can a bank's amortization be reconstructed from the advertised rate? | **No.** The brief says so explicitly (factor rates, undisclosed rounding). We support **manual/paste import** of a real schedule as the primary path, and offer generated schedules (flat, simple, amortized) only as a convenience. |
| 2 | How is money stored to avoid float error? | **Integer minor units (centavos)** in application code; `NUMERIC(20,4)` in Postgres. No `float`/`double` anywhere in the money path. |
| 3 | Does a debtor need an account to pay? | **No.** External debtors use an unguessable invoice link (`/i/<token>`) to view, submit a payment, and upload proof. Registered debtors are a Phase-2 nicety. |
| 4 | How is one payment split across installments? | A `payments` row plus one or more `payment_allocations` rows. Obligation-level "paid" = sum of approved payments; installment-level "paid" = sum of approved allocations. |
| 5 | When does a payment reduce a balance? | **Only when `status = 'approved'`.** Owner-recorded payments are auto-approved; externally-submitted proofs start `pending` and reduce nothing until the creditor approves. |
| 6 | How does early/extra payment affect interest? | **We do not guess.** We track principal/interest/fees remaining as scheduled and let the user record extra principal explicitly. Interest recomputation on payoff is out of MVP scope (documented limitation). |
| 7 | Multi-currency now? | Model is currency-agnostic (`currency_code` per obligation/payment). UI defaults to PHP. No live FX. Cross-currency linking is blocked in MVP. |

---

## 2. Architecture

**Stack: Next.js 14 (App Router) + TypeScript + Tailwind + Supabase (Postgres, Auth, Storage, RLS) + Vitest.**

Why this stack:

- **Matches the team's existing infra** (GastosHQ is the same stack on Vercel +
  Supabase free tier), so deployment and operational knowledge carry over.
- **Postgres + Row Level Security is the single most important security control
  here.** RLS enforces per-user data isolation *at the database*, so even a bug
  in an API route cannot leak another user's rows. This is exactly the
  IDOR/authorization protection the brief demands, and you get it declaratively.
- **Next.js Server Actions + Route Handlers** give a typed, colocated API without
  standing up a separate service. A future native app can consume the same route
  handlers as a REST surface.
- **Supabase Storage** gives private buckets + signed URLs for payment proofs and
  documents — no public exposure.
- **One deployable.** No microservices for the MVP, as requested.

```
Browser (mobile-first React, Tailwind)
   │  server actions (owner, RLS via anon key + user session)
   │  route handlers /api/*  (public invoice flow, service-role, token-gated)
   ▼
Next.js on Vercel ── @supabase/ssr ──► Supabase
                                        ├─ Postgres  (schema + RLS + views + triggers)
                                        ├─ Auth       (email/pw, magic link, reset, verify)
                                        └─ Storage    (private buckets, signed URLs)
Background: Supabase pg_cron (or Vercel Cron) → notifications/overdue sweep (Phase 2)
Email: Resend (Phase 2) — interface stubbed in MVP
```

**Two client trust levels:**

- **Owner path** — server actions use the SSR client bound to the logged-in
  user's session (anon key). RLS does the authorization; the code never filters
  by `owner_id` for security, only for query shape.
- **Public path** — `/api/invoice/[token]/*` route handlers use the
  **service-role** client (server-only, never shipped to the browser), and are
  authorized solely by possession of a cryptographically random token. They can
  only read/write the single invoice the token names, via `SECURITY DEFINER`
  RPCs and narrow server logic. Rate-limited.

---

## 3. Database schema

All money is `NUMERIC(20,4)`. All ids are `uuid` (`gen_random_uuid()`). Every
user-owned table has `owner_id uuid` → `profiles.id` and an RLS policy
`owner_id = auth.uid()`.

```
profiles(id=auth.uid, display_name, timezone, default_currency, notif_prefs jsonb, ...)

contacts(id, owner_id, name, email, phone, notes, ...)

categories(id, owner_id, name, color)

obligations(
  id, owner_id, direction ENUM(owed_to_me|i_owe),
  name, contact_id?, counterparty_name,          -- e.g. "UnionBank"
  currency_code, principal_original NUMERIC,
  interest_rate NUMERIC?, interest_type ENUM(none|flat_factor|simple|amortized),
  processing_fee NUMERIC, other_fees NUMERIC,
  start_date, due_date?, frequency ENUM(one_time|weekly|biweekly|monthly|quarterly|semiannual|annual|custom),
  num_installments INT?, category_id?, grace_period_days INT,
  status ENUM(active|completed|defaulted|cancelled), notes, ...)

installments(
  id, owner_id, obligation_id, seq,
  due_date, principal_amount, interest_amount, fees_amount, total_amount,
  override_status ENUM(none|waived|cancelled),      -- effective status is derived
  UNIQUE(obligation_id, seq),
  CHECK(total_amount = principal_amount + interest_amount + fees_amount))

payments(
  id, owner_id, obligation_id, contact_id?,
  amount, currency_code, paid_at, method ENUM(cash|bank_transfer|gcash|maya|credit_card|debit_card|check|other),
  reference, notes, direction, status ENUM(pending|approved|rejected),
  submitted_by ENUM(owner|external), rejection_reason?, reviewed_at?, ...)

payment_allocations(id, owner_id, payment_id, installment_id, amount)

invoices(
  id, owner_id, obligation_id?, contact_id?, number,
  title, amount, currency_code, due_date,
  status ENUM(draft|sent|viewed|partially_paid|paid|overdue|cancelled|disputed),
  public_token UNIQUE, sent_at?, viewed_at?, notes, ...)

invoice_items(id, owner_id, invoice_id, description, amount)

attachments(                                         -- covers "payment_proofs" + all docs
  id, owner_id, entity_type ENUM(obligation|installment|payment|invoice|contact),
  entity_id, storage_path, file_name, mime_type, size_bytes,
  uploaded_by ENUM(owner|external), ...)

linked_obligations(
  id, owner_id,
  source_obligation_id,   -- incoming (owed_to_me) that funds...
  target_obligation_id,   -- ...outgoing (i_owe)
  note, UNIQUE(source_obligation_id, target_obligation_id))

notifications(id, owner_id, type, title, body, entity_type?, entity_id?, read_at?, ...)

audit_logs(id, owner_id, actor uuid?, actor_label, action, entity_type, entity_id, before jsonb?, after jsonb?, created_at)
```

**Authoritative derived views (the backend's numbers):**

- `installment_ledger` — per installment: `total_due`, `paid` (Σ approved
  allocations), `remaining`, and derived `status`
  (`waived|cancelled|paid|partial|overdue|due|upcoming`) using `current_date` and
  `grace_period_days`.
- `obligation_ledger` — per obligation: scheduled total, `paid_total` (Σ approved
  payments), `remaining`, `progress_pct`, `overdue_amount`, `next_due_date`,
  `next_due_amount`.
- `link_coverage` — per link: this-period incoming vs outgoing, `coverage_pct`,
  `shortfall`, and status `covered|partially_covered|underfunded`.

**Integrity & audit:** a trigger keeps `installments.total_amount` reconciled;
row triggers on `obligations`, `payments`, `invoices`, `installments` write
`audit_logs` with `before`/`after` jsonb. Approved payments are effectively
append-only — edits are logged, never silent.

---

## 4. Financial model

- **Money type:** application arithmetic is done in integer **centavos** via
  `lib/money.ts` (`Money` = branded integer). Parse/format only at the edges.
  Rounding rule: **round half up** to the currency's minor unit; when splitting a
  total across installments the **last installment absorbs the rounding
  remainder** so the parts always reconcile to the whole.
- **A schedule is data, not a formula.** `installments` stores the real per-row
  principal/interest/fees. For the UnionBank case the user pastes the bank's
  schedule and we store it verbatim. Generators (`flat_factor`, `simple`,
  `amortized`) exist to *produce* rows but the stored rows are canonical.
- **Reconciliation:** `total = principal + interest + fees` is enforced per
  installment (DB check) and `Σ installment.total ≈ obligation scheduled total`
  is validated with tests.
- **Balances flow one way:** payment → (approved) → allocations → installment
  paid → obligation paid → remaining/overdue/progress. The client never sends a
  balance; it sends a payment and the views recompute.
- **Overdue:** `remaining > 0 AND due_date + grace < today AND not waived/cancelled`.
  Partial payment never marks an installment `paid`.

---

## 5. Linked obligations (the differentiator)

A link is a directed edge **source (`owed_to_me`) → target (`i_owe`)** meaning
"the money my sister pays me funds what I owe UnionBank." The two obligations
keep **completely separate** schedules, balances, and histories. The link only
adds a *combined coverage view*:

For a chosen period (default: this calendar month):

```
incoming_expected = Σ target-period installments on the source (owed_to_me)
outgoing_due      = Σ this-period installments on the target (i_owe)
incoming_received = Σ approved payments received on the source in period
coverage_pct      = incoming_expected / outgoing_due
shortfall         = max(0, outgoing_due − incoming_expected)
status            = covered (≥100%) | partially_covered (>0) | underfunded (0)
```

Example (from the brief): Sister pays ₱25,000 vs UnionBank ₱23,658.87 →
coverage **108%**, status **COVERED**. Or ₱20,000 → **84.5%**, shortfall
**₱3,658.87**, status **PARTIALLY COVERED**. Cross-currency links are rejected in
MVP.

---

## 6. Major user flows

1. **Onboard:** register → verify email → set timezone + default currency (PHP).
2. **Create obligation (wizard):** Q1 *"Who owes whom?"* → `owed_to_me` /
   `i_owe`; then counterparty (pick/create contact), principal, currency,
   dates, frequency; then schedule (paste/import real rows, or generate, or
   single due). Backend validates reconciliation, writes obligation +
   installments + audit rows.
3. **Record a payment (owner):** on an obligation/installment → amount, date,
   method, reference, optional proof → auto-approved → allocations → ledger
   updates.
4. **Invoice a debtor:** create invoice (optionally linked to an installment) →
   mint `public_token` → share `/i/<token>`.
5. **External debtor pays:** opens link (marks `viewed`) → submits amount +
   uploads proof → creates `pending` payment. Nothing changes on the balance yet.
6. **Creditor reviews:** approve (→ balance drops, installment updates) or reject
   (→ reason required, balance untouched). Both audited + notified.
7. **Link obligations:** pick an `owed_to_me` and an `i_owe` → see live coverage.
8. **Report/export/calendar:** filter by direction/person/date; export CSV/Excel/PDF; calendar shows incoming vs outgoing.

---

## 7. Authentication & security model

- **Auth:** Supabase Auth — email+password (hashed by Supabase/bcrypt-class),
  magic link, password reset, email verification. Sessions via secure
  http-only cookies through `@supabase/ssr`; middleware refreshes them.
- **Isolation:** RLS on every table (`owner_id = auth.uid()`). This is the
  primary IDOR defense and works even if application code forgets a filter.
- **Public invoice path:** no session; authorized only by a 32-byte random,
  non-sequential token. Served by service-role route handlers that touch only
  the token's invoice, via `SECURITY DEFINER` RPCs with fixed queries. Rate
  limited per token/IP.
- **Files:** private Storage buckets; access only through short-lived signed
  URLs minted server-side after an RLS/token check. No public document URLs.
- **Input:** Zod validation on every action/route; parameterized queries only
  (Supabase client → no string SQL) → SQL-injection safe; React escaping + no
  `dangerouslySetInnerHTML` → XSS safe; Server Actions carry CSRF-safe POST
  semantics; secrets only in env vars.
- **Audit:** DB triggers + explicit app logging record who/what/when/before/after
  for financial mutations.

---

## 8. MVP scope (this build)

Auth + isolated accounts · profile/settings (timezone, currency, notif prefs) ·
contacts · create-obligation wizard (both directions, manual schedule import +
generators) · obligation list + rich detail w/ schedule table · payments +
partial allocation + proof upload · invoices + public link + external submission ·
creditor approve/reject · overdue/partial/coverage computed in DB · linked
obligations w/ coverage view · dashboard (both-sided totals, cash-flow insight,
upcoming/overdue) · calendar · reports + CSV/Excel/PDF export · audit log ·
responsive mobile-first UI (bottom nav) + desktop sidebar · reusable component
library · demo seed (UnionBank + Sister link, completed loan, overdue loan,
partial installment, invoice, pending proof, outgoing bank) · Vitest tests for
money, schedule generation, allocation, overdue, and coverage.

## 9. Phase 2

Email/push notifications (Resend + web-push) · pg_cron overdue/reminder sweep ·
recurring auto-generation of future installments with pause/resume/skip ·
registered-debtor accounts + claiming past invoices · richer document management ·
saved report views · CSV schedule import UI (drag-drop mapping) · in-app
notification center realtime.

## 10. Phase 3

Native mobile app on the same route-handler API · early-payoff interest
recomputation engine (per-loan rules) · multi-currency with FX snapshots ·
shared/household ledgers & roles · statement PDFs & branded invoices · payment
gateway hooks (GCash/Maya/Stripe) for real collection · analytics
(collection performance, aging buckets) · 2FA.

## 11. Known limitations (MVP)

Email/push are interface-stubbed (no send in MVP) · no live FX; cross-currency
links blocked · early-payoff interest not recomputed automatically · recurring
schedules are generated up-front, not by a background job yet · rate limiting on
the public path is in-process (swap for a shared store in prod) · authorization
tests target the RLS policies and are documented to run against a real Supabase.
