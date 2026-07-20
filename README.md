# Business Tracker — Shopify + Meta Ads (PKR)

Ek complete business tracking dashboard jo aap ke **Shopify** store aur **Meta (Facebook) ads** ka data auto-sync karke profit, cash flow, inventory, aur COD charges track karta hai. Sab kuch **PKR** mein.

Next.js 14 (App Router) · Prisma · Postgres (Neon) · Recharts · Tailwind.

## Features

- **Dashboard** — revenue, net profit, ad spend, cash balance, ROAS, charts (revenue vs profit, expense breakdown, daily ad spend).
- **Orders / Sales** — Shopify orders auto-synced, searchable, status + payment method ke saath.
- **Profit Report** — full P&L: Revenue − COGS = Gross Profit − Ads − COD − Expenses = Net Profit.
- **Expenses** — manual expense tracking category-wise (auto cash-out ledger entry).
- **Cash Flow** — har cash-in/out ka running-balance ledger (sales, inventory buys, ads, COD, expenses auto add hote hain + manual entries).
- **Meta Ads** — daily & weekly reports, spend vs revenue vs ROAS chart, cost-per-purchase.
- **Inventory** — Shopify products auto-synced, manual buy-price (COGS ka base), inventory buy record karke stock + cash auto-update.
- **COD Charges** — courier-wise COD tracking, pending/delivered/returned status.
- **Settings** — manual sync trigger + sync logs.

## Setup

### 1. Dependencies install karo

```bash
npm install
```

### 2. Environment variables

`.env.example` ko `.env` mein copy karke apni values daalo:

```bash
cp .env.example .env
```

- `DATABASE_URL` — Neon (ya koi Postgres) connection string.
- `SHOPIFY_STORE_DOMAIN` + `SHOPIFY_ADMIN_TOKEN` — Shopify custom app se (Admin API).
  - Scopes chahiye: `read_orders`, `read_products`, `read_inventory`.
- `SHOPIFY_WEBHOOK_SECRET` — real-time order webhook verify karne ke liye (optional).
- `META_ACCESS_TOKEN` + `META_AD_ACCOUNT_ID` — Meta Marketing API (`ads_read` scope, account ID `act_` prefix ke saath).
- `CRON_SECRET` — koi lamba random string; sync endpoints ko protect karta hai.

### 3. Database schema push karo

```bash
npm run db:push
```

### 4. Dev server chalao

```bash
npm run dev
```

Kholo: http://localhost:3000

### 5. Pehla data sync

Settings page pe jao, apna `CRON_SECRET` daalo, aur **Sync Now** dabao. Ye Shopify orders + products aur Meta ads le aayega.

## Deployment (Vercel)

1. GitHub pe push karo, Vercel pe import karo.
2. Saari env variables Vercel project settings mein add karo.
3. Deploy ke baad ek dafa `npm run db:push` chalao (ya Vercel build mein).
4. `vercel.json` mein cron already set hai — har ghante `/api/cron/sync` chalega (Vercel `CRON_SECRET` ko Bearer token ke tor par bhejta hai).

### Real-time orders (optional)

Shopify Admin > Settings > Notifications > Webhooks mein add karo:

- Event: `Order creation`, `Order payment`, `Order updated`, `Order cancelled`
- URL: `https://your-app.vercel.app/api/webhooks/shopify`
- Format: JSON

## COGS kaise calculate hoti hai

Har order ke line items ka **SKU** aap ke Product ke `buyPrice` se match hota hai. Buy price aap **Inventory** page se manually set karte ho (ya inventory buy record karte waqt auto-update hoti hai). COGS = Σ (quantity × buyPrice).

## Notes

- Currency display `NEXT_PUBLIC_CURRENCY` se control hoti hai (default PKR).
- Sync last 60 din ke orders aur last 30 din ki Meta insights lata hai (incremental-ish, fast).
- Auth abhi sirf `CRON_SECRET` par hai (sync endpoints). Dashboard pages khud protected nahi — production mein ek auth layer (e.g. Vercel password protection ya NextAuth) add karna behtar hoga.
