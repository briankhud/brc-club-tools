/**
 * Typed query functions for all RowDay database operations.
 *
 * Column names match schema.sql exactly (snake_case). Types use the
 * postgres package's tagged template syntax for full type inference.
 *
 * Design notes:
 * - All UUIDs are returned as strings (postgres driver serialises UUID → string)
 * - Timestamps are returned as Date objects unless marked as string
 * - The `lane` table joins through `entry` + `club` to resolve entry_name /
 *   club_short at query time rather than storing them redundantly
 */

import { sql } from "./client.js";

// ---------------------------------------------------------------------------
// DB row types — match schema.sql column names exactly
// ---------------------------------------------------------------------------

export interface DbRegatta {
  id: string;
  rc_regatta_id: string;
  name: string;
  start_date: Date;
  end_date: Date;
  venue: string | null;
  city: string | null;
  state: string | null;
  status: string;
  fetched_at: Date | null;
  created_at: Date;
}

export interface DbEvent {
  id: string;
  rc_event_id: string | null;
  regatta_id: string;
  event_number: number | null;
  name: string;
  gender: string | null;
  boat_class: string | null;
  category: string | null;
  distance_meters: number | null;
  display_order: number | null;
  created_at: Date;
}

export interface DbClub {
  id: string;
  rc_org_id: string | null;
  name: string;
  short_name: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  created_at: Date;
}

export interface DbRace {
  id: string;
  rc_race_id: string | null;
  event_id: string;
  display_number: string | null;
  stage_name: string | null;
  scheduled_start: Date | null;
  actual_start: Date | null;
  status: string;
  progression: string | null;
  display_order: number | null;
  created_at: Date;
}

export interface DbLane {
  id: string;
  race_id: string;
  entry_id: string;
  lane_number: number | null;
  place: number | null;
  time_ms: number | null;
  margin_ms: number | null;
  dnf: boolean;
  dns: boolean;
  dq: boolean;
  result_status: string | null;
  updated_at: Date;
}

/** Lane row joined with entry + club for API response building */
export interface DbLaneWithDetails extends DbLane {
  entry_name: string | null;
  club_short: string | null;
  club_id: string | null;
}

/** Race row joined with its lanes (with entry + club details) */
export interface DbRaceWithLanes extends DbRace {
  lanes: DbLaneWithDetails[];
}

export interface DbEntry {
  id: string;
  rc_entry_id: string | null;
  event_id: string;
  club_id: string | null;
  entry_name: string | null;
  bow_number: number | null;
  status: string | null;
  created_at: Date;
}

export interface DbSubscription {
  id: string;
  device_token: string;
  platform: string;
  club_id: string | null;
  athlete_id: string | null;
  regatta_id: string | null;
  notify_heat_start: boolean;
  notify_results: boolean;
  created_at: Date;
  /** Joined from subscription.athlete_name_filter (stored in athlete table or as text) */
  athlete_name_filter?: string | null;
}

// ---------------------------------------------------------------------------
// Insert / upsert input types
// ---------------------------------------------------------------------------

export interface InsertRegatta {
  rc_regatta_id: string;
  name: string;
  start_date: string; // ISO date string "YYYY-MM-DD"
  end_date: string;
  venue?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string;
}

export interface InsertEvent {
  regatta_id: string;
  rc_event_id?: string | null;
  event_number?: number | null;
  name: string;
  gender?: string | null;
  boat_class?: string | null;
  category?: string | null;
  distance_meters?: number | null;
  display_order?: number | null;
}

export interface InsertClub {
  rc_org_id?: string | null;
  name: string;
  short_name?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export interface InsertRace {
  event_id: string;
  rc_race_id?: string | null;
  display_number?: string | null;
  stage_name?: string | null;
  scheduled_start?: string | null; // ISO timestamp string
  actual_start?: string | null;
  status?: string;
  progression?: string | null;
  display_order?: number | null;
}

export interface InsertLane {
  race_id: string;
  entry_id: string;
  lane_number?: number | null;
  place?: number | null;
  time_ms?: number | null;
  margin_ms?: number | null;
  dnf?: boolean;
  dns?: boolean;
  dq?: boolean;
  result_status?: string | null;
}

export interface InsertSubscription {
  device_token: string;
  platform: string;
  regatta_id?: string | null;
  club_id?: string | null;
  athlete_id?: string | null;
  notify_heat_start?: boolean;
  notify_results?: boolean;
}

export interface InsertEntry {
  rc_entry_id?: string | null;
  event_id: string;
  club_id?: string | null;
  entry_name?: string | null;
  bow_number?: number | null;
  status?: string;
}

// ---------------------------------------------------------------------------
// Regatta queries
// ---------------------------------------------------------------------------

export async function getRegattas(): Promise<DbRegatta[]> {
  return sql<DbRegatta[]>`
    SELECT * FROM regatta ORDER BY start_date DESC
  `;
}

export async function getRegatta(id: string): Promise<DbRegatta | null> {
  const rows = await sql<DbRegatta[]>`
    SELECT * FROM regatta WHERE id = ${id}
  `;
  return rows[0] ?? null;
}

export async function getRegattaByRcId(
  rcRegattaId: string
): Promise<DbRegatta | null> {
  const rows = await sql<DbRegatta[]>`
    SELECT * FROM regatta WHERE rc_regatta_id = ${rcRegattaId}
  `;
  return rows[0] ?? null;
}

export async function upsertRegatta(data: InsertRegatta): Promise<DbRegatta> {
  const rows = await sql<DbRegatta[]>`
    INSERT INTO regatta (
      rc_regatta_id, name, start_date, end_date,
      venue, city, state, status, fetched_at
    ) VALUES (
      ${data.rc_regatta_id},
      ${data.name},
      ${data.start_date},
      ${data.end_date},
      ${data.venue ?? null},
      ${data.city ?? null},
      ${data.state ?? null},
      ${data.status ?? "upcoming"},
      now()
    )
    ON CONFLICT (rc_regatta_id) DO UPDATE SET
      name        = EXCLUDED.name,
      start_date  = EXCLUDED.start_date,
      end_date    = EXCLUDED.end_date,
      venue       = EXCLUDED.venue,
      city        = EXCLUDED.city,
      state       = EXCLUDED.state,
      status      = EXCLUDED.status,
      fetched_at  = now()
    RETURNING *
  `;
  return rows[0];
}

/** Returns rc_regatta_id values for all regattas with status='active'. */
export async function getActiveRegattaIds(): Promise<string[]> {
  const rows = await sql<{ rc_regatta_id: string }[]>`
    SELECT rc_regatta_id FROM regatta WHERE status = 'active'
  `;
  return rows.map((r) => r.rc_regatta_id);
}

// ---------------------------------------------------------------------------
// Event queries
// ---------------------------------------------------------------------------

export async function getEvents(regattaId: string): Promise<DbEvent[]> {
  return sql<DbEvent[]>`
    SELECT * FROM event
    WHERE regatta_id = ${regattaId}
    ORDER BY display_order ASC NULLS LAST, event_number ASC NULLS LAST
  `;
}

export async function upsertEvent(data: InsertEvent): Promise<DbEvent> {
  if (data.rc_event_id) {
    const rows = await sql<DbEvent[]>`
      INSERT INTO event (
        regatta_id, rc_event_id, event_number, name,
        gender, boat_class, category, distance_meters, display_order
      ) VALUES (
        ${data.regatta_id},
        ${data.rc_event_id},
        ${data.event_number ?? null},
        ${data.name},
        ${data.gender ?? null},
        ${data.boat_class ?? null},
        ${data.category ?? null},
        ${data.distance_meters ?? null},
        ${data.display_order ?? null}
      )
      ON CONFLICT (rc_event_id) DO UPDATE SET
        event_number    = EXCLUDED.event_number,
        name            = EXCLUDED.name,
        gender          = EXCLUDED.gender,
        boat_class      = EXCLUDED.boat_class,
        category        = EXCLUDED.category,
        distance_meters = EXCLUDED.distance_meters,
        display_order   = EXCLUDED.display_order
      RETURNING *
    `;
    return rows[0];
  }

  // No rc_event_id — insert without upsert key (idempotency on name+regatta_id)
  const rows = await sql<DbEvent[]>`
    INSERT INTO event (
      regatta_id, event_number, name,
      gender, boat_class, category, distance_meters, display_order
    ) VALUES (
      ${data.regatta_id},
      ${data.event_number ?? null},
      ${data.name},
      ${data.gender ?? null},
      ${data.boat_class ?? null},
      ${data.category ?? null},
      ${data.distance_meters ?? null},
      ${data.display_order ?? null}
    )
    ON CONFLICT DO NOTHING
    RETURNING *
  `;
  if (rows[0]) return rows[0];

  // Fetch the existing row if ON CONFLICT DO NOTHING returned nothing
  const existing = await sql<DbEvent[]>`
    SELECT * FROM event
    WHERE regatta_id = ${data.regatta_id} AND name = ${data.name}
    LIMIT 1
  `;
  return existing[0];
}

// ---------------------------------------------------------------------------
// Club queries
// ---------------------------------------------------------------------------

export async function getClubsForRegatta(regattaId: string): Promise<DbClub[]> {
  return sql<DbClub[]>`
    SELECT DISTINCT c.*
    FROM club c
    JOIN entry e ON e.club_id = c.id
    JOIN event ev ON ev.id = e.event_id
    WHERE ev.regatta_id = ${regattaId}
    ORDER BY c.name
  `;
}

export async function upsertClub(data: InsertClub): Promise<DbClub> {
  if (data.rc_org_id) {
    const rows = await sql<DbClub[]>`
      INSERT INTO club (rc_org_id, name, short_name, city, state, country)
      VALUES (
        ${data.rc_org_id},
        ${data.name},
        ${data.short_name ?? null},
        ${data.city ?? null},
        ${data.state ?? null},
        ${data.country ?? "USA"}
      )
      ON CONFLICT (rc_org_id) DO UPDATE SET
        name       = EXCLUDED.name,
        short_name = EXCLUDED.short_name,
        city       = EXCLUDED.city,
        state      = EXCLUDED.state,
        country    = EXCLUDED.country
      RETURNING *
    `;
    return rows[0];
  }

  // No rc_org_id — upsert on name
  const rows = await sql<DbClub[]>`
    INSERT INTO club (name, short_name, city, state, country)
    VALUES (
      ${data.name},
      ${data.short_name ?? null},
      ${data.city ?? null},
      ${data.state ?? null},
      ${data.country ?? "USA"}
    )
    ON CONFLICT DO NOTHING
    RETURNING *
  `;
  if (rows[0]) return rows[0];

  const existing = await sql<DbClub[]>`
    SELECT * FROM club WHERE name = ${data.name} LIMIT 1
  `;
  return existing[0];
}

// ---------------------------------------------------------------------------
// Race queries
// ---------------------------------------------------------------------------

export async function getRacesForRegatta(regattaId: string): Promise<DbRace[]> {
  return sql<DbRace[]>`
    SELECT r.*
    FROM race r
    JOIN event e ON e.id = r.event_id
    WHERE e.regatta_id = ${regattaId}
    ORDER BY r.scheduled_start ASC NULLS LAST, r.display_order ASC NULLS LAST
  `;
}

export async function getRacesForClub(
  regattaId: string,
  clubId: string
): Promise<DbRaceWithLanes[]> {
  // Get all races where this club has a lane entry
  const races = await sql<DbRace[]>`
    SELECT DISTINCT r.*
    FROM race r
    JOIN event e ON e.id = r.event_id
    JOIN lane l ON l.race_id = r.id
    JOIN entry en ON en.id = l.entry_id
    WHERE e.regatta_id = ${regattaId}
      AND en.club_id = ${clubId}
    ORDER BY r.scheduled_start ASC NULLS LAST, r.display_order ASC NULLS LAST
  `;

  // For each race, fetch its lanes
  const result: DbRaceWithLanes[] = [];
  for (const race of races) {
    const lanes = await getLanesWithDetails(race.id);
    result.push({ ...race, lanes });
  }
  return result;
}

export async function upsertRace(data: InsertRace): Promise<DbRace> {
  if (data.rc_race_id) {
    const rows = await sql<DbRace[]>`
      INSERT INTO race (
        event_id, rc_race_id, display_number, stage_name,
        scheduled_start, actual_start, status, progression, display_order
      ) VALUES (
        ${data.event_id},
        ${data.rc_race_id},
        ${data.display_number ?? null},
        ${data.stage_name ?? null},
        ${data.scheduled_start ?? null},
        ${data.actual_start ?? null},
        ${data.status ?? "scheduled"},
        ${data.progression ?? null},
        ${data.display_order ?? null}
      )
      ON CONFLICT (rc_race_id) DO UPDATE SET
        display_number  = EXCLUDED.display_number,
        stage_name      = EXCLUDED.stage_name,
        scheduled_start = EXCLUDED.scheduled_start,
        actual_start    = EXCLUDED.actual_start,
        status          = EXCLUDED.status,
        progression     = EXCLUDED.progression,
        display_order   = EXCLUDED.display_order
      RETURNING *
    `;
    return rows[0];
  }

  // No rc_race_id — insert without conflict key
  const rows = await sql<DbRace[]>`
    INSERT INTO race (
      event_id, display_number, stage_name,
      scheduled_start, actual_start, status, progression, display_order
    ) VALUES (
      ${data.event_id},
      ${data.display_number ?? null},
      ${data.stage_name ?? null},
      ${data.scheduled_start ?? null},
      ${data.actual_start ?? null},
      ${data.status ?? "scheduled"},
      ${data.progression ?? null},
      ${data.display_order ?? null}
    )
    RETURNING *
  `;
  return rows[0];
}

// ---------------------------------------------------------------------------
// Lane queries
// ---------------------------------------------------------------------------

export async function getLanesForRace(raceId: string): Promise<DbLane[]> {
  return sql<DbLane[]>`
    SELECT * FROM lane WHERE race_id = ${raceId}
    ORDER BY lane_number ASC NULLS LAST
  `;
}

/** Lanes joined with entry + club details for API responses */
async function getLanesWithDetails(
  raceId: string
): Promise<DbLaneWithDetails[]> {
  return sql<DbLaneWithDetails[]>`
    SELECT
      l.*,
      e.entry_name,
      c.short_name AS club_short,
      c.id         AS club_id
    FROM lane l
    JOIN entry e  ON e.id = l.entry_id
    LEFT JOIN club c ON c.id = e.club_id
    WHERE l.race_id = ${raceId}
    ORDER BY l.lane_number ASC NULLS LAST
  `;
}

/** Public alias for use from index.ts */
export async function getLanesForRaceWithDetails(
  raceId: string
): Promise<DbLaneWithDetails[]> {
  return getLanesWithDetails(raceId);
}

/** Look up a single race by its UUID */
export async function getRaceById(raceId: string): Promise<DbRace | null> {
  const rows = await sql<DbRace[]>`
    SELECT * FROM race WHERE id = ${raceId}
  `;
  return rows[0] ?? null;
}

export async function upsertLane(data: InsertLane): Promise<DbLane> {
  const rows = await sql<DbLane[]>`
    INSERT INTO lane (
      race_id, entry_id, lane_number, place, time_ms, margin_ms,
      dnf, dns, dq, result_status, updated_at
    ) VALUES (
      ${data.race_id},
      ${data.entry_id},
      ${data.lane_number ?? null},
      ${data.place ?? null},
      ${data.time_ms ?? null},
      ${data.margin_ms ?? null},
      ${data.dnf ?? false},
      ${data.dns ?? false},
      ${data.dq ?? false},
      ${data.result_status ?? null},
      now()
    )
    ON CONFLICT (race_id, lane_number) DO UPDATE SET
      place         = EXCLUDED.place,
      time_ms       = EXCLUDED.time_ms,
      margin_ms     = EXCLUDED.margin_ms,
      dnf           = EXCLUDED.dnf,
      dns           = EXCLUDED.dns,
      dq            = EXCLUDED.dq,
      result_status = EXCLUDED.result_status,
      updated_at    = now()
    RETURNING *
  `;
  return rows[0];
}

// ---------------------------------------------------------------------------
// Entry queries (used internally by the sync job)
// ---------------------------------------------------------------------------

export async function upsertEntry(data: InsertEntry): Promise<DbEntry> {
  if (data.rc_entry_id) {
    const rows = await sql<DbEntry[]>`
      INSERT INTO entry (rc_entry_id, event_id, club_id, entry_name, bow_number, status)
      VALUES (
        ${data.rc_entry_id},
        ${data.event_id},
        ${data.club_id ?? null},
        ${data.entry_name ?? null},
        ${data.bow_number ?? null},
        ${data.status ?? "entered"}
      )
      ON CONFLICT (rc_entry_id) DO UPDATE SET
        club_id    = EXCLUDED.club_id,
        entry_name = EXCLUDED.entry_name,
        bow_number = EXCLUDED.bow_number,
        status     = EXCLUDED.status
      RETURNING *
    `;
    return rows[0];
  }

  // No rc_entry_id — insert without conflict key, return existing if conflict
  const rows = await sql<DbEntry[]>`
    INSERT INTO entry (event_id, club_id, entry_name, bow_number, status)
    VALUES (
      ${data.event_id},
      ${data.club_id ?? null},
      ${data.entry_name ?? null},
      ${data.bow_number ?? null},
      ${data.status ?? "entered"}
    )
    ON CONFLICT DO NOTHING
    RETURNING *
  `;
  if (rows[0]) return rows[0];

  const existing = await sql<DbEntry[]>`
    SELECT * FROM entry
    WHERE event_id = ${data.event_id}
      AND entry_name = ${data.entry_name ?? ""}
    LIMIT 1
  `;
  return existing[0];
}

export async function getEntryForLane(
  eventId: string,
  entryName: string,
  clubId: string | null
): Promise<DbEntry | null> {
  if (clubId) {
    const rows = await sql<DbEntry[]>`
      SELECT * FROM entry
      WHERE event_id = ${eventId}
        AND entry_name = ${entryName}
        AND club_id = ${clubId}
      LIMIT 1
    `;
    if (rows[0]) return rows[0];
  }

  const rows = await sql<DbEntry[]>`
    SELECT * FROM entry
    WHERE event_id = ${eventId}
      AND entry_name = ${entryName}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Subscription queries
// ---------------------------------------------------------------------------

export async function upsertSubscription(
  data: InsertSubscription
): Promise<DbSubscription> {
  const rows = await sql<DbSubscription[]>`
    INSERT INTO subscription (
      device_token, platform, regatta_id, club_id, athlete_id,
      notify_heat_start, notify_results
    ) VALUES (
      ${data.device_token},
      ${data.platform},
      ${data.regatta_id ?? null},
      ${data.club_id ?? null},
      ${data.athlete_id ?? null},
      ${data.notify_heat_start ?? true},
      ${data.notify_results ?? true}
    )
    ON CONFLICT (device_token, regatta_id) DO UPDATE SET
      platform          = EXCLUDED.platform,
      club_id           = EXCLUDED.club_id,
      athlete_id        = EXCLUDED.athlete_id,
      notify_heat_start = EXCLUDED.notify_heat_start,
      notify_results    = EXCLUDED.notify_results
    RETURNING *
  `;
  return rows[0];
}

export async function getSubscriptionsForRegatta(
  regattaId: string
): Promise<DbSubscription[]> {
  return sql<DbSubscription[]>`
    SELECT * FROM subscription
    WHERE regatta_id = ${regattaId}
  `;
}

// ---------------------------------------------------------------------------
// Athlete search query (for GET /api/regattas/:id/athletes?q=)
// ---------------------------------------------------------------------------

export interface AthleteSearchResult {
  entry_name: string;
  club_short: string | null;
  event_name: string;
}

export async function searchAthletes(
  regattaId: string,
  query: string
): Promise<AthleteSearchResult[]> {
  const pattern = `%${query.toLowerCase()}%`;
  return sql<AthleteSearchResult[]>`
    SELECT DISTINCT
      en.entry_name,
      c.short_name AS club_short,
      ev.name      AS event_name
    FROM lane l
    JOIN entry en ON en.id = l.entry_id
    LEFT JOIN club c ON c.id = en.club_id
    JOIN race r ON r.id = l.race_id
    JOIN event ev ON ev.id = r.event_id
    WHERE ev.regatta_id = ${regattaId}
      AND lower(en.entry_name) LIKE ${pattern}
    ORDER BY en.entry_name
    LIMIT 50
  `;
}

// ---------------------------------------------------------------------------
// Results query (for GET /api/regattas/:id/results)
// ---------------------------------------------------------------------------

export interface DbRaceWithDetails extends DbRace {
  event_id: string;
  event_name: string;
  event_number: number | null;
  lanes: DbLaneWithDetails[];
}

export async function getResultsForRegatta(
  regattaId: string
): Promise<DbRaceWithDetails[]> {
  const races = await sql<
    (DbRace & { event_name: string; event_number: number | null })[]
  >`
    SELECT
      r.*,
      ev.name         AS event_name,
      ev.event_number AS event_number
    FROM race r
    JOIN event ev ON ev.id = r.event_id
    WHERE ev.regatta_id = ${regattaId}
      AND r.status IN ('official', 'unofficial')
    ORDER BY r.scheduled_start ASC NULLS LAST, r.display_order ASC NULLS LAST
  `;

  const result: DbRaceWithDetails[] = [];
  for (const race of races) {
    const lanes = await getLanesWithDetails(race.id);
    result.push({
      ...race,
      event_name: race.event_name,
      event_number: race.event_number,
      lanes,
    });
  }
  return result;
}
