/**
 * Standalone sync debugger — runs the full sync pipeline in your terminal
 * with verbose step-by-step output. No HTTP layer. Ctrl+C when it hangs
 * and you'll see exactly which step is stuck.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx src/debug-sync.ts [job_id]
 *
 * Use the Railway PUBLIC URL (not the internal one) when running from your Mac:
 *   DATABASE_URL="postgresql://postgres:xxx@mainline.proxy.rlwy.net:PORT/railway" \
 *     npx tsx src/debug-sync.ts 10115
 */

import {
  fetchRegattaOverview,
  fetchEvents,
  fetchClubs,
  fetchHeatSheet,
  closeBrowser,
} from "./syncer/rc-client.js";
import {
  upsertRegatta,
  upsertEvent,
  upsertClub,
  upsertEntry,
  upsertRace,
  upsertLane,
} from "./db/queries.js";
import { sql } from "./db/client.js";

const jobId = process.argv[2] ?? "10115";

/** Wraps a promise with a hard JS-level timeout so hung DB calls don't wait forever. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`⏱  TIMEOUT after ${ms}ms — stuck at: ${label}`)), ms)
    ),
  ]);
}

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 23)}] ${msg}`);
}

async function debugSync(jobId: string) {
  log(`Starting debug sync for job_id=${jobId}`);
  log(`DATABASE_URL: ${process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ":***@") ?? "NOT SET"}`);

  // ── 1. DB connectivity check ───────────────────────────────────────────────
  log("Step 0: testing DB connection...");
  await withTimeout(
    sql`SELECT 1 AS ping`.then(() => log("  ✅ DB connected")),
    8_000,
    "DB ping"
  );

  // ── 2. Regatta overview ────────────────────────────────────────────────────
  log("Step 1: fetchRegattaOverview...");
  const overview = await withTimeout(fetchRegattaOverview(jobId), 30_000, "fetchRegattaOverview");
  log(`  ✅ overview: ${JSON.stringify(overview)}`);

  log("Step 2: upsertRegatta...");
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
    8_000,
    "upsertRegatta"
  );
  log(`  ✅ regatta id=${regatta.id}`);

  // ── 3. Events ──────────────────────────────────────────────────────────────
  log("Step 3: fetchEvents...");
  const rcEvents = await withTimeout(fetchEvents(jobId), 30_000, "fetchEvents");
  log(`  ✅ ${rcEvents.length} events fetched`);

  log("Step 4: upserting events...");
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
      8_000,
      `upsertEvent #${rce.event_num}`
    );
    upsertedEvents.push({ id: ev.id, event_num: rce.event_num });
    if (i === 0 || (i + 1) % 10 === 0) log(`  ... ${i + 1}/${rcEvents.length}`);
  }
  log(`  ✅ ${upsertedEvents.length} events upserted`);

  // ── 4. Clubs ───────────────────────────────────────────────────────────────
  log("Step 5: fetchClubs...");
  const rcClubs = await withTimeout(fetchClubs(jobId), 30_000, "fetchClubs");
  log(`  ✅ ${rcClubs.length} clubs fetched`);

  log("Step 6: upserting clubs...");
  const clubMap = new Map<string, string>();
  for (let i = 0; i < rcClubs.length; i++) {
    const rcClub = rcClubs[i];
    const club = await withTimeout(
      upsertClub({
        rc_org_id: `${jobId}-club-${rcClub.club_id}`,
        name: rcClub.name,
        short_name: rcClub.alias || rcClub.code || null,
        city: rcClub.city ?? null,
        state: rcClub.state ?? null,
        country: rcClub.country ?? "USA",
      }),
      8_000,
      `upsertClub ${rcClub.alias}`
    );
    clubMap.set(rcClub.alias, club.id);
    clubMap.set(rcClub.code, club.id);
    if (i === 0 || (i + 1) % 25 === 0) log(`  ... ${i + 1}/${rcClubs.length}`);
  }
  log(`  ✅ ${clubMap.size / 2} clubs upserted`);

  // ── 5. Heat sheet ──────────────────────────────────────────────────────────
  const eventNumMap = new Map(upsertedEvents.map((e) => [e.event_num, e.id]));

  log("Step 7: fetchHeatSheet (this is the slow one — up to 30s)...");
  const heatSheetResult = await withTimeout(fetchHeatSheet(jobId), 60_000, "fetchHeatSheet");
  const rcHeats = heatSheetResult.heats;
  log(`  ✅ ${rcHeats.length} races fetched (pdf_urls: ${heatSheetResult.pdf_urls.length})`);
  if (rcHeats.length > 0) {
    log(`  first race: ${JSON.stringify(rcHeats[0])}`);
  }

  // ── 6. Races + lanes ──────────────────────────────────────────────────────
  log("Step 8: upserting races + lanes...");
  let racesCount = 0;
  for (let hi = 0; hi < rcHeats.length; hi++) {
    const heat = rcHeats[hi];
    const eventId = eventNumMap.get(heat.event_num);
    if (!eventId) {
      log(`  ⚠️  no eventId for event_num=${heat.event_num}, skipping`);
      continue;
    }

    const race = await withTimeout(
      upsertRace({
        event_id: eventId,
        rc_race_id: heat.race_id,
        stage_name: heat.stage,
        display_number: `${heat.event_num}${heat.stage}`,
        scheduled_start: heat.scheduled_start ?? null,
        display_order: hi + 1,
      }),
      8_000,
      `upsertRace ${heat.race_id}`
    );
    racesCount++;

    for (const rcLane of heat.lanes) {
      const clubId = clubMap.get(rcLane.club) ?? null;
      const entry = await withTimeout(
        upsertEntry({ event_id: eventId, club_id: clubId, entry_name: rcLane.entry_name }),
        8_000,
        `upsertEntry ${rcLane.entry_name}`
      );
      if (!entry) continue;
      await withTimeout(
        upsertLane({
          race_id: race.id,
          entry_id: entry.id,
          lane_number: rcLane.lane,
          time_ms: null,
        }),
        8_000,
        `upsertLane race=${race.id} lane=${rcLane.lane}`
      );
    }

    if (hi === 0 || (hi + 1) % 25 === 0) log(`  ... races ${hi + 1}/${rcHeats.length}`);
  }
  log(`  ✅ ${racesCount} races upserted`);

  // ── Done ──────────────────────────────────────────────────────────────────
  log(`✅ Sync complete: ${rcEvents.length} events, ${rcClubs.length} clubs, ${racesCount} races`);
}

debugSync(jobId)
  .catch((err) => {
    console.error("\n❌ Sync failed:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await closeBrowser().catch(() => {});
    await sql.end({ timeout: 3 }).catch(() => {});
    process.exit(0);
  });
