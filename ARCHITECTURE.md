# RowDay — System Architecture

**Last updated:** 2026-05-25  
**Status:** MVP in development — regatta target: Lake Ontario Invitational, early June 2026

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  RegattaCentral (www.regattacentral.com)                        │
│  Public HTML pages — no API key required                        │
│  /regatta/events  /regatta/clubs  /regatta/entries              │
│  /regatta/results.jsp  + PDF race schedule bulletins            │
└──────────────────────────────┬──────────────────────────────────┘
                               │  Playwright + Cheerio scraper
                               │  (polite: 600ms delay, browser UA)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  RowDay Backend  (Node.js + Hono)                               │
│  Railway — https://rowday-backend-production.up.railway.app     │
│                                                                 │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │  Scraper     │  │  Scheduler       │  │  REST API       │  │
│  │  rc-client   │  │  node-cron       │  │  Hono routes    │  │
│  │  rc-pdf-     │  │  every 60s       │  │  /api/regattas  │  │
│  │  parser      │  │  during racing   │  │  /api/admin     │  │
│  └──────┬───────┘  └──────┬───────────┘  └────────┬────────┘  │
│         │                 │                        │            │
│         └─────────────────┴────────────────────────┘           │
│                           │                                     │
│                    ┌──────▼──────┐                             │
│                    │ PostgreSQL  │                             │
│                    │  (Railway)  │                             │
│                    └─────────────┘                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Push Notification Service (Expo Push API)               │  │
│  │  expo-server-sdk → APNs + FCM                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │  JSON REST API
                               │  EXPO_PUBLIC_API_URL
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  RowDay App  (React Native + Expo SDK 52)                       │
│  expo-router v4 · Zustand · TanStack Query                      │
│                                                                 │
│  Onboarding → Regatta Search → Club Picker → Athlete Entry     │
│                                                                 │
│  Tabs:  [Schedule/Countdown]  [Results]  [Settings]            │
│                                                                 │
│  Push notifications via Expo Push Service                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Repository Layout

```
BRC/
├── ARCHITECTURE.md          ← this file
├── STARTUP_PLAN.md          ← business / product roadmap
├── README.md                ← project overview
├── mock-app.html            ← standalone interactive HTML prototype
│
├── backend/                 ← Node.js + Hono REST API
│   ├── src/
│   │   ├── index.ts         ← Hono app + all route definitions
│   │   ├── db/
│   │   │   ├── schema.sql   ← PostgreSQL schema (9 tables)
│   │   │   └── client.ts    ← [MISSING] postgres connection pool
│   │   ├── scraper/
│   │   │   ├── rc-client.ts      ← HTML scraper (Playwright + Cheerio)
│   │   │   ├── rc-pdf-parser.ts  ← PDF race-schedule parser
│   │   │   ├── rc-test.ts        ← integration test against live RC
│   │   │   ├── rc-scraping-notes.md  ← RC DOM/URL reference
│   │   │   └── rc-pdf-notes.md       ← PDF text format reference
│   │   └── jobs/
│   │       └── scrape-scheduler.ts ← node-cron job (polls every 60s)
│   ├── package.json
│   └── tsconfig.json
│
└── app/                     ← React Native + Expo
    ├── app/
    │   ├── _layout.tsx          ← root layout, font loading
    │   ├── age-gate.tsx         ← [MISSING] COPPA age gate
    │   ├── onboarding.tsx       ← 4-step onboarding flow
    │   └── (tabs)/
    │       ├── _layout.tsx      ← tab bar config (icons: STUB)
    │       ├── index.tsx        ← Schedule tab (countdown card)
    │       ├── results.tsx      ← Results tab
    │       └── settings.tsx     ← Settings tab (nav: STUB)
    ├── components/
    │   ├── CountdownCard.tsx    ← hero countdown + status display
    │   └── HeatSheet.tsx        ← lane-by-lane heat breakdown
    ├── store/
    │   └── useAppStore.ts       ← Zustand global state
    ├── services/
    │   └── api.ts               ← typed fetch client for all endpoints
    ├── package.json
    └── tsconfig.json
```

---

## 3. Data Flow

### 3a. Scraping Pipeline (backend)

```
fetchHeatSheet(jobId)
  │
  ├─► GET /v3/cms/regatta/{id}/heat_sheet  (HTML)
  │     ├─ has tabular data?  → parseHeatHtml() → RCHeat[]
  │     └─ empty/placeholder? → step 2
  │
  └─► findHeatSheetPdfs(jobId)
        └─► GET /regatta/?job_id={id}  (overview page)
              └─ parse all <a href="*.pdf"> links
                    └─► downloadPdf(scheduleUrl)
                          └─► parseRcSchedulePdf(buffer)
                                └─► RCHeat[]  (194 races for CSSRA 2026 ✅)

fetchEvents(jobId)  →  GET /regatta/events?job_id={id}&org_id=0  →  RCEvent[]
fetchClubs(jobId)   →  GET /regatta/clubs?job_id={id}&org_id=0   →  RCClub[]
fetchEntries(jobId) →  GET /regatta/entries?job_id={id}&org_id=0 →  RCEntry[]
fetchResults(jobId) →  GET /regatta/results.jsp?job_id={id}      →  RCHeat[] (with times)
```

**Anti-detect:** All RC requests use Playwright headless Chromium for HTML pages
(real browser TLS fingerprint + full Chrome headers). PDF downloads use direct
`fetch()` with browser User-Agent (PDFs don't need JS). 600ms polite delay
between requests.

### 3b. Scheduler Loop (backend)

```
startScrapeScheduler()
  └─► cron every 60s
        └─► isRacingHour()?  (7am–7pm local)
              ├─ NO  → skip
              └─ YES → getActiveRegattaIds() [DB query — STUBBED]
                          └─► for each active regattaId:
                                ├─► fetchHeatSheet() + fetchResults()
                                ├─► diff against DB            [STUBBED]
                                ├─► upsert race/lane rows      [STUBBED]
                                └─► sendPushNotifications()    [STUBBED]
```

### 3c. API Request Flow (frontend → backend)

```
App → GET /api/regattas
App → GET /api/regattas/:id          (regatta detail + events)
App → GET /api/regattas/:id/clubs    (entered clubs)
App → GET /api/regattas/:id/club/:clubId/schedule  (filtered heat schedule)
App → GET /api/regattas/:id/event/:eventId/heat/:heatId  (single heat)

[MISSING endpoints]
App → GET /api/regattas/:id/results  (all official results)
App → GET /api/regattas/:id/athletes?q=  (athlete name search)
App → POST /api/subscriptions        (register push token)
App → POST /api/admin/scrape         (trigger one-shot scrape, admin-only)
```

---

## 4. Database Schema

9 tables in `backend/src/db/schema.sql`. Key relationships:

```
club ──────────────────────────────────────────────────────┐
                                                           │
regatta ──┬── event ──┬── entry ──── lineup ──── club     │
          │           └── race ──── lane ────────club ─────┘
          │
          └── subscription  (device_token, athlete filter)
```

### Table summary

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `regatta` | One row per RC regatta | `rc_regatta_id`, `status` (upcoming/active/completed) |
| `event` | Event within a regatta (e.g. "Junior Men 4+") | `event_number`, `boat_class`, `category` |
| `race` | A single heat/SF/final | `stage` (heat/semifinal/final), `heat_number`, `scheduled_start`, `status` |
| `lane` | One crew/athlete in one race | `lane_number`, `entry_name`, `club_id`, `seed_time_ms`, `result_time_ms`, `place` |
| `club` | Rowing club / school | `rc_org_id`, `short_name`, `code` |
| `entry` | Club entered in an event | links `club` + `event` |
| `lineup` | Athlete in an entry (crew member) | links `entry` + `athlete` |
| `athlete` | Individual athlete | `first_name`, `last_name` |
| `subscription` | Push notification subscription | `device_token`, `platform`, `regatta_id`, `athlete_name_filter` |

**Note:** `backend/src/db/client.ts` does not yet exist. The `postgres` package
is installed. This must be created before any DB-backed routes can work.

---

## 5. API Contract

All responses are JSON. Error shape: `{ "error": "message" }` with appropriate HTTP status.

### Existing endpoints (currently return hardcoded data)

```
GET  /health
     → { status: "ok", timestamp: string }

GET  /api/regattas
     → { regattas: Regatta[] }

GET  /api/regattas/:id
     → { regatta: Regatta, events: Event[] }

GET  /api/regattas/:id/clubs
     → { regatta_id: string, clubs: Club[] }

GET  /api/regattas/:id/club/:clubId/schedule
     → { regatta_id: string, club: Club, schedule: ScheduleItem[] }
     ScheduleItem = { event: Event, heat: Heat, club_lanes: HeatLane[] }

GET  /api/regattas/:id/event/:eventId/heat/:heatId
     → { regatta: Regatta, event: Event, heat: Heat }
```

### Missing endpoints (must be built)

```
GET  /api/regattas/:id/results
     → { regatta_id: string, results: ResultItem[] }
     ResultItem = { event: Event, race: Heat, lanes: HeatLane[] }
     Only returns races where status = 'official' or 'unofficial'

GET  /api/regattas/:id/athletes?q=searchTerm
     → { athletes: AthleteMatch[] }
     AthleteMatch = { entry_name: string, club_short: string, event_name: string }
     Fuzzy search across all lane.entry_name values for this regatta

POST /api/subscriptions
     Body: { device_token: string, platform: "ios"|"android", regatta_id: string, athlete_name?: string }
     → { id: string }
     Upserts on (device_token, regatta_id)

POST /api/admin/scrape          [requires X-Admin-Secret header]
     Body or query: { job_id: string }
     → { message: string, heats: number, clubs: number, events: number }
     Triggers a full scrape + DB seed for a new regatta
```

### Type definitions (shared between backend and app)

These types are defined in `app/services/api.ts` and mirrored in `backend/src/index.ts`.
A future refactor should extract them to a shared `packages/types` module.

```typescript
Regatta      { id, rc_regatta_id, name, start_date, end_date, venue, city, state, status }
Event        { id, regatta_id, event_number, name, gender, boat_class, category, distance_meters }
Club         { id, rc_org_id, name, short_name, city, state }
Heat         { id, rc_race_id, event_id, stage_name, scheduled_start, status, lanes }
HeatLane     { lane_number, entry_name, club_short, seed_time_ms, time_ms, place, dnf, dns, dq }
ScheduleItem { event: Event, heat: Heat, club_lanes: HeatLane[] }
```

---

## 6. App State

Managed by Zustand (`app/store/useAppStore.ts`).

```typescript
AppState {
  activeRegatta:  Regatta | null   // the regatta being tracked
  followedClub:   Club | null      // club filter for schedule + results
  followedAthlete: Athlete | null  // optional single-athlete highlight

  setActiveRegatta(regatta)
  setFollowedClub(club)
  setFollowedAthlete(athlete)
  clearAll()
}
```

**Current issue:** Initial state is hardcoded to Brighton Burn 2026 / BRC / Nora Ashworth
(dev convenience). Must be changed to all-null defaults with Zustand `persist`
middleware + AsyncStorage before any real user testing.

---

## 7. Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scraping vs official API | Scraping | RC's v3 API is decommissioned; v4 is OAuth-gated (no key). Public pages accessible to any browser — hiQ v. LinkedIn (9th Cir. 2022) confirms legality. |
| Bot detection bypass | Playwright headless Chromium | RC returns 403 to Node.js `fetch()`. Real Chromium TLS fingerprint passes. Playwright shares a single browser instance for all scrapes. |
| PDF parsing | pdf-parse@1.1.1 | Race schedule PDFs are the source of truth for heat schedules before HTML entries release. v2.x has a broken API; stick to 1.x. |
| Mobile framework | React Native + Expo SDK 52 | Cross-platform iOS + Android from one codebase. Expo Go for zero-friction parent beta testing (QR code → app, no App Store). |
| Navigation | expo-router v4 | File-system routing, consistent with modern Expo patterns. |
| State management | Zustand | Minimal boilerplate, fast, no Provider ceremony. |
| Backend framework | Hono + @hono/node-server | Minimal, typed, fast. Same API shape would work on Cloudflare Workers later if needed. |
| Database | PostgreSQL via Railway | One-click provisioned on Railway, same env as the API service. |
| Push notifications | Expo Push Service | Abstracts APNs + FCM. Free at MVP scale. Tokens are opaque strings — no APNs/FCM keys needed in development. |
| Railway hosting | Railway Hobby plan | ~$7-10/month total. Zero-config deploy from git. Managed Postgres included. |

---

## 8. Environment Variables

### Backend (`backend/.env`)

```
DATABASE_URL=postgresql://...    # set automatically by Railway Postgres
PORT=3000
NODE_ENV=development|production
RC_REQUEST_DELAY_MS=600          # polite scraping delay
ADMIN_SECRET=<random hex>        # protects POST /api/admin/scrape
```

### App (`app/.env`)

```
EXPO_PUBLIC_API_URL=https://rowday-backend-production.up.railway.app
```

During local development on a physical device, set to `http://<mac-LAN-IP>:3000`.

---

## 9. What's Working vs What's Stubbed

### ✅ Working (tested against live data)

| Component | Evidence |
|-----------|---------|
| RC HTML scraper (events) | 40/40 events from CSSRA 2026 |
| RC HTML scraper (clubs) | 131/131 clubs from CSSRA 2026 |
| PDF race schedule parser | 194/194 races from CSSRA 2026 |
| `fetchHeatSheet()` end-to-end | CMS check → PDF fallback → 194 races |
| Playwright bot-detection bypass | No 403s from RC on headless Chromium |
| Hono server + routes | Starts, serves hardcoded data, CORS + logger |
| App onboarding flow | 4-step UI built, no real backend calls yet |
| App CountdownCard | Ticking countdown with color thresholds |
| App HeatSheet | Lane-by-lane display with place circles |

### 🔶 Stubbed / Hardcoded (must be replaced before real users)

| File | Line(s) | Issue |
|------|---------|-------|
| `backend/src/index.ts` | 16–230 | All API routes return hardcoded in-memory arrays — scraper never called |
| `backend/src/db/client.ts` | — | File does not exist. `postgres` package installed, nothing uses it |
| `backend/src/jobs/scrape-scheduler.ts` | 18 | `ACTIVE_REGATTA_IDS = []` — scheduler runs but never scrapes |
| `backend/src/jobs/scrape-scheduler.ts` | 47 | `// TODO: diff + persist + notify` — the whole write path is missing |
| `app/store/useAppStore.ts` | 42–68 | Hardcoded Brighton Burn / Nora Ashworth defaults will ship to users |
| `app/app/onboarding.tsx` | 227 | `// TODO: requestPermissionsAsync()` — push notifications not wired |
| `app/app/(tabs)/settings.tsx` | 43, 51, 59 | All action rows are dead-end `// TODO` comments |
| `app/app/(tabs)/_layout.tsx` | 7–8 | Tab icons return `null` — no icons in tab bar |
| `app/app/age-gate.tsx` | — | File does not exist. Required for COPPA + App Store |
| `app/.env` | — | File does not exist. App silently uses localhost:3000 |

### ❌ Not yet built

- DB → API wiring (entire backend persistence layer)
- `GET /api/regattas/:id/results` endpoint
- `GET /api/regattas/:id/athletes?q=` endpoint
- `POST /api/subscriptions` endpoint
- `POST /api/admin/scrape` endpoint
- Push notification send path (after results come in)
- Zustand AsyncStorage persistence
- Age gate screen

---

## 10. Scraper Reference

The scraper has two modes, documented in detail in `backend/src/scraper/`:

**HTML mode** (`rc-client.ts`):
- All RC data pages are server-rendered HTML. Cheerio parses them after Playwright fetches.
- Working URLs: `/regatta/events`, `/regatta/clubs`, `/regatta/entries`, `/regatta/results.jsp`
- Dead URLs (404): `/regatta/event_list/`, old search params with `season=` and `country=`

**PDF mode** (`rc-pdf-parser.ts`):
- Triggered when `/v3/cms/regatta/{id}/heat_sheet` is empty (common for upcoming regattas)
- RC hosts a "Preliminary Race Schedule" PDF with the full race schedule
- Returns `RCHeat[]` with `lanes: []` (lane assignments come from HTML entries page)
- Validated against CSSRA 2026: 40 events / 194 races, 100% match

**Test fixture** (use for development):
- `job_id=10115` — CSSRA Championships 2026 (St. Catharines, ON)
- Stable assertion values: 40 events, 131 clubs, 194 races, E.L. Crossley S.S. top club (32 entries)
- Run: `cd backend && npx tsx src/scraper/rc-test.ts`

---

## 11. Local Development

```bash
# Backend
cd backend
npm install
npx tsx src/index.ts          # starts on :3000
npx tsx src/scraper/rc-test.ts  # tests scraper against live RC

# App
cd app
npm install
npx expo start                 # Expo Go on phone — scan QR
npx expo start --tunnel        # Expo Go on phone over internet
```

The backend and app are independent. You can run either standalone.
When running the app, set `EXPO_PUBLIC_API_URL` in `app/.env` to point at
wherever the backend is running (localhost for dev, Railway for staging/prod).
