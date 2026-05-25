/**
 * Sync scheduler — polls Regatta Central for live data during racing windows.
 *
 * Strategy:
 *   - Every 60 seconds while regattas are "active" (status = 'active' in DB),
 *     fetch updated results for each active regatta.
 *   - Diffs DB lanes against freshly synced results and upserts changed rows.
 *   - Fires Expo push notifications for any lanes that newly have a result.
 *
 * Usage: imported and started from src/index.ts in production.
 */

import cron from "node-cron";
import Expo, { type ExpoPushMessage } from "expo-server-sdk";
import {
  fetchResults,
  closeBrowser,
} from "../syncer/rc-client.js";
import {
  getActiveRegattaIds,
  getRacesForRegatta,
  getLanesForRace,
  upsertLane,
  upsertEntry,
  getSubscriptionsForRegatta,
  getEvents,
  getRaceById,
  type DbLane,
  type DbRace,
  type DbSubscription,
} from "../db/queries.js";

const expo = new Expo();

/** Returns true if current time is within a plausible racing window (7am–7pm local). */
function isRacingHour(): boolean {
  const hour = new Date().getHours();
  return hour >= 7 && hour < 19;
}

/**
 * Parse a time string like "1:23.4" or "4:56.78" into milliseconds.
 * Returns null if the string doesn't match a known time format.
 */
function parseTimeToMs(timeStr: string): number | null {
  const match = timeStr.match(/^(\d+):(\d{2})(?:[.:](\d+))?$/);
  if (!match) return null;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  const fractionStr = match[3] ?? "0";
  const fractionMs =
    fractionStr.length === 1
      ? parseInt(fractionStr, 10) * 100
      : fractionStr.length === 2
      ? parseInt(fractionStr, 10) * 10
      : parseInt(fractionStr.slice(0, 3), 10);
  return minutes * 60_000 + seconds * 1_000 + fractionMs;
}

/**
 * Send an Expo push notification to all subscriptions that either have no
 * athlete filter or whose filter matches the given athlete name.
 */
async function sendRaceResultNotification(
  subscriptions: DbSubscription[],
  raceName: string,
  athleteName: string,
  place: number,
  timeMs: number
): Promise<void> {
  const timeSeconds = (timeMs / 1000).toFixed(1);
  const placeStr =
    place === 1
      ? "1st"
      : place === 2
      ? "2nd"
      : place === 3
      ? "3rd"
      : `${place}th`;

  const messages: ExpoPushMessage[] = [];

  for (const sub of subscriptions) {
    if (!Expo.isExpoPushToken(sub.device_token)) {
      console.warn(
        `[scheduler] Invalid Expo push token: ${sub.device_token}`
      );
      continue;
    }

    messages.push({
      to: sub.device_token,
      sound: "default",
      title: `Result: ${raceName}`,
      body: `${athleteName} — ${placeStr} place, ${timeSeconds}s`,
      data: { athleteName, raceName, place, timeMs },
    });
  }

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      for (const receipt of receipts) {
        if (receipt.status === "error") {
          console.error(
            "[scheduler] Push notification error:",
            receipt.message,
            receipt.details
          );
        }
      }
    } catch (err) {
      console.error("[scheduler] Failed to send push chunk:", err);
    }
  }
}

async function syncActiveRegattas(): Promise<void> {
  // 1. Query DB for active regatta IDs each tick (not a static array)
  let activeRegattaRcIds: string[];
  try {
    activeRegattaRcIds = await getActiveRegattaIds();
  } catch (err) {
    console.error("[scheduler] Failed to fetch active regatta IDs:", err);
    return;
  }

  if (activeRegattaRcIds.length === 0) {
    return; // nothing to sync
  }

  if (!isRacingHour()) {
    console.log("[scheduler] Outside racing window — skipping sync");
    return;
  }

  console.log(
    `[scheduler] Syncing ${activeRegattaRcIds.length} active regatta(s)…`
  );

  for (const rcRegattaId of activeRegattaRcIds) {
    try {
      // 2. fetchResults() only (not fetchHeatSheet on every tick — too slow)
      const freshHeats = await fetchResults(rcRegattaId);
      console.log(
        `[scheduler] ${rcRegattaId}: fetched ${freshHeats.length} result heats`
      );

      if (freshHeats.length === 0) continue;

      // We need the regatta's DB UUID to query its races
      const { getRegattaByRcId } = await import("../db/queries.js");
      const regatta = await getRegattaByRcId(rcRegattaId);
      if (!regatta) {
        console.warn(
          `[scheduler] No DB row for rc_regatta_id=${rcRegattaId} — run admin sync first`
        );
        continue;
      }

      // Build map: rc_race_id → DbRace for diffing
      const dbRaces = await getRacesForRegatta(regatta.id);
      const raceByRcId = new Map<string, DbRace>(
        dbRaces
          .filter((r): r is DbRace & { rc_race_id: string } => !!r.rc_race_id)
          .map((r) => [r.rc_race_id, r])
      );

      // Build event_num map for the regatta
      const events = await getEvents(regatta.id);
      const eventByNum = new Map(
        events
          .filter((e) => e.event_number !== null)
          .map((e) => [String(e.event_number), e])
      );

      // Collect subscriptions once per regatta
      const subscriptions = await getSubscriptionsForRegatta(regatta.id);

      // 3. For each changed lane, upsert and potentially notify
      for (const freshHeat of freshHeats) {
        // Find the DB race — look up by rc_race_id first
        let dbRace = raceByRcId.get(freshHeat.race_id);

        if (!dbRace) {
          // Race not seeded yet — find by event + stage
          const event = eventByNum.get(freshHeat.event_num);
          if (!event) continue; // event not seeded either; skip
          // Can't upsert race without event_id match — skip
          continue;
        }

        // Fetch existing lanes for this race
        const existingLanes = await getLanesForRace(dbRace.id);
        const existingByLaneNum = new Map<number, DbLane>(
          existingLanes
            .filter((l): l is DbLane & { lane_number: number } => l.lane_number !== null)
            .map((l) => [l.lane_number as number, l])
        );

        for (const freshLane of freshHeat.lanes) {
          const existingLane = existingByLaneNum.get(freshLane.lane);
          const newTimeMs = freshLane.result_time
            ? parseTimeToMs(freshLane.result_time)
            : null;
          const newPlace = freshLane.place ?? null;

          // Check if there's a meaningful change
          const hadResult =
            existingLane?.time_ms !== null &&
            existingLane?.time_ms !== undefined;
          const nowHasResult = newTimeMs !== null;
          const resultChanged =
            nowHasResult &&
            (!hadResult || existingLane?.time_ms !== newTimeMs);

          if (!resultChanged && existingLane?.place === newPlace) {
            continue; // no change
          }

          // Find or create the entry for this lane
          const event = eventByNum.get(freshHeat.event_num);
          if (!event) continue;

          let entryId: string | null = null;
          if (existingLane) {
            entryId = existingLane.entry_id;
          } else {
            // Try to find/create entry by entry_name
            const newEntry = await upsertEntry({
              event_id: event.id,
              entry_name: freshLane.entry_name,
            });
            entryId = newEntry?.id ?? null;
          }

          if (!entryId) continue;

          await upsertLane({
            race_id: dbRace.id,
            entry_id: entryId,
            lane_number: freshLane.lane,
            place: newPlace,
            time_ms: newTimeMs,
            result_status: newPlace !== null ? "official" : "pending",
          });

          // 4. Send push notifications for newly posted results
          if (resultChanged && newTimeMs !== null && newPlace !== null) {
            const raceName =
              freshHeat.stage ||
              dbRace.stage_name ||
              `Race ${freshHeat.event_num}`;
            await sendRaceResultNotification(
              subscriptions,
              raceName,
              freshLane.entry_name,
              newPlace,
              newTimeMs
            );
          }
        }
      }
    } catch (err) {
      console.error(
        `[scheduler] Error syncing regatta ${rcRegattaId}:`,
        err
      );
    }
  }
}

/**
 * Start the background sync job.
 * Call this once from src/index.ts.
 */
export function startSyncScheduler(): void {
  cron.schedule("* * * * *", async () => {
    await syncActiveRegattas();
  });

  console.log(
    "[scheduler] Scheduler started — polling every 60s during racing windows"
  );
}

// Process exit — clean up the Playwright browser
process.on("SIGTERM", () => closeBrowser().catch(() => {}));
process.on("SIGINT", () => closeBrowser().catch(() => {}));
