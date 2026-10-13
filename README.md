# Cloutfit Rental

Online clothing rental catalogue, reservation, fitting appointment and rental
management system.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 ·
shadcn/ui (Base UI) · Supabase (Postgres, Auth, Storage, RLS) · Resend · Vercel

---

## 1. Setup

### 1.1 Create the Supabase project

1. Create a project named **Cloutfit Rental** at <https://supabase.com>.
2. Open **SQL Editor**, paste the contents of
   [`supabase/migrations/20261011000000_init.sql`](supabase/migrations/20261011000000_init.sql)
   and run it once. This creates every table, the availability and booking
   functions, Row Level Security, the two storage buckets, default settings and
   starter categories.
   Then run
   [`supabase/migrations/20261012000000_payment_methods.sql`](supabase/migrations/20261012000000_payment_methods.sql)
   (QR payment methods, the `payment-qr-codes` bucket, and atomic payment verification).
   Then run
   [`supabase/migrations/20261013000000_payment_tracking.sql`](supabase/migrations/20261013000000_payment_tracking.sql)
   (balances, partial and cash payments with change, refunds).
3. *(Optional)* run [`supabase/seed.sql`](supabase/seed.sql) for eight sample outfits.
4. **Authentication → Sign In / Providers → Email:** turn **off** "Allow new users
   to sign up". Staff accounts are created from the admin dashboard, so public
   sign-up is not needed. (Even if left on, a self-registered account gets an
   inactive profile and cannot reach `/admin`.)

### 1.2 Environment variables

```bash
cp .env.example .env.local
```

| Variable | Where to find it | Secret? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | no |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | **yes** |
| `RESEND_API_KEY` | <https://resend.com/api-keys> | **yes** |
| `RESEND_FROM_EMAIL` | e.g. `Cloutfit Rental <bookings@your-domain.com>` | no |
| `ADMIN_NOTIFICATION_EMAIL` | the Gmail inbox that receives notifications | no |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally, your domain in production | no |
| `CRON_SECRET` | any long random string | **yes** |

The service-role key and Resend key are only read in server-only modules
(`lib/supabase/admin.ts`, `lib/email/send.ts`), which import `server-only` so
they can never be bundled for the browser.

### 1.3 Run it

```bash
npm install
npm run create-admin -- you@example.com "a-strong-password" "Your Name"
npm run dev
```

- Public site: <http://localhost:3000>
- Admin: <http://localhost:3000/admin/login>

Then in the admin: **Settings** (business details, GCash number, fitting hours)
→ **Outfits** (add outfits, sizes/colors, photos).

### 1.4 Email (Resend or Gmail)

Two providers are supported; pick one:

- **Gmail SMTP** (no domain needed): set `GMAIL_USER` and `GMAIL_APP_PASSWORD` (a Google
  [App Password](https://myaccount.google.com/apppasswords), which requires 2-Step Verification).
  Emails are sent from that Gmail address to any recipient, about 500 a day. When both are
  set, Gmail is used instead of Resend.
- **Resend**: set `RESEND_API_KEY`. Details below.


- Without a verified domain, Resend's test sender only delivers to the email
  address of your own Resend account. To email customers, verify a domain in
  Resend and set `RESEND_FROM_EMAIL` to an address on it.
- Every attempt — sent, failed or skipped — is stored in `email_logs` and shown
  on the booking's page under **Email log**.
- A failed email never rolls back a booking: emails are sent after the
  response, and errors are caught and logged.

---

## 2. Deploying to Vercel

1. Push the repository and import it in Vercel.
2. Add every variable from `.env.example` under **Settings → Environment
   Variables**. Set `NEXT_PUBLIC_SITE_URL` to the production URL.
3. Deploy. `vercel.json` registers a daily cron (09:00 Manila time) that sends
   rental reminders for bookings starting the next day; Vercel authenticates it
   with `CRON_SECRET`.
4. In Supabase → **Authentication → URL Configuration**, set the Site URL to
   your domain.

`next.config.ts` allows `next/image` to load from this project's
`outfit-images` bucket only, derived from `NEXT_PUBLIC_SUPABASE_URL`.

---

## 3. How it works

### Date-based availability

There is no `available = true/false` flag. An outfit variant is free for a date
range when fewer bookings overlap it than its `quantity`:

- Bookings **hold** their dates while `pending`, `awaiting_payment`,
  `payment_submitted`, `reserved`, `for_fitting`, `confirmed` or `rented`.
  `returned`, `completed` and `cancelled` release them.
- An overdue rental (still `rented` past its return date) keeps holding the
  outfit until it is marked returned.
- Ranges are inclusive: a rental ending on the 23rd conflicts with one starting
  on the 23rd.

The check that counts happens **in the database**. `create_booking()` and the
`bookings_guard` / `booking_items_guard` triggers take a per-variant advisory
lock, then count overlaps — so two simultaneous requests for the same dates
cannot both succeed, whichever code path writes the booking (public form, admin
reschedule, or re-activating a cancelled booking). The calendar in the browser
is only a guide.

Fitting slots work the same way: `get_fitting_slots()` derives them from the
admin settings, blocked dates and existing appointments, and the
`fittings_guard` trigger enforces capacity under a per-day lock.

### Booking flow

`/booking` → outfit → dates → details → fitting → reservation fee →
`/booking/CLT-2026-0001?token=…`

`pending / awaiting_payment` → `payment_submitted` → `reserved` → `for_fitting`
→ `confirmed` → `rented` → `returned` → `completed` (or `cancelled`).

Every status change is written to `booking_status_history` by a trigger, with
who made it and an optional note.

### Reservation fee and QR payments

**Scan QR → Pay → Submit Proof → Admin Verification → Reservation Confirmed**

- The fee amount comes from **Settings → Payment & Reservation** (never hard-coded).
- Admins manage **payment methods** there: any provider (QR Ph, GCash, Maya, a
  bank, or a custom name), account details, a QR image, instructions, active /
  default flags. Customers pick an active method and scan its QR.
- Submitting proof only ever sets the payment to **Submitted**. Nothing marks a
  payment paid except an admin pressing **Verify**, which runs the database
  function `verify_payment()`: payment → Verified (who, when, notes), fee →
  Verified, booking → Reserved, plus a timeline entry, in one transaction.
- The browser sends only the payment method's id; the server looks the method
  up and records its name. Amount and reference number are stored as the
  customer's claim for the admin to check against the proof.
- A method that already has payments is archived instead of deleted.

### Balances, partial payments and cash

- Every payment is its own row in `payments`; nothing like a mutable "amount paid" is stored on
  the booking. The view `booking_payment_summary` calculates total due, total paid, balance,
  overpayment and a payment status per booking, counting **verified payments only**.
- **Total due** = rental total, plus the reservation fee when *Deduct reservation fee from rental
  total* is OFF in Settings. The rule is copied onto each booking when it is created.
- **Collect Payment** (booking page or Payments page) records cash with live change calculation,
  or an online payment with a reference number. `collect_payment()` re-validates on the server:
  no zero/negative amounts, cash received must cover the amount, cash cannot exceed the balance
  (the excess is change), and a per-click id prevents duplicate submissions.
- Statuses: Unpaid, Pending Verification, Partially Paid, Paid, Overpaid, Rejected, Refunded.
- Security deposits and "other" payments are recorded but do not reduce the rental balance.
- The server returns a receipt object after each payment (`PaymentReceipt`), shown in the dialog
  and ready to feed a printable receipt later.

### Security model

| Concern | How it is handled |
| --- | --- |
| Admin access | `proxy.ts` refreshes the session; every admin page calls `requireStaff()` and every Server Action calls `assertStaff()`, which verify the user with Supabase Auth and require an **active** profile. |
| Roles | `admin` and `staff`. Permissions live in one map in `lib/permissions.ts`; Users and Settings are admin-only. |
| Row Level Security | On for every table. Anonymous visitors can read the catalogue and public settings only. Staff policies are gated by `is_staff()` / `is_admin()`. There are no delete policies on bookings, customers or payments. |
| Internal notes | `outfits.internal_notes` is not granted to the `anon` role at column level. |
| Customer bookings | A reference alone never shows a booking. The page needs the unguessable `access_token` from the confirmation link, or Track Booking verifies reference **and** email/mobile. |
| Payment QR codes | Public-read bucket (customers must scan them); only admins can upload, replace or remove, and only admins can edit payment methods. |
| Payment proofs | Private bucket with no public policies. Uploaded through a Server Action that checks size, type and the file's actual bytes; staff view them through signed URLs that expire in two minutes. |
| Uploads | Type and size are checked in the browser, on the server, and by the bucket itself. File names are generated server-side. |
| History | Outfits are archived, never deleted. Foreign keys from bookings use `ON DELETE RESTRICT`. |

---

## 4. Project structure

```text
app/
  (site)/            public site: landing, catalogue, outfits/[slug], booking,
                     booking/[reference], fitting, track-booking, contact, rental-policies
  admin/login        staff sign-in
  admin/(panel)/     dashboard, outfits, categories, variants, availability, bookings,
                     fittings, rentals, returns, calendar, payments, customers, users, settings
  api/cron/          rental-reminder job
components/
  ui/                shadcn/ui primitives
  shared/            badges, calendar, form field, pagination, empty state
  site/              public components (booking wizard, filters, forms)
  admin/             dashboard components (sidebar, tables, dialogs, forms)
lib/
  supabase/          client.ts (browser) · server.ts (cookies/RLS) · public.ts (anon, cacheable)
                     · admin.ts (service role, server-only)
  actions/           Server Actions: public.ts, auth.ts, catalogue.ts, bookings.ts, system.ts
  data/              read helpers
  email/             Resend sender, HTML template, notifications
  availability.ts    display-side availability maths
  validation.ts      zod schemas shared by forms and actions
supabase/
  migrations/        schema, functions, RLS, storage, default settings
  seed.sql           optional sample outfits
proxy.ts             session refresh + optimistic /admin redirect
```

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | development server |
| `npm run build` / `npm start` | production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | generate route types, then `tsc --noEmit` |
| `npm run create-admin -- <email> <password> ["Name"]` | create or promote an admin |

### Notes for developers

This project uses Next.js 16 with **Cache Components** (see `AGENTS.md`).
Catalogue and settings reads are cached with `"use cache"` and invalidated by
tag (`catalogue`, `settings`) when staff save changes. Availability, fitting
slots and everything under `/admin` are always read live, behind `<Suspense>`.

---

## 5. Known limits

- **Rental price is a flat price per rental** (up to *Maximum rental length* in
  Settings), not per day.
- **One outfit per booking** from the public form. The schema (`booking_items`)
  already supports several.
- **No online payment gateway.** Reservation fees are verified manually from
  the submitted proof, as specified.
- **No rate limiting** on the public forms. If abuse becomes a problem, add a
  CAPTCHA or an edge rate limiter (Vercel WAF / Upstash) in front of the booking
  and Track Booking actions.
- **Unpaid reservations hold their dates** until staff cancel them; there is no
  automatic expiry.
