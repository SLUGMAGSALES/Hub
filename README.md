# SLUG Sales OS

A lightweight ad-sales CRM for the SLUG Magazine / Craft Lake City sales team.
Built with **Next.js (App Router, TypeScript)** + **Supabase**, deployable to
**Vercel**.

Three things it does:

1. **Log a lead touch** in ~45 seconds — company, contact method, stage, what
   happened, and a next follow-up date.
2. **Follow-up list** — who's **overdue** / **due today**, built automatically
   from the activity records you log.
3. **Team pipeline** — defaults to the **whole team's** leads grouped by stage,
   with a filter to view a single rep's leads.

Everything is gated behind Supabase Auth — no prospect data is visible without
signing in.

> **Schema note (important).** The app targets the team's **existing** live
> tables: `contacts`, `leads`, `activities`, `deals`, `daily_log` (Supabase
> project `tlblflodoteuvdhorfaw`). It does **not** own or create them. Mapping:
> a logged touch writes an `activities` row (and creates/updates the contact's
> `leads` row); the follow-up list reads `leads.next_action_date`; the pipeline
> groups `leads` by `status`. There is no `team_members` table yet, so
> `logged_by` / `assigned_to` are stored as the signed-in user's **email**.
> The `supabase/migrations/0001_init.sql` file (which defines `slug_*` tables)
> is **legacy and unused** — do not run it against the live database.

---

## Table of contents

- [Prerequisites](#prerequisites)
- [Quick start (local)](#quick-start-local)
- [Environment variables](#environment-variables)
- [Database setup & the migration](#database-setup--the-migration)
- [Assumed schema (reconcile against your real tables)](#assumed-schema-reconcile-against-your-real-tables)
- [Row Level Security](#row-level-security)
- [Authentication](#authentication)
- [Deploying to Vercel](#deploying-to-vercel)
- [Security checklist](#security-checklist)
- [Project structure](#project-structure)

---

## Prerequisites

- **Node.js 18.17+** (Node 20 or 22 LTS recommended) and npm.
- A **Supabase** project (free tier is fine).
- A **Vercel** account — ideally a **team-owned org**, not a personal account
  (see [Deploying to Vercel](#deploying-to-vercel)).

## Quick start (local)

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file from the template
cp .env.example .env.local
#    …then edit .env.local with your Supabase project values.

# 3. Run the dev server
npm run dev
# open http://localhost:3000
```

`npm run dev` starts with placeholder env values too — the app boots and the
login page renders; you just can't sign in or read data until real Supabase
credentials are in `.env.local`.

Useful scripts:

| Script            | What it does                          |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Local dev server                      |
| `npm run build`   | Production build (also type-checks)   |
| `npm run start`   | Serve the production build            |
| `npm run typecheck` | `tsc --noEmit` type check           |
| `npm run lint`    | ESLint via `next lint`                |

## Environment variables

All Supabase configuration is via environment variables — **nothing is
hardcoded or committed**. See [`.env.example`](./.env.example).

| Variable                        | Where it's used            | Public? |
| ------------------------------- | -------------------------- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Browser + server           | Yes (safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server           | Yes (safe, protected by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Server-only** code       | **NO — never expose** |

- The two `NEXT_PUBLIC_*` values are the only ones sent to the browser. The
  anon key is designed to be public and is protected by Row Level Security.
- `SUPABASE_SERVICE_ROLE_KEY` **bypasses RLS**. It is imported only in
  [`src/lib/supabase/admin.ts`](./src/lib/supabase/admin.ts), which starts with
  `import "server-only"` — the build **fails** if that module is ever pulled
  into a client component. Its single use here is provisioning a rep's profile
  row on first login (see [`src/lib/member.ts`](./src/lib/member.ts)).
- Find all three values in Supabase: **Project Settings → API**.
- `.gitignore` excludes `.env` and `.env.*` (except `.env.example`). Never
  commit real keys.

## Database setup & the migration

The SQL lives in
[`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql). It:

- creates the four `slug_*` tables **only if they don't already exist**
  (`CREATE TABLE IF NOT EXISTS` — it will **not** drop or alter existing tables),
- adds indexes and an `updated_at` trigger,
- enables **Row Level Security** and creates example policies.

Run it whichever way suits you:

**Option A — Supabase SQL Editor (simplest):** open your project → **SQL
Editor** → paste the contents of `0001_init.sql` → **Run**.

**Option B — Supabase CLI:**

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

> ⚠️ Because your team already has `slug_team_members`, `slug_leads`,
> `slug_activities`, and `slug_follow_ups`, the `IF NOT EXISTS` guards mean
> existing tables are left untouched. **Diff the [assumed schema](#assumed-schema-reconcile-against-your-real-tables)
> below against your real columns** and adjust either your tables or the app's
> queries where they differ.

## Assumed schema (reconcile against your real tables)

These tables/columns were **inferred** from the feature requirements because
the live schema wasn't available. Treat this as the contract the app code
expects — where your real tables differ, that's the list of things to fix.

### `slug_team_members` — the reps / app users

| Column         | Type          | Notes |
| -------------- | ------------- | ----- |
| `id`           | uuid (PK)     | |
| `auth_user_id` | uuid, unique  | FK → `auth.users(id)`; links a login to a rep |
| `full_name`    | text          | |
| `email`        | text, unique  | |
| `role`         | text          | `rep` \| `manager` \| `admin` (default `rep`) |
| `is_active`    | boolean       | default `true` |
| `created_at`   | timestamptz   | |

### `slug_leads` — companies / prospects

| Column            | Type           | Notes |
| ----------------- | -------------- | ----- |
| `id`              | uuid (PK)      | |
| `company_name`    | text           | required |
| `contact_name`    | text           | |
| `contact_email`   | text           | |
| `contact_phone`   | text           | |
| `website`         | text           | |
| `stage`           | text           | `new` \| `contacted` \| `qualified` \| `proposal` \| `won` \| `lost` |
| `owner_id`        | uuid           | FK → `slug_team_members(id)`; the owning rep |
| `estimated_value` | numeric(12,2)  | optional deal size (shown in pipeline totals) |
| `notes`           | text           | |
| `created_at`      | timestamptz    | |
| `updated_at`      | timestamptz    | auto-updated by trigger |

### `slug_activities` — a logged lead touch

| Column                | Type         | Notes |
| --------------------- | ------------ | ----- |
| `id`                  | uuid (PK)    | |
| `lead_id`             | uuid         | FK → `slug_leads(id)` |
| `member_id`           | uuid         | FK → `slug_team_members(id)`; who did it |
| `contact_method`      | text         | `email` \| `phone` \| `in_person` \| `social` \| `event` \| `text` \| `other` |
| `stage`               | text         | stage at the time of the touch |
| `notes`               | text         | "what happened" |
| `next_follow_up_date` | date         | drives the follow-up list |
| `occurred_at`         | timestamptz  | |
| `created_at`          | timestamptz  | |

### `slug_follow_ups` — derived follow-up queue

| Column         | Type         | Notes |
| -------------- | ------------ | ----- |
| `id`           | uuid (PK)    | |
| `lead_id`      | uuid         | FK → `slug_leads(id)` |
| `activity_id`  | uuid         | FK → `slug_activities(id)` that created it |
| `member_id`    | uuid         | FK → `slug_team_members(id)`; responsible rep |
| `due_date`     | date         | required |
| `status`       | text         | `pending` \| `done` \| `cancelled` (default `pending`) |
| `completed_at` | timestamptz  | set when marked done |
| `created_at`   | timestamptz  | |

**If your column names differ**, update these two places:

- [`src/lib/types.ts`](./src/lib/types.ts) — the row types, and
- the queries in `src/app/(app)/**` and `src/app/(app)/actions.ts`.

## Row Level Security

RLS policies are defined in the migration. The model:

- **Reads:** any authenticated team member can read **all** team data (shared
  pipeline and follow-up queue).
- **Writes:** scoped to the authenticated rep — you can only insert/update/delete
  **leads you own**, **activities you authored**, and **your own follow-ups**,
  and you can only edit **your own** `slug_team_members` profile row.

> 🔒 **You must verify RLS is ENABLED on every table.** Enabling it in SQL is
> not a substitute for confirming it in the dashboard: **Table Editor → each
> table → confirm "RLS enabled"**, or **Authentication → Policies**. If a table
> pre-existed and RLS is off, the anon key would expose all prospect data
> publicly. The migration includes the same warning inline.

## Authentication

- Email + password auth via Supabase Auth. The login page is at `/login`.
- Middleware ([`src/middleware.ts`](./src/middleware.ts)) refreshes the session
  and **redirects any unauthenticated request** for a data route to `/login`.
  The `(app)` route group additionally re-checks on the server before rendering.
- On first successful login, a `slug_team_members` profile row is provisioned
  automatically (server-side).
- **Creating users:** for a small team, the cleanest path is to add users in
  **Supabase → Authentication → Users**, or let reps self-serve via the "Create
  an account" panel on the login page. Turn email confirmation on/off under
  **Authentication → Providers → Email**.

## Deploying to Vercel

1. Push this repo to GitHub/GitLab.
2. In **Vercel**, **create the project inside a team-owned organization**, not a
   personal account — this keeps ownership with SLUG/Craft Lake City so the app
   survives staff changes and billing/access stays with the org. (Vercel:
   create/switch to a Team, then **Add New → Project**.)
3. Import the repo. Framework preset auto-detects **Next.js**.
4. Add the environment variables under **Project → Settings → Environment
   Variables** (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — mark it as **Sensitive**; it is server-only.
5. **Deploy.**
6. In **Supabase → Authentication → URL Configuration**, set the **Site URL**
   and add your Vercel domain(s) to **Redirect URLs** so auth works in prod.
7. Confirm **RLS is enabled** on all four tables (see above) before sharing the
   URL with anyone.

## Security checklist

- [ ] `.env.local` is **not** committed (`.gitignore` covers `.env*`).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` exists **only** on the server (never
      `NEXT_PUBLIC_`, never in a client component).
- [ ] RLS shows **ENABLED** on `slug_team_members`, `slug_leads`,
      `slug_activities`, `slug_follow_ups` in the Supabase dashboard.
- [ ] RLS policies reviewed to match your actual read/write rules.
- [ ] Supabase Auth **Site URL / Redirect URLs** include the Vercel domain.
- [ ] Vercel project lives in a **team org**, service role key marked
      **Sensitive**.

## Project structure

```
slug-sales-os/
├─ supabase/migrations/0001_init.sql   # schema + indexes + RLS policies
├─ src/
│  ├─ middleware.ts                     # session refresh + auth gating
│  ├─ lib/
│  │  ├─ constants.ts                   # stage / contact-method option lists
│  │  ├─ types.ts                       # row types (mirror the schema)
│  │  ├─ member.ts                      # provision current rep (server-only)
│  │  └─ supabase/
│  │     ├─ client.ts                   # browser client (anon key)
│  │     ├─ server.ts                   # server client (anon key + cookies)
│  │     ├─ admin.ts                    # service-role client (server-only)
│  │     └─ middleware.ts               # session-refresh helper
│  ├─ components/Nav.tsx
│  └─ app/
│     ├─ layout.tsx  globals.css  page.tsx
│     ├─ login/                         # email/password auth
│     ├─ auth/signout/route.ts
│     └─ (app)/                         # authenticated area
│        ├─ layout.tsx                  # sidebar shell + auth re-check
│        ├─ actions.ts                  # logActivity, completeFollowUp
│        ├─ dashboard/  log/  follow-ups/  pipeline/
└─ .env.example                         # placeholders only
```
