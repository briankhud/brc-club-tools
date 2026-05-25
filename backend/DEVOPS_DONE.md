# DevOps Done — RowDay Backend

## What was built

### 1. `package.json` — updated scripts

Added `start:dev` and `postinstall` to the existing scripts block:

- `"start:dev": "tsx src/index.ts"` — run locally without compiling
- `"postinstall": "npx playwright install chromium --with-deps"` — installs Chromium
  and all system dependencies during Railway's build phase (runs automatically after
  `npm install`)

The existing `dev`, `build`, and `start` scripts were already correct and are unchanged.

### 2. `tsconfig.json` — no changes needed

Already had `"outDir": "./dist"` and `"rootDir": "./src"`. Nothing to do.

### 3. `railway.json` — new file

Tells Railway to:
- Use Nixpacks (Node.js autodetection)
- Build with `npm run build` (tsc → dist/)
- Start with `npm start` (node dist/index.js)
- Restart up to 3 times on failure

### 4. `nixpacks.toml` — new file (Option B fallback)

Pre-installs Chromium system libraries at the Nix level. Intended as a fallback if
the `postinstall` approach (Option A) fails. Both files coexist safely: Option B
installs OS-level libs, Option A installs the Playwright-managed Chromium binary on
top. Having both active means Playwright's Chromium has all its shared-library
dependencies guaranteed.

### 5. `DEPLOY.md` — new file

Complete step-by-step Railway deploy guide. Written for a non-DevOps audience.
Covers: CLI install, railway init, Postgres provisioning, schema migration, env vars,
deploy command, health check, first scrape trigger, activating the regatta in DB,
pointing the Expo app at Railway, and monitoring.

### 6. `src/db/migrate.ts` — new file

Reads `schema.sql` from the same directory and applies it via `sql.unsafe()`.
Run with: `DATABASE_URL="..." npx tsx src/db/migrate.ts`

---

## TypeScript compile status

`npx tsc --noEmit` after these changes shows 4 errors, **none in any file I created or
modified**. The errors are pre-existing Backend Engineer work-in-progress:

| File | Error | Owner |
|---|---|---|
| `src/index.ts:19` | Module `./db/queries.js` has no exported member `getLanesForRaceWithDetails` | Backend Engineer — queries.ts needs that export |
| `src/index.ts:381` | Property `job_id` does not exist on type `{}` | Backend Engineer — Hono query typing issue |
| `src/jobs/scrape-scheduler.ts:13` | No declaration file for `node-cron` | Backend Engineer — needs `npm i -D @types/node-cron` |
| `src/jobs/scrape-scheduler.ts:43` | Property `length` does not exist on `RCHeatSheetResult` | Backend Engineer — type mismatch on fetchHeatSheet return value |

`src/db/migrate.ts` compiles cleanly.

---

## Uncertainties about Railway + Playwright compatibility

### Moderate confidence (should work, but watch the first deploy)

**Option A (`postinstall` + `playwright install --with-deps`):**

Playwright's `--with-deps` flag detects the OS and installs the right system packages
(on Debian/Ubuntu via apt). Railway's Nixpacks Node.js build environment uses Ubuntu.
This is the officially supported way to install Playwright in CI and container
environments. It _should_ work.

Risk: if Railway's Nixpacks Ubuntu image is missing a lib that `--with-deps` expects
to install via apt, the build may fail. In that case, switch to Option B.

**Option B (`nixpacks.toml` system packages):**

The Nix package names in `nixpacks.toml` match the packages that Playwright documents
as required for headless Chromium on Linux. However, Nix package names can drift or
be version-pinned differently than expected. If Option B is needed, verify the package
names against the current Nixpkgs registry: https://search.nixos.org/packages

**Memory ceiling:**

The Railway Hobby plan gives 512 MB per service. Playwright + Chromium peaks at
~350–400 MB during a scrape. Node.js + Hono + pg at rest uses ~50–80 MB. This leaves
~60–110 MB headroom. Fine for MVP, but a single OOM event during peak race day will
restart the service (Railway restarts on failure, max 3 retries per `railway.json`).

If OOM becomes a problem:
- Upgrade the Railway service to a plan with more RAM (Pro plan → configurable)
- Or split the scraper into a separate Railway service with more memory and have it
  write results to Postgres; the API service has no Playwright at all

### High confidence (not a concern)

- The singleton browser pattern (one Chromium process, multiple page tabs) is correct.
  It minimizes RAM and startup latency. Don't change it.
- PostgreSQL on Railway auto-injects `DATABASE_URL` when linked to the API service.
- The `ssl: { rejectUnauthorized: false }` in `db/client.ts` is correct for Railway
  Postgres — Railway uses self-signed certs on the internal network.

---

## What Brian needs to do manually

### Before the Lake Ontario Invitational

1. **Find the RC job_id** for Lake Ontario Invitational on regattacentral.com.
   It's the `job_id=` param in the URL (e.g. `https://www.regattacentral.com/regatta/?job_id=NNNNN`).

2. **Deploy the backend** — follow `DEPLOY.md` step by step.

3. **Apply the schema** — `npx tsx src/db/migrate.ts` against Railway Postgres.

4. **Set env vars** in Railway dashboard — especially `ADMIN_SECRET`.

5. **Wait for Backend Engineer** to finish the DB-backed routes and `POST /api/admin/scrape`
   before triggering the first scrape. The scrape endpoint currently returns hardcoded
   data (see ARCHITECTURE.md section 9 "Stubbed").

### On race day (once regatta is confirmed and Backend Engineer work is complete)

1. Trigger first scrape:
   ```bash
   curl -X POST \
     -H "X-Admin-Secret: YOUR_SECRET" \
     -d '{"job_id":"NNNNN"}' \
     https://YOUR-APP.up.railway.app/api/admin/scrape
   ```

2. Activate the regatta so the 60-second scheduler starts polling:
   ```sql
   UPDATE regatta SET status='active' WHERE rc_regatta_id='NNNNN';
   ```

3. Point the Expo app: set `EXPO_PUBLIC_API_URL` in `app/.env` to the Railway URL.

4. Send the QR code to BRC parents.
