# TrackYourGastos

A simple, private expense tracker for three users — **Alan**, **Mari Cel**, **Mari Len** — with receipt OCR, recurring expenses, settlements, and exports. Built on Next.js + Supabase, deployable free on Vercel.

## Stack
- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** (Postgres, Auth, Storage, RLS)
- **Tesseract.js** for client-side OCR (optional OCR.Space API fallback)
- **Recharts** for dashboard charts
- **jsPDF + xlsx** for PDF/Excel exports
- **Zod** validation, server actions for writes

## Pages
- `/login` — email + password or magic link
- `/dashboard` — month total, per-person balances, charts, recent expenses
- `/expenses` — full spreadsheet-style table with filters
- `/expenses/new` — manual entry
- `/expenses/scan` — camera/file capture → OCR → review
- `/expenses/review` — OCR review + edit + save
- `/expenses/[id]` — edit / delete
- `/recurring` — recurring templates (Netflix, Globe, Rent, Pelco…)
- `/settlements` — record payments, see "who owes who"
- `/categories` — categories + merchant rules
- `/presets` — split presets
- `/reports` — balances summary + CSV / Excel / PDF export
- `/settings`

## Setup

### 1) Supabase project
1. Create a project at https://supabase.com (free tier).
2. **SQL Editor** → run the migrations in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_seed.sql`
3. **Authentication → Users → Add user** — create three accounts (one per real email) for Alan, Mari Cel, Mari Len. You can use any sign-in method but the simplest is email + password (or magic link).
4. Open `supabase/migrations/0004_link_profiles.sql`, replace the three placeholder emails with the real ones, and run it. This creates the `profiles` rows and a few default split presets (Equal 3-way, Alan only, Cel only, Len only, Alan 50 / Cel 25 / Len 25).
5. (Optional) Run `supabase/seed_examples.sql` to insert a handful of sample expenses and recurring templates.
6. Settings → API: copy the **Project URL**, **anon public key**, and **service_role key**.

The receipt storage bucket (`receipts`) is created automatically by `0002_rls.sql` with RLS limited to household members.

### 2) Local dev
```bash
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# and optionally OCR_SPACE_API_KEY.

npm install
npm run dev
```
Then open http://localhost:3000.

### 3) Deploy to Vercel
1. Push this repo to GitHub.
2. https://vercel.com → New Project → import the repo.
3. Add the same env vars from `.env.example` in **Project Settings → Environment Variables**.
4. Deploy. Done.

### Required env vars
| Variable | Where it's used | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | only if you write server scripts; not used by the app routes | optional |
| `NEXT_PUBLIC_SUPABASE_RECEIPTS_BUCKET` | defaults to `receipts` | optional |
| `OCR_SPACE_API_KEY` | fallback OCR via `/api/ocr` | optional |

## Notes / limitations

### OCR
- Client-side OCR runs via `tesseract.js` directly in the browser — no server cost, but accuracy varies with image quality.
- Parsing is best-effort: we try the largest "Total"-labelled number for amount, common date formats, and the top non-numeric line for the merchant.
- If Tesseract.js fails (rare WebAssembly issues), the app falls back to `/api/ocr` which uses OCR.Space — set `OCR_SPACE_API_KEY` to enable it. Their free tier is 500 reqs/day.
- The user always reviews and edits before saving.

### Security
- Supabase RLS restricts everything to the 3 linked profiles via `is_household_member()`. The service-role key is never exposed to the client.
- Storage uses signed URLs for receipt previews.

### Currency
- All expenses store original `currency` + optional `exchange_rate` (to PHP). The app doesn't fetch FX rates live — enter them manually if you want PHP equivalents.

### Duplicate detection
- When you scan or save an expense, the app checks for existing expenses with the same merchant (substring), within ±1 day, and amount within ₱0.50.

## Phases / how this was built
This was built incrementally:
1. Schema + auth + manual expense entry
2. OCR receipt flow + duplicate detection
3. Recurring expenses (with "Add now" → creates expense + advances next due date)
4. Settlements + "who owes who" suggestions (minimum-transaction greedy)
5. Categories, split presets, merchant rules editors
6. Reports + CSV/Excel/PDF exports + dashboard charts

## Scripts
```bash
npm run dev         # next dev
npm run build       # next build
npm run start       # production server
npm run typecheck   # tsc --noEmit
npm run lint
```
