/**
 * Scrape scheduler — polls Regatta Central for live data during racing windows.
 *
 * Strategy:
 *   - Every 60 seconds while a regatta is "active" (status = 'active'), fetch
 *     updated heat sheets and results for all active regattas.
 *   - Outside of racing windows (nights, off-season), the job still runs but
 *     skips the expensive scrape after a staleness check.
 *
 * Usage: imported and started from src/index.ts in production.
 */

import cron from "node-cron";
import { fetchHeatSheet, fetchResults } from "../scraper/rc-client.js";

// In a real implementation this would query the DB for active regattas.
// Stubbed here with an in-memory list.
const ACTIVE_REGATTA_IDS: string[] = [];

/** Returns true if current time is within a plausible racing window (7am–7pm local). */
function isRacingHour(): boolean {
  const hour = new Date().getHours();
  return hour >= 7 && hour < 19;
}

async function scrapeActiveRegattas(): Promise<void> {
  if (ACTIVE_REGATTA_IDS.length === 0) {
    return; // nothing to scrape
  }

  if (!isRacingHour()) {
    console.log("[scraper] Outside racing window — skipping scrape");
    return;
  }

  console.log(
    `[scraper] Scraping ${ACTIVE_REGATTA_IDS.length} active regatta(s)…`
  );

  for (const regattaId of ACTIVE_REGATTA_IDS) {
    try {
      const heats = await fetchHeatSheet(regattaId);
      console.log(`[scraper] ${regattaId}: fetched ${heats.length} heats`);

      await fetchResults(regattaId);

      // TODO: diff fetched data against DB, persist changes, and fire push
      //       notifications for any lane results that are newly posted.
    } catch (err) {
      console.error(`[scraper] Error scraping regatta ${regattaId}:`, err);
    }
  }
}

/**
 * Start the background scrape job.
 * Call this once from src/index.ts.
 */
export function startScrapeScheduler(): void {
  // Run every 60 seconds
  cron.schedule("* * * * *", async () => {
    await scrapeActiveRegattas();
  });

  console.log("[scraper] Scheduler started — polling every 60s during racing windows");
}

/**
 * Dynamically add a regatta to the active poll list.
 * Call this when a regatta transitions to status='active'.
 */
export function activateRegatta(regattaId: string): void {
  if (!ACTIVE_REGATTA_IDS.includes(regattaId)) {
    ACTIVE_REGATTA_IDS.push(regattaId);
    console.log(`[scraper] Now tracking regatta ${regattaId}`);
  }
}

/**
 * Remove a regatta from the active poll list.
 * Call this when a regatta transitions to status='completed'.
 */
export function deactivateRegatta(regattaId: string): void {
  const idx = ACTIVE_REGATTA_IDS.indexOf(regattaId);
  if (idx !== -1) {
    ACTIVE_REGATTA_IDS.splice(idx, 1);
    console.log(`[scraper] Stopped tracking regatta ${regattaId}`);
  }
}
