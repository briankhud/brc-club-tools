import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
  getRegattas,
  getRegatta,
  getRegattaByRcId,
  upsertRegatta,
  getEvents,
  upsertEvent,
  getClubsForRegatta,
  upsertClub,
  upsertEntry,
  getRacesForClub,
  getRaceById,
  upsertRace,
  upsertLane,
  getLanesForRaceWithDetails,
  upsertSubscription,
  searchAthletes,
  getResultsForRegatta,
  type DbRegatta,
  type DbEvent,
  type DbClub,
  type DbRace,
  type DbLaneWithDetails,
} from "./db/queries.js";
import {
  fetchRegattaOverview,
  fetchEvents,
  fetchClubs,
  fetchHeatSheet,
  closeBrowser,
  type RCHeat,
} from "./syncer/rc-client.js";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

// ---------------------------------------------------------------------------
// Shape mappers — convert DB rows to API response objects matching app/services/api.ts
// ---------------------------------------------------------------------------

function mapRegatta(r: DbRegatta) {
  return {
    id: r.id,
    rc_regatta_id: r.rc_regatta_id,
    name: r.name,
    short_name: null as string | null,
    start_date:
      r.start_date instanceof Date
        ? r.start_date.toISOString().slice(0, 10)
        : String(r.start_date),
    end_date:
      r.end_date instanceof Date
        ? r.end_date.toISOString().slice(0, 10)
        : String(r.end_date),
    venue: r.venue ?? null,
    city: r.city ?? "",
    state: r.state ?? "",
    status: r.status,
    description: null as string | null,
    event_count: null as number | null,
  };
}

function mapEvent(e: DbEvent) {
  return {
    id: e.id,
    rc_event_id: e.rc_event_id ?? undefined,
    regatta_id: e.regatta_id,
    event_number: e.event_number ?? 0,
    name: e.name,
    gender: e.gender ?? "",
    boat_class: e.boat_class ?? "",
    category: e.category ?? "",
    distance_meters: e.distance_meters ?? 0,
    display_order: e.display_order ?? 0,
  };
}

function mapClub(c: DbClub) {
  return {
    id: c.id,
    rc_org_id: c.rc_org_id ?? undefined,
    name: c.name,
    short_name: c.short_name ?? c.name,
    city: c.city ?? "",
    state: c.state ?? "",
  };
}

function mapLane(l: DbLaneWithDetails) {
  return {
    id: l.id,
    lane_number: l.lane_number ?? 0,
    entry_name: l.entry_name ?? "",
    club_short: l.club_short ?? "",
    athlete_id: null as string | null,
    seed_time_ms: null as number | null,
    place: l.place ?? null,
    time_ms: l.time_ms ?? null,
    dnf: l.dnf,
    dns: l.dns,
    dq: l.dq,
  };
}

function mapRace(r: DbRace, lanes: DbLaneWithDetails[]) {
  return {
    id: r.id,
    rc_race_id: r.rc_race_id ?? "",
    event_id: r.event_id,
    display_number: r.display_number ?? "",
    stage_name: r.stage_name ?? "",
    scheduled_start:
      r.scheduled_start instanceof Date
        ? r.scheduled_start.toISOString()
        : (r.scheduled_start ?? ""),
    actual_start:
      r.actual_start instanceof Date
        ? r.actual_start.toISOString()
        : (r.actual_start ?? null),
    status: r.status,
    progression: r.progression ?? "",
    display_order: r.display_order ?? 0,
    lanes: lanes.map(mapLane),
  };
}

// ---------------------------------------------------------------------------
// In-memory sync status tracker (fine for single-instance MVP)
// ---------------------------------------------------------------------------

const syncStatus = new Map<
  string,
  { status: "running" | "done" | "error"; message: string; started: string }
>();

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  });
});

// List all regattas
app.get("/api/regattas", async (c) => {
  try {
    const regattas = await getRegattas();
    return c.json({ regattas: regattas.map(mapRegatta) });
  } catch (err) {
    console.error("GET /api/regattas:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get single regatta with its events
app.get("/api/regattas/:id", async (c) => {
  const { id } = c.req.param();
  try {
    const regatta = await getRegatta(id);
    if (!regatta) {
      return c.json({ error: "Regatta not found" }, 404);
    }
    const events = await getEvents(id);
    return c.json({ regatta: mapRegatta(regatta), events: events.map(mapEvent) });
  } catch (err) {
    console.error(`GET /api/regattas/${id}:`, err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// List clubs entered in a regatta
app.get("/api/regattas/:id/clubs", async (c) => {
  const { id } = c.req.param();
  try {
    const regatta = await getRegatta(id);
    if (!regatta) {
      return c.json({ error: "Regatta not found" }, 404);
    }
    const clubs = await getClubsForRegatta(id);
    return c.json({ regatta_id: id, clubs: clubs.map(mapClub) });
  } catch (err) {
    console.error(`GET /api/regattas/${id}/clubs:`, err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get a club's full heat schedule for a regatta
app.get("/api/regattas/:id/club/:clubId/schedule", async (c) => {
  const { id, clubId } = c.req.param();
  try {
    const regatta = await getRegatta(id);
    if (!regatta) {
      return c.json({ error: "Regatta not found" }, 404);
    }

    // Find the club
    const clubs = await getClubsForRegatta(id);
    const club = clubs.find((cl) => cl.id === clubId);
    if (!club) {
      return c.json({ error: "Club not found" }, 404);
    }

    // Get all races for this club with lanes
    const racesWithLanes = await getRacesForClub(id, clubId);

    // Get all events for this regatta (for the event lookup)
    const events = await getEvents(id);
    const eventMap = new Map(events.map((e) => [e.id, e]));

    // Build ScheduleItem[] — group by race, filter to this club's lanes
    const schedule = racesWithLanes
      .map((race) => {
        const event = eventMap.get(race.event_id);
        if (!event) return null;

        // Filter to just this club's lanes for club_lanes
        const clubLanes = race.lanes.filter((l) => l.club_id === clubId);

        return {
          event: mapEvent(event),
          heat: mapRace(race, race.lanes),
          club_lanes: clubLanes.map(mapLane),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return c.json({ regatta_id: id, club: mapClub(club), schedule });
  } catch (err) {
    console.error(`GET /api/regattas/${id}/club/${clubId}/schedule:`, err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get heat sheet for a specific race
app.get("/api/regattas/:id/event/:eventId/heat/:heatId", async (c) => {
  const { id, eventId, heatId } = c.req.param();
  try {
    const regatta = await getRegatta(id);
    if (!regatta) {
      return c.json({ error: "Regatta not found" }, 404);
    }
    const events = await getEvents(id);
    const event = events.find((e) => e.id === eventId);
    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    const race = await getRaceById(heatId);
    if (!race) {
      return c.json({ error: "Heat not found" }, 404);
    }

    const lanes = await getLanesForRaceWithDetails(heatId);

    return c.json({
      regatta: mapRegatta(regatta),
      event: mapEvent(event),
      heat: mapRace(race, lanes),
    });
  } catch (err) {
    console.error(
      `GET /api/regattas/${id}/event/${eventId}/heat/${heatId}:`,
      err
    );
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ---------------------------------------------------------------------------
// New endpoints
// ---------------------------------------------------------------------------

// GET /api/regattas/:id/results
app.get("/api/regattas/:id/results", async (c) => {
  const { id } = c.req.param();
  try {
    const regatta = await getRegatta(id);
    if (!regatta) {
      return c.json({ error: "Regatta not found" }, 404);
    }

    const events = await getEvents(id);
    const eventMap = new Map(events.map((e) => [e.id, e]));

    const raceResults = await getResultsForRegatta(id);

    const results = raceResults
      .map((race) => {
        const event = eventMap.get(race.event_id);
        if (!event) return null;
        return {
          event: mapEvent(event),
          race: mapRace(race, race.lanes),
          lanes: race.lanes.map(mapLane),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return c.json({ regatta_id: id, results });
  } catch (err) {
    console.error(`GET /api/regattas/${id}/results:`, err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/regattas/:id/athletes?q=searchTerm
app.get("/api/regattas/:id/athletes", async (c) => {
  const { id } = c.req.param();
  const q = c.req.query("q") ?? "";
  try {
    const regatta = await getRegatta(id);
    if (!regatta) {
      return c.json({ error: "Regatta not found" }, 404);
    }
    if (q.length < 2) {
      return c.json({ athletes: [] });
    }
    const athletes = await searchAthletes(id, q);
    return c.json({ athletes });
  } catch (err) {
    console.error(`GET /api/regattas/${id}/athletes:`, err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/subscriptions
app.post("/api/subscriptions", async (c) => {
  try {
    const body = await c.req.json<{
      device_token: string;
      platform: "ios" | "android";
      regatta_id?: string;
      athlete_name?: string;
    }>();

    if (!body.device_token || !body.platform) {
      return c.json({ error: "device_token and platform are required" }, 400);
    }

    // If a regatta_id string was provided, resolve it to the UUID
    let regattaUuid: string | null = null;
    if (body.regatta_id) {
      // Try direct UUID lookup first, then rc_regatta_id
      const byUuid = await getRegatta(body.regatta_id).catch(() => null);
      if (byUuid) {
        regattaUuid = byUuid.id;
      } else {
        const byRcId = await getRegattaByRcId(body.regatta_id);
        regattaUuid = byRcId?.id ?? null;
      }
    }

    const sub = await upsertSubscription({
      device_token: body.device_token,
      platform: body.platform,
      regatta_id: regattaUuid,
    });

    return c.json({ id: sub.id });
  } catch (err) {
    console.error("POST /api/subscriptions:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/admin/sync  [requires X-Admin-Secret header]
// Returns 202 immediately; actual sync runs in the background.
app.post("/api/admin/sync", async (c) => {
  const adminSecret = process.env.ADMIN_SECRET;
  const provided = c.req.header("X-Admin-Secret");

  if (!adminSecret || provided !== adminSecret) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let jobId: string | undefined;
  try {
    const body = await c.req.json<{ job_id?: string }>();
    jobId = body.job_id ?? c.req.query("job_id");
  } catch {
    jobId = c.req.query("job_id");
  }

  if (!jobId) {
    return c.json({ error: "job_id is required" }, 400);
  }

  // Mark as running and kick off background sync
  syncStatus.set(jobId, {
    status: "running",
    message: "Sync in progress",
    started: new Date().toISOString(),
  });

  // Fire-and-forget — do not await
  runSyncInBackground(jobId);

  return c.json(
    { message: `Sync started for job_id ${jobId}`, job_id: jobId },
    202
  );
});

// GET /api/admin/sync/:jobId  — poll sync status
app.get("/api/admin/sync/:jobId", (c) => {
  const adminSecret = process.env.ADMIN_SECRET;
  const provided = c.req.header("X-Admin-Secret");

  if (!adminSecret || provided !== adminSecret) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { jobId } = c.req.param();
  const entry = syncStatus.get(jobId);
  if (!entry) {
    return c.json({ error: "No sync found for that job_id" }, 404);
  }
  return c.json({ job_id: jobId, ...entry });
});

/** JS-level timeout — works regardless of DB proxy config. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`DB timeout after ${ms}ms at: ${label}`)),
        ms
      )
    ),
  ]);
}

// Background sync worker
async function runSyncInBackground(jobId: string): Promise<void> {
  /** Update both the console and the in-memory status map atomically. */
  const step = (msg: string) => {
    console.log(`[syncer] job_id=${jobId} — ${msg}`);
    syncStatus.set(jobId, {
      status: "running",
      message: msg,
      started: syncStatus.get(jobId)?.started ?? new Date().toISOString(),
    });
  };

  const DB_TIMEOUT = 12_000; // 12s JS-level timeout per DB call

  try {
    // 1. Fetch regatta overview + upsert
    step("fetching regatta overview");
    const overview = await fetchRegattaOverview(jobId);
    step("upserting regatta");
    const regatta = await withTimeout(
      upsertRegatta({
        rc_regatta_id: jobId,
        name: overview.name ?? `Regatta ${jobId}`,
        start_date: overview.start_date ?? new Date().toISOString().slice(0, 10),
        end_date: overview.end_date ?? new Date().toISOString().slice(0, 10),
        venue: overview.venue ?? null,
        city: overview.city ?? null,
        state: overview.state ?? null,
        status: "upcoming",
      }),
      DB_TIMEOUT, "upsertRegatta"
    );

    // 2. Fetch + upsert events
    step("fetching events");
    const rcEvents = await fetchEvents(jobId);
    step(`upserting ${rcEvents.length} events`);
    const upsertedEvents: Array<{ id: string; event_num: string }> = [];
    for (let i = 0; i < rcEvents.length; i++) {
      const rce = rcEvents[i];
      const ev = await withTimeout(
        upsertEvent({
          regatta_id: regatta.id,
          rc_event_id: `${jobId}-event-${rce.event_num}`,
          event_number: parseInt(rce.event_num, 10) || null,
          name: rce.name,
          display_order: i + 1,
        }),
        DB_TIMEOUT, `upsertEvent #${rce.event_num}`
      );
      upsertedEvents.push({ id: ev.id, event_num: rce.event_num });
    }

    // 3. Fetch + upsert clubs
    step("fetching clubs");
    const rcClubs = await fetchClubs(jobId);
    step(`upserting ${rcClubs.length} clubs`);
    const clubMap = new Map<string, string>(); // alias → DB id
    for (const rcClub of rcClubs) {
      const club = await withTimeout(
        upsertClub({
          rc_org_id: `${jobId}-club-${rcClub.club_id}`,
          name: rcClub.name,
          short_name: rcClub.alias || rcClub.code || null,
          city: rcClub.city ?? null,
          state: rcClub.state ?? null,
          country: rcClub.country ?? "USA",
        }),
        DB_TIMEOUT, `upsertClub ${rcClub.alias}`
      );
      clubMap.set(rcClub.alias, club.id);
      clubMap.set(rcClub.code, club.id);
    }

    // Build event_num → event DB id map
    const eventNumMap = new Map(upsertedEvents.map((e) => [e.event_num, e.id]));

    // 4. Fetch heat sheet → upsert races + lanes
    step("fetching heat sheet");
    const heatSheetResult = await fetchHeatSheet(jobId);
    const rcHeats: RCHeat[] = heatSheetResult.heats;
    step(`upserting ${rcHeats.length} races`);

    let racesCount = 0;
    for (let hi = 0; hi < rcHeats.length; hi++) {
      const heat = rcHeats[hi];
      const eventId = eventNumMap.get(heat.event_num);
      if (!eventId) continue;

      const race = await withTimeout(
        upsertRace({
          event_id: eventId,
          rc_race_id: heat.race_id,
          stage_name: heat.stage,
          display_number: `${heat.event_num}${heat.stage}`,
          scheduled_start: heat.scheduled_start ?? null,
          display_order: hi + 1,
        }),
        DB_TIMEOUT, `upsertRace ${heat.race_id}`
      );
      racesCount++;

      if (hi % 25 === 0) step(`upserting races (${hi}/${rcHeats.length})`);

      for (const rcLane of heat.lanes) {
        const clubId = clubMap.get(rcLane.club) ?? null;
        const entry = await withTimeout(
          upsertEntry({
            event_id: eventId,
            club_id: clubId,
            entry_name: rcLane.entry_name,
          }),
          DB_TIMEOUT, `upsertEntry ${rcLane.entry_name}`
        );
        if (!entry) continue;

        await withTimeout(
          upsertLane({
            race_id: race.id,
            entry_id: entry.id,
            lane_number: rcLane.lane,
            time_ms: rcLane.seed_time ? parseTimeToMs(rcLane.seed_time) : null,
          }),
          DB_TIMEOUT, `upsertLane ${race.id}/${rcLane.lane}`
        );
      }
    }

    step("closing browser");
    await closeBrowser();

    const summary = `Synced ${rcEvents.length} events, ${rcClubs.length} clubs, ${racesCount} races`;
    console.log(`[syncer] Sync complete for job_id=${jobId}: ${summary}`);
    syncStatus.set(jobId, {
      status: "done",
      message: summary,
      started: syncStatus.get(jobId)?.started ?? new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[syncer] Background sync failed (job_id=${jobId}):`, err);
    await closeBrowser().catch(() => {});
    syncStatus.set(jobId, {
      status: "error",
      message: err instanceof Error ? err.message : "Sync failed",
      started: syncStatus.get(jobId)?.started ?? new Date().toISOString(),
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a time string like "1:23.4" or "4:56.78" into milliseconds.
 */
function parseTimeToMs(timeStr: string): number | null {
  const match = timeStr.match(/^(\d+):(\d{2})(?:[.:](\d+))?$/);
  if (!match) return null;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  const fractionStr = match[3] ?? "0";
  // Normalise fraction to milliseconds (2 digits = centiseconds, 1 digit = tenths)
  const fractionMs =
    fractionStr.length === 1
      ? parseInt(fractionStr, 10) * 100
      : fractionStr.length === 2
      ? parseInt(fractionStr, 10) * 10
      : parseInt(fractionStr.slice(0, 3), 10);
  return minutes * 60_000 + seconds * 1_000 + fractionMs;
}

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? "3000", 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`RowDay backend running on http://localhost:${info.port}`);
});

export default app;
