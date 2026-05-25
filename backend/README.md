# RowDay Backend

Node.js + Hono API server for the RowDay rowing companion app.

## Stack

- **Runtime:** Node.js 20+
- **Framework:** [Hono](https://hono.dev) with `@hono/node-server`
- **Database:** PostgreSQL (via `postgres` driver)
- **Cache / pub-sub:** Redis (via `ioredis`)
- **Scraping:** `cheerio` + `node-fetch` targeting Regatta Central
- **Push notifications:** `expo-server-sdk`

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your local database credentials
```

### 3. Create the database and run the schema

```bash
createdb rowday
psql -d rowday -f src/db/schema.sql
```

### 4. Start the dev server

```bash
npm run dev
```

The server starts on `http://localhost:3000`. Visit `/health` to confirm it's running.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/regattas` | List all regattas |
| GET | `/api/regattas/:id` | Regatta detail + events |
| GET | `/api/regattas/:id/clubs` | Clubs entered in a regatta |
| GET | `/api/regattas/:id/club/:clubId/schedule` | Club's full heat schedule |
| GET | `/api/regattas/:id/event/:eventId/heat/:heatId` | Heat sheet with lanes |

Currently returns hardcoded seed data for **Brighton Burn 2026**. Live Regatta Central scraping is stubbed in `src/scraper/rc-client.ts`.

## Project Structure

```
src/
  index.ts              — Hono server + routes
  db/
    schema.sql          — PostgreSQL table definitions
  scraper/
    rc-client.ts        — Regatta Central data fetcher
  jobs/
    scrape-scheduler.ts — cron-based polling job
```
