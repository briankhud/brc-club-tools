# RowDay Backend — Railway Deploy Guide

This guide walks you through deploying the RowDay backend to Railway from scratch.
Every command is copy-paste ready. Takes about 15–20 minutes.

---

## Memory note

Playwright + Chromium uses ~300–400 MB of RAM. Railway's Hobby plan gives each service
512 MB. This is tight but workable for MVP because the browser is only active during
scrape cycles (7 AM–7 PM race days). Outside racing hours Chromium idles at ~150 MB.

If you hit out-of-memory crashes during a regatta, you can split the scraper into its
own Railway service with a higher memory limit. That's not needed now.

---

## 1. Prerequisites

### Install Railway CLI

```bash
# macOS (Homebrew)
brew install railway

# or with npm
npm install -g @railway/cli
```

Verify it installed:

```bash
railway --version
```

### Create a Railway account

Go to https://railway.app and sign up. The Hobby plan is ~$5/month base + usage.
For RowDay MVP (one service + one Postgres) expect $7–10/month total.

---

## 2. Log in to Railway

```bash
railway login
```

A browser window opens. Log in, then come back to the terminal.

---

## 3. Initialize the Railway project

Run this from the `backend/` directory:

```bash
cd /path/to/BRC/backend
railway init
```

When prompted:
- **Project name:** `rowday` (or whatever you like)
- **Create a new project:** yes

This creates a `.railway` directory in the backend folder. It is gitignored by default.

---

## 4. Add a PostgreSQL service in the Railway dashboard

1. Go to https://railway.app/dashboard
2. Open your `rowday` project
3. Click **+ New** → **Database** → **Add PostgreSQL**
4. Railway provisions a Postgres instance in ~30 seconds
5. Click the Postgres service → **Connect** tab
6. Copy the **DATABASE_URL** (starts with `postgresql://postgres:...`) — you'll need it
   in step 6 (environment variables) and step 5 (running schema.sql)

---

## 5. Run schema.sql against Railway Postgres

You need the `DATABASE_URL` from step 4. Replace the placeholder below with your real URL.

```bash
# One-liner: pipe schema.sql directly into Railway's Postgres
psql "postgresql://postgres:PASSWORD@HOST:PORT/railway" \
  -f /path/to/BRC/backend/src/db/schema.sql
```

Or use the migration script (requires DATABASE_URL in your local environment):

```bash
cd /path/to/BRC/backend
DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway" \
  npx tsx src/db/migrate.ts
```

You should see:

```
Running schema migration...
Done.
```

If you see `uuid-ossp` errors, that extension may not be enabled. Run:

```bash
psql "postgresql://postgres:PASSWORD@HOST:PORT/railway" \
  -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
```

Then re-run the schema.

---

## 6. Set environment variables

In the Railway dashboard, go to your **rowday** service (not the Postgres service) →
**Variables** tab. Add each variable below.

| Variable | Example value | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:...@...` | Copy from Postgres service → Connect tab. Railway may set this automatically if you link the services. |
| `PORT` | `3000` | The port Hono listens on. Railway sets `PORT` automatically too — but set it explicitly to be safe. |
| `NODE_ENV` | `production` | Enables SSL for Postgres, disables dev-only logging. |
| `RC_REQUEST_DELAY_MS` | `600` | Polite scraping delay in milliseconds. Don't set lower than 500. |
| `ADMIN_SECRET` | `<random hex string>` | Protects `POST /api/admin/scrape`. Generate one with: `openssl rand -hex 32` |

### Generate the ADMIN_SECRET

```bash
openssl rand -hex 32
```

Copy the output and paste it into Railway as `ADMIN_SECRET`. Save it somewhere safe —
you'll need it to trigger scrapes.

### Linking Postgres to the API service (auto-injects DATABASE_URL)

In Railway dashboard:
1. Click your API service → **Variables** tab
2. Click **+ Add Variable Reference**
3. Select the Postgres service → `DATABASE_URL`

This auto-populates `DATABASE_URL` in your API service and keeps it in sync if Postgres
credentials ever rotate.

---

## 7. Deploy

From the `backend/` directory:

```bash
railway up
```

Railway will:
1. Detect Node.js via Nixpacks
2. Run `npm install` (which triggers `postinstall` → `playwright install chromium --with-deps`)
3. Run `npm run build` (TypeScript → dist/)
4. Start with `npm start` (node dist/index.js)

The first deploy takes 3–5 minutes because Playwright downloads Chromium (~170 MB).
Subsequent deploys are faster (Railway caches node_modules).

Watch the build logs:

```bash
railway logs
```

A successful deploy ends with something like:

```
RowDay backend running on http://localhost:3000
```

---

## 8. Verify the deploy

Get your Railway service URL from the dashboard (it looks like
`rowday-production.up.railway.app`) or run:

```bash
railway domain
```

Then hit the health endpoint:

```bash
curl https://YOUR-APP.up.railway.app/health
```

Expected response:

```json
{"status":"ok","timestamp":"2026-05-25T..."}
```

If you get a 502 or connection refused, check logs with `railway logs`.

---

## 9. Trigger the first scrape

Once the regatta is live on RegattaCentral, run a full scrape to seed the database.
Replace `NNNNN` with the actual RegattaCentral job_id for the Lake Ontario Invitational
(find it in the RC URL: `regattacentral.com/regatta/?job_id=NNNNN`).

```bash
curl -X POST \
  -H "X-Admin-Secret: YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"job_id":"NNNNN"}' \
  https://YOUR-APP.up.railway.app/api/admin/scrape
```

Expected response (takes 10–30 seconds while Playwright scrapes):

```json
{"message":"Scrape complete","heats":194,"clubs":131,"events":40}
```

After the scrape, mark the regatta as active in Postgres so the scheduler starts
polling it every 60 seconds during racing hours:

```bash
psql "postgresql://postgres:PASSWORD@HOST:PORT/railway" \
  -c "UPDATE regatta SET status='active' WHERE rc_regatta_id='NNNNN';"
```

Replace `NNNNN` with the same job_id. This is a manual step because Lake Ontario
Invitational isn't confirmed yet — wait until you have the real RC job_id.

---

## 10. Point the Expo app at the Railway URL

In `app/.env` (create this file if it doesn't exist):

```
EXPO_PUBLIC_API_URL=https://YOUR-APP.up.railway.app
```

Then rebuild / restart Expo:

```bash
cd /path/to/BRC/app
npx expo start --clear
```

On race day: scan the QR code on your phone → app talks to Railway backend live.

---

## 11. Monitor logs

Watch live logs:

```bash
railway logs --tail
```

Or open the Railway dashboard → your service → **Logs** tab.

Key things to watch for on race day:
- `Scraping regatta NNNNN...` — scheduler fired, scrape in progress
- `Error` lines — any HTTP 4xx/5xx from RegattaCentral (usually transient)
- `heap out of memory` — Playwright memory pressure; see note at top of this doc

---

## Troubleshooting

### Build fails with "chromium not found" or "Missing dependencies"

Option A (`playwright install chromium --with-deps`) may have failed. Switch to Option B:

1. The `backend/nixpacks.toml` file already contains the Nix system packages for Chromium.
   It is active by default (present in the repo). Option A and Option B can coexist —
   Option B pre-installs system libs, Option A installs the Playwright-managed Chromium binary.
2. Redeploy: `railway up`

### Postgres connection errors on startup

- Make sure `DATABASE_URL` is set in the Railway service variables (step 6)
- Make sure the schema has been applied (step 5)
- Check `NODE_ENV=production` is set so the SSL config is correct

### "Error: ADMIN_SECRET is required" on scrape endpoint

The backend checks `X-Admin-Secret` header. Make sure the value in your `curl` command
matches the `ADMIN_SECRET` environment variable exactly.

### Scheduler runs but never scrapes

The scheduler only scrapes regatta IDs with `status='active'` in the database.
After the first manual scrape (step 9), you must set the status manually:

```sql
UPDATE regatta SET status='active' WHERE rc_regatta_id='NNNNN';
```

---

## Quick-reference: all commands

```bash
# 1. Install Railway CLI
brew install railway

# 2. Log in
railway login

# 3. Init project (run from backend/)
cd /path/to/BRC/backend && railway init

# 4. (Dashboard) Add PostgreSQL service → copy DATABASE_URL

# 5. Apply schema
DATABASE_URL="..." npx tsx src/db/migrate.ts

# 6. (Dashboard) Set env vars: DATABASE_URL, PORT, NODE_ENV, RC_REQUEST_DELAY_MS, ADMIN_SECRET

# 7. Deploy
railway up

# 8. Verify
curl https://YOUR-APP.up.railway.app/health

# 9. First scrape
curl -X POST -H "X-Admin-Secret: SECRET" \
  -d '{"job_id":"NNNNN"}' \
  https://YOUR-APP.up.railway.app/api/admin/scrape

# 10. Activate regatta
psql "DATABASE_URL" -c "UPDATE regatta SET status='active' WHERE rc_regatta_id='NNNNN';"

# 11. Watch logs
railway logs --tail
```
