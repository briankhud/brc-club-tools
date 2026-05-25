# RowDay Backend — DB Wiring Complete

## What was built

### Task 1 — `src/db/client.ts`
Postgres connection pool using the `postgres` package. Throws at startup if `DATABASE_URL` is missing (fail-fast). SSL auto-enabled in production. Max 10 connections, 30s idle timeout.

### Task 2 — `src/db/queries.ts`
Typed query layer. Key design choices:

- **All DB types use `snake_case`** matching `schema.sql` column names exactly.
- **`getLanesWithDetails()`** (private) and its public alias `getLanesForRaceWithDetails()` JOIN `lane → entry → club` to resolve `entry_name` and `club_short` at query time — the `lane` table only stores `entry_id` FK, not redundant text fields.
- **`upsertEntry()`** exported — needed by both the admin scrape endpoint and the scheduler when lanes arrive with no pre-seeded entry row.
- **`getRaceById()`** exported — used by the `heat/:heatId` endpoint to fetch a single race without an expensive full-regatta scan.
- **`searchAthletes()`** uses `ILIKE %q%` — case-insensitive fuzzy match on `entry.entry_name`. Results capped at 50.
- **`getResultsForRegatta()`** filters `race.status IN ('official', 'unofficial')` and joins event metadata in a single query, then fetches lanes per race.
- Upsert conflict keys: `rc_regatta_id`, `rc_event_id`, `rc_race_id`, `rc_org_id`, `(race_id, lane_number)`, `(device_token, regatta_id)`.

### Task 3 — `src/index.ts` (rewritten)
All 5 existing routes replaced with DB-backed implementations. 4 new endpoints added:

| Endpoint | Notes |
|----------|-------|
| `GET /api/regattas/:id/results` | Returns only `status = 'official' \| 'unofficial'` races |
| `GET /api/regattas/:id/athletes?q=` | Min query length 2; ILIKE fuzzy search via `entry.entry_name` |
| `POST /api/subscriptions` | Resolves `regatta_id` as either UUID or `rc_regatta_id`; ignores `athlete_name` (see open questions) |
| `POST /api/admin/scrape` | Full scrape pipeline: overview → events → clubs → heat sheet → races → lanes |

**Shape compatibility**: All response objects are mapped through `mapRegatta()`, `mapEvent()`, `mapClub()`, `mapRace()`, `mapLane()` helpers to preserve the exact JSON shapes `app/services/api.ts` expects. Fields that don't exist in the schema (e.g. `short_name`, `description`, `event_count` on regatta; `seed_time_ms`, `athlete_id` on lane) are returned as `null` / empty string.

### Task 4 — `src/jobs/scrape-scheduler.ts` (rewritten)
- **DB-driven active regattas**: `getActiveRegattaIds()` is called at the start of each tick — no more static `ACTIVE_REGATTA_IDS` array.
- **`fetchResults()` only on each tick** (not `fetchHeatSheet` — that's slow and uses PDFs).
- **Diff logic**: Compares `existingLane.time_ms` against `freshLane.result_time` (parsed to ms). Upserts only if there's a change.
- **Push notifications**: `sendRaceResultNotification()` uses `expo-server-sdk` chunked batching. Invalid tokens logged and skipped.
- **Graceful shutdown**: `SIGTERM` / `SIGINT` handlers call `closeBrowser()`.

### Task 5 — `.env.example` (updated)
Replaced old Redis/RC_API_BASE vars with correct set: `DATABASE_URL`, `PORT`, `NODE_ENV`, `RC_REQUEST_DELAY_MS`, `ADMIN_SECRET`.

---

## Design choices

1. **`upsertEntry` in the scrape path**: The `lane` table requires an `entry_id` FK. The admin scrape creates entry rows from heat sheet lane data. The scheduler also creates entries on-the-fly if a result appears for a lane that wasn't pre-seeded (common for late scratches / late heat sheet release).

2. **`rc_org_id` namespacing**: When upserting clubs during a scrape, we prefix the RC `alias` with `jobId-club-` to avoid collisions between clubs at different regattas that happen to share an alias. In production you'd want a real RC org ID lookup (via `fetchClubIdMap()`).

3. **No `athlete_name_filter` in `subscription` table**: The schema stores `athlete_id` (UUID FK), not a free-text name. The `POST /api/subscriptions` body accepts `athlete_name` but the subscription table has no text column for it. The current implementation ignores `athlete_name`. See open questions.

4. **`mapRegatta.short_name = null`**: The `regatta` table has no `short_name` column. It's returned as null. The app's `Regatta` type marks it optional (`short_name?`), so this is safe.

5. **`mapLane.seed_time_ms = null`**: The `lane` table has no `seed_time_ms` column (only `time_ms`). The heat sheet data stores seed times as `time_ms` during the initial scrape. After results are posted the same column holds the result time. The app's `HeatLane.seed_time_ms` will always be null from the DB layer.

---

## Open questions / warnings

1. **`athlete_name_filter` for subscriptions**: The spec says `POST /api/subscriptions` accepts `athlete_name`. The DB schema has `athlete_id` (UUID) not a text filter. Either:
   - Add `athlete_name_filter TEXT` column to the `subscription` table, OR
   - Require the app to send an athlete UUID (requires athlete search first)
   
   Currently `athlete_name` in the subscription body is silently ignored.

2. **`seed_time_ms` vs `time_ms`**: The `lane` table uses a single `time_ms` column for both seed and result times. The `mapLane()` function returns `seed_time_ms: null` always. If you need both, add a `seed_time_ms INTEGER` column to the `lane` table.

3. **Club deduplication across regattas**: `upsertClub` currently prefixes `rc_org_id` with `jobId`. This means the same real club gets multiple rows for different regattas. Real fix: use `fetchClubIdMap()` to get RC's actual org IDs (integers) and use those as the unique key.

4. **No `startScrapeScheduler()` call in `index.ts`**: The scheduler is not wired into the server startup. Add `import { startScrapeScheduler } from "./jobs/scrape-scheduler.js"; startScrapeScheduler();` to `index.ts` when ready to run it in production.

5. **Admin scrape `heats` vs `races_count`**: The ARCHITECTURE.md spec shows the response as `{ message, heats, clubs, events }` but the task spec shows `{ message, events_count, clubs_count, races_count }`. The implementation uses `events_count / clubs_count / races_count` (matching the task spec).

6. **No schema migration runner**: `schema.sql` needs to be applied to the database before the backend can start. Add a migration step to your Railway deploy or run manually: `psql $DATABASE_URL -f src/db/schema.sql`.
