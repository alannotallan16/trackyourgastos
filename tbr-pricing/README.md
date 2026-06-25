# TBR Pricing

A web-based pricing app for **The Back Room (TBR)**, an offshore staffing company in the Philippines. It replaces two Excel tools and runs both off one shared pricing engine:

1. **Salary Calculator** — per-employee monthly client fee (a "Quote").
2. **Salary Recommendation** — HR proposes a fee change when an employee's salary moves.

Plus a **Settings** page to edit all rates/roles in the UI (no code), persisted to `localStorage`, with JSON Export/Import and "Reset to defaults".

## Stack

React + Vite + TypeScript, styled with Tailwind. Single-page app, no backend. All state persists to `localStorage`.

## Develop

```bash
cd tbr-pricing
npm install
npm run dev        # start dev server
npm test           # run engine unit tests (validation cases)
npm run build      # typecheck + production build
```

## Pricing engine

The engine lives in `src/engine/pricing.ts` and is config-driven (`src/config/`). Given a PHP monthly gross `G`, region, CPA flag, shift, and billable hours/week:

```
basic        = G - deMinimis
thirteenth   = round(basic / 12)
sss          = round( min( mround(G,500), 35000 ) * 0.10 ) + 30   // on GROSS
philhealth   = round( min( max(basic,10000), 100000 ) * 0.025 )   // on BASIC
pagibig      = 200
hmo          = 1775
billedPHP    = G + thirteenth + sss + philhealth + pagibig + hmo

salaryForeign = billedPHP * region.factor / region.exchRate
fcf           = salaryForeign * 0.03
cpd           = isCPA ? region.cpd : 0
core          = salaryForeign + fcf + region.bpo + region.benefits + region.it + cpd
coreRounded   = mround(core, 50)
shiftForeign  = G * shiftPct * region.factor / region.exchRate
fee           = coreRounded + shiftForeign + extrasTotal
hourly        = fee / (hoursPerWeek * 52 / 12)
```

- `mround(x, m) = Math.round(x / m) * m`.
- **Published scale fee** = `coreRounded` with no shift, no extras, non-CPA.
- A **Special Discount** is a positive amount subtracted from the fee.
- The **Non-CPA Discount** extra only applies when the employee is not a CPA.

### Validation

`src/engine/pricing.test.ts` asserts the source-spreadsheet figures (non-CPA, Day shift, no extras):

| Role | billed PHP | NZD fee | USD fee |
| --- | --- | --- | --- |
| Senior Accountant – L1 | 93,771 | 4,100 | 3,150 |
| Bookkeeper – L2 | 60,521 | 3,100 | 2,400 |
| Tax Manager | 278,530 | 9,700 | 7,250 |
| Senior Accounting Manager | 159,363 | 6,100 | 4,600 |

If these pass, the engine matches the spreadsheet.

## Config

`src/config/defaults.ts` holds the default statutory rates, regions, shift premiums, extras, and the 74 roles. The Settings page edits a live copy; "Reset to defaults" restores this file's values. Export/Import moves the whole config as JSON so non-developers can update rates and share them.
