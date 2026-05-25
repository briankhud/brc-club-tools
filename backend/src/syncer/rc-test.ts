/**
 * Manual integration test for the RC syncer.
 * Run from the backend/ directory with:
 *   npx tsx src/syncer/rc-test.ts
 *
 * Uses CSSRA Championships 2026 (job_id=10115) as the test fixture.
 * Expected: 40 events, 131 clubs, entries show "Available" sentinel (pre-release).
 */

import {
  fetchEvents,
  fetchClubs,
  fetchClubIdMap,
  fetchEntries,
  fetchHeatSheet,
  fetchRegattaOverview,
} from "./rc-client.js";

const JOB_ID = "10115"; // CSSRA Championships 2026, St. Catharines ON

async function run() {
  console.log(`\n── RC Syncer integration test ── job_id=${JOB_ID}\n`);

  // 1. Overview
  console.log("1. Regatta overview");
  const overview = await fetchRegattaOverview(JOB_ID);
  console.log("  name:", overview.name);

  // 2. Events
  console.log("\n2. Events");
  const events = await fetchEvents(JOB_ID);
  console.log(`  count: ${events.length} (expected 40)`);
  console.log("  first:", events[0]);
  console.log("  last:", events[events.length - 1]);

  // 3. Clubs
  console.log("\n3. Clubs");
  const clubs = await fetchClubs(JOB_ID);
  console.log(`  count: ${clubs.length} (expected 131)`);
  const top = [...clubs].sort((a, b) => b.entry_count - a.entry_count)[0];
  console.log(
    `  most entries: ${top?.name} (${top?.entry_count}) (expected: E.L. Crossley S.S. / 32)`
  );

  // 4. Club ID map
  console.log("\n4. Club ID map (from entries select)");
  const clubMap = await fetchClubIdMap(JOB_ID);
  console.log(`  map size: ${clubMap.size}`);
  if (clubMap.size > 0) {
    const [firstKey, firstVal] = clubMap.entries().next().value ?? [];
    console.log(`  sample: "${firstKey}" → ${firstVal}`);
  }

  // 5. Entries
  console.log("\n5. Entries (expect 'Available' sentinel before release)");
  const entries = await fetchEntries(JOB_ID);
  console.log(`  count: ${entries.length}`);
  const available = entries.filter((e) => e.available_date);
  const populated = entries.filter((e) => !e.available_date && e.crew_members.length > 0);
  console.log(`  with available_date: ${available.length}`);
  console.log(`  with crew names: ${populated.length}`);
  if (entries[0]) console.log("  first entry:", entries[0]);

  // 6. Heat sheet (expect empty CMS → PDF fallback for upcoming regatta)
  console.log("\n6. Heat sheet");
  const hs = await fetchHeatSheet(JOB_ID);
  console.log(`  heats in HTML: ${hs.heats.length}`);
  console.log(`  PDF urls found: ${hs.pdf_urls.length}`);
  hs.pdf_urls.forEach((u) => console.log("    pdf:", u));

  console.log("\n── done ──\n");
}

run().catch(console.error);
