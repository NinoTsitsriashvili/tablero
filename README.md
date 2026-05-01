# Tablero

An internal admin panel for a small e-commerce business — orders, inventory, marketing analytics, and finance, all in one place.

Built with Next.js 16, React 19, TypeScript, and a serverless Postgres backend. The UI is in Georgian; the codebase is in English.

> **Live demo:** _coming soon_
> **Status:** in production use

---

## What it does

Tablero replaces a stack of spreadsheets and ad-hoc tools with a single dashboard the team logs into every day.

- **Dashboard** — orders today / this week / this month, revenue at a glance, order-status counts (pending, stickered, shipped, postponed), pending-order queue, and low-stock alerts.
- **Storage (Inventory)** — product catalog with quantity tracking, soft-delete with a recoverable trash view, and per-product detail pages.
- **Orders** — full order lifecycle from creation to delivery. Status workflow, filtering by status and location, paginated list, order detail with copy-to-clipboard, edit page with city/village location options, and one-click Excel export.
- **Statistics** — sales and operational analytics across time ranges.
- **Marketing** — Facebook Ads insights synced from the Marketing API, ad-campaign spend tracked in USD and converted to GEL via daily exchange rates, and a payments ledger.
- **Auth** — credentials-based login (NextAuth) with bcrypt-hashed passwords.
- **Theming** — dark / light mode toggle persisted across sessions.

---

## Tech stack

| Layer        | Choice                                          |
| ------------ | ----------------------------------------------- |
| Framework    | Next.js 16 (App Router) + React 19              |
| Language     | TypeScript 5                                    |
| Styling      | Tailwind CSS v4                                 |
| Database     | Neon Postgres (serverless driver)               |
| Auth         | NextAuth.js (Credentials provider) + bcrypt     |
| External API | Facebook Marketing API (Graph v19)              |
| Export       | `xlsx` for spreadsheet downloads                |
| AI           | Anthropic SDK (planned features)                |
| Deployment   | Vercel                                          |

---

## Architecture highlights

- **Server-rendered admin** — all sensitive logic lives in Next.js Route Handlers under `src/app/api/`. The client only ever talks to first-party endpoints.
- **Session-gated APIs** — every route handler validates a NextAuth session before touching the database.
- **Tagged-template SQL** — queries use `@neondatabase/serverless`'s tagged templates, which parameterize values and prevent SQL injection by construction.
- **FX-aware analytics** — Facebook ad spend (USD) is reconciled against a stored exchange-rate table so all reporting lands in GEL at the rate that applied on the spend date.
- **Soft delete** — products and orders are recoverable; nothing is destructively removed from the source of truth.

---

## Getting started

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) Postgres database
- (Optional) A Facebook Marketing API access token + ad account ID for the marketing module

### Setup

```bash
git clone https://github.com/NinoTsitsriashvili/tablero.git
cd tablero
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```bash
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
SETUP_KEY=any-random-string-used-once

# Optional — only needed for the Marketing module
FB_AD_ACCOUNT_ID=act_XXXXXXXXXXX
FB_ACCESS_TOKEN=EAA...
```

### Initialize the database

Run the SQL files in `scripts/` against your Neon database (Neon Console → SQL Editor):

```bash
scripts/create-orders-table.sql
scripts/update-orders-schema.sql
```

### Create the first admin user

Start the dev server, then call the one-shot setup endpoint with your `SETUP_KEY`:

```bash
npm run dev
curl -X POST http://localhost:3000/api/setup \
  -H "Content-Type: application/json" \
  -d '{"setupKey":"<your SETUP_KEY>","username":"admin","password":"<strong password>"}'
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

---

## Project structure

```
src/
├── app/
│   ├── api/              # Route handlers (auth, orders, products, fb-ads, ...)
│   ├── dashboard/        # Daily/weekly/monthly KPIs
│   ├── orders/           # Order list & detail
│   ├── storage/          # Product inventory
│   ├── statistics/       # Sales analytics
│   ├── marketing/        # Facebook Ads insights
│   └── page.tsx          # Login
├── components/           # Navbar, ProductForm, OrderForm, ThemeProvider, …
├── lib/                  # db, auth, helpers
└── types/
scripts/                  # SQL migrations
```

---

## Deployment

Deployed on Vercel via GitHub integration — pushes to `main` trigger an automatic production deploy. Environment variables are managed in the Vercel project settings.

---

## License

Proprietary — built for internal use. Code is published for portfolio purposes.
