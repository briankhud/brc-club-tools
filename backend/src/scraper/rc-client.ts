/**
 * Regatta Central HTML scraper
 *
 * RC does not publish a public API. The v3 API (api.regattacentral.com/v3.0)
 * is decommissioned — all endpoints 404. The v4 API is OAuth-gated.
 *
 * Instead we scrape the server-rendered HTML pages on www.regattacentral.com
 * using Cheerio. No headless browser is needed — all data pages are plain HTML
 * tables that can be fetched with a browser User-Agent and parsed directly.
 *
 * Legal basis: scraping publicly accessible pages is not unauthorized access
 * under the CFAA per hiQ Labs v. LinkedIn (9th Cir. 2022). We only read data
 * that any parent can view in a browser without logging in.
 *
 * Working endpoints (all take job_id query param):
 *   Overview:  /regatta/?job_id={id}
 *   Events:    /regatta/events?job_id={id}&org_id=0
 *   Clubs:     /regatta/clubs?job_id={id}&org_id=0
 *   Entries:   /regatta/entries?job_id={id}&org_id=0
 *   Results:   /regatta/results.jsp?job_id={id}&org_id=0
 *
 * Heat sheets: /v3/cms/regatta/{id}/heat_sheet is often EMPTY — the real heat
 * sheet is typically a PDF linked from the overview page. We try HTML first and
 * fall back to returning PDF URLs for the caller to download and parse.
 *
 * Test fixture: job_id=10115 (CSSRA Championships 2026, St. Catharines ON)
 *   - 676 entries, 131 clubs, 40 events, 194 races over 3 days
 *
 * See ./rc-scraping-notes.md for detailed DOM observations.
 */

import * as cheerio from "cheerio";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { parseRcSchedulePdf } from "./rc-pdf-parser.js";

const RC_BASE = "https://www.regattacentral.com";

/** Minimum delay between requests (ms). Be polite. */
const REQUEST_DELAY_MS = Number(process.env.RC_REQUEST_DELAY_MS ?? 600);

/** Browser-like headers for direct HTTPS fetches (e.g. PDF downloads). */
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/pdf,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.regattacentral.com/",
};

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface RCRegatta {
  job_id: string;
  name: string;
  start_date: string;
  end_date: string;
  venue?: string;
  city?: string;
  state?: string;
  country?: string;
  type?: string;
}

export interface RCEvent {
  event_num: string;
  code: string;
  name: string;
  /** ISO date-time of the final if listed, otherwise undefined */
  final_time?: string;
}

export interface RCClub {
  club_id: string;
  name: string;
  alias: string;
  code: string;
  entry_count: number;
  city?: string;
  state?: string;
  country?: string;
}

export interface RCEntry {
  event_num: string;
  event_name: string;
  club_name: string;
  club_code: string;
  crew_members: string[];
  /** "Available {date}" sentinel when not yet released */
  available_date?: string;
}

export interface RCLane {
  lane: number;
  entry_name: string;
  club: string;
  seed_time?: string;
  result_time?: string;
  place?: number;
}

export interface RCHeat {
  race_id: string;
  event_num: string;
  event_name: string;
  stage: string;
  heat_num: number;
  scheduled_start?: string;
  lanes: RCLane[];
}

export interface RCHeatSheetResult {
  heats: RCHeat[];
  /** PDF URL(s) from the overview page if the HTML heat-sheet was empty */
  pdf_urls: string[];
}

// ---------------------------------------------------------------------------
// Browser singleton — one Chromium process shared across all scrapes
// ---------------------------------------------------------------------------

let _browser: Browser | null = null;
let _context: BrowserContext | null = null;
let _lastRequestTime = 0;

/**
 * Returns a shared Playwright browser context.  The context is created once
 * and reused so we don't pay the Chromium launch cost per request.  Call
 * closeBrowser() when the process is shutting down.
 */
async function getBrowserContext(): Promise<BrowserContext> {
  if (!_context) {
    _browser = await chromium.launch({
      headless: true,
      // Stealth: don't load images or fonts — faster page loads
      args: ["--disable-blink-features=AutomationControlled"],
    });
    _context = await _browser.newContext({
      // Mimic a MacBook running Chrome — real UA, real viewport, real locale
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
      timezoneId: "America/New_York",
      // Block images/fonts so we load faster — we only need HTML
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.regattacentral.com/regattas",
      },
    });

    // Block image/font/media requests — not needed for HTML scraping
    await _context.route(
      /\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|mp4|webm)(\?.*)?$/i,
      (route) => route.abort()
    );
  }
  return _context;
}

/** Gracefully shut down the shared browser. Call on process exit. */
export async function closeBrowser(): Promise<void> {
  await _context?.close();
  await _browser?.close();
  _context = null;
  _browser = null;
}

/**
 * Fetch a URL via the headless Chromium browser and return the page's HTML.
 * Uses a shared browser context to avoid relaunching Chromium on every call.
 * Adds polite delays between requests.
 */
async function politeGet(url: string): Promise<string> {
  // Polite delay
  const now = Date.now();
  const wait = REQUEST_DELAY_MS - (now - _lastRequestTime);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  const ctx = await getBrowserContext();
  const page = await ctx.newPage();
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    _lastRequestTime = Date.now();

    if (!response) throw new Error(`No response from ${url}`);
    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()} fetching ${url}`);
    }
    return await page.content();
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Public scraping functions
// ---------------------------------------------------------------------------

/**
 * Fetch a list of upcoming regattas (Canadian + US by default).
 *
 * Scrapes the /regattas listing page with server-side filters for country.
 * Pass `country="CA"` for Canada-only, `"US"` for US-only, or omit for both.
 *
 * For past regattas (with populated heat sheets and results), append `?results`
 * to the URL — useful for test fixture development.
 */
export async function fetchRegattaList(country?: "CA" | "US"): Promise<RCRegatta[]> {
  const base = `${RC_BASE}/regattas`;
  const url = country ? `${base}?country=${country}` : base;

  let html: string;
  try {
    html = await politeGet(url);
  } catch (err) {
    console.error("fetchRegattaList: fetch failed", err);
    return [];
  }

  const $ = cheerio.load(html);
  const regattas: RCRegatta[] = [];

  // The regatta listing uses a <table> where each data row links to the regatta
  // via href="/regatta/?job_id=NNNNN". We extract job_id from those links.
  $("table tr").each((_i, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return; // header / footer rows

    const link = $(cells[0]).find("a[href*='job_id=']");
    if (!link.length) return;

    const href = link.attr("href") ?? "";
    const jobIdMatch = href.match(/job_id=(\d+)/);
    if (!jobIdMatch) return;

    const job_id = jobIdMatch[1];
    const name = link.text().trim();

    // Date range is typically in the second or third cell
    const dateText = $(cells[1]).text().trim() || $(cells[2]).text().trim();

    regattas.push({
      job_id,
      name,
      start_date: dateText, // raw string — caller can parse as needed
      end_date: dateText,
    });
  });

  return regattas;
}

/**
 * Fetch regatta overview info (dates, venue, host, entry counts).
 * Returns a partial RCRegatta populated from the overview page.
 */
export async function fetchRegattaOverview(jobId: string): Promise<Partial<RCRegatta>> {
  const url = `${RC_BASE}/regatta/?job_id=${jobId}`;
  let html: string;
  try {
    html = await politeGet(url);
  } catch (err) {
    console.error(`fetchRegattaOverview(${jobId}): fetch failed`, err);
    return {};
  }

  const $ = cheerio.load(html);

  // Extract title from <h1> or <title>
  const name =
    $("h1").first().text().trim() ||
    $("title").text().replace("RegattaCentral", "").replace(/[-|]/, "").trim();

  return { job_id: jobId, name };
}

/**
 * Fetch all events for a regatta.
 * Returns event number, code, name, and optional final time.
 *
 * DOM structure (/regatta/events?job_id=ID&org_id=0):
 *   table tr
 *     Day header row: single td with text "Sunday, June 7, 2026"
 *     Data row: 4 td → event#, final-time, boat-class code, event name
 *
 * Skip day-header rows by filtering for cells.length===4 && /^\d+/.test(cells[0]).
 */
export async function fetchEvents(jobId: string): Promise<RCEvent[]> {
  const url = `${RC_BASE}/regatta/events?job_id=${jobId}&org_id=0`;
  let html: string;
  try {
    html = await politeGet(url);
  } catch (err) {
    console.error(`fetchEvents(${jobId}): fetch failed`, err);
    return [];
  }

  const $ = cheerio.load(html);
  const events: RCEvent[] = [];

  $("table tr").each((_i, row) => {
    const cells = $(row).find("td");
    if (cells.length !== 4) return; // skip day-header rows (1 cell) and others

    const eventNum = $(cells[0]).text().trim();
    if (!/^\d+$/.test(eventNum)) return; // skip non-data rows

    const finalTime = $(cells[1]).text().trim() || undefined;
    const code = $(cells[2]).text().trim();
    const name = $(cells[3]).text().trim();

    events.push({ event_num: eventNum, code, name, final_time: finalTime });
  });

  return events;
}

/**
 * Fetch all clubs participating in a regatta.
 *
 * DOM structure (/regatta/clubs?job_id=ID&org_id=0):
 *   table tr
 *     td[0] = blade image (empty text)
 *     td[1] = full club name
 *     td[2] = "<alias>\n   <CODE>"  ← split on \n, trim each part
 *     td[3] = entry count (integer string)
 *     td[4] = "City, ST/Prov"
 *     td[5] = country code (CAN/USA)
 *
 * Filter for cells.length===6 to skip the 2-cell footer row.
 *
 * club_id is available in the club-filter <select> on the entries page;
 * here we return a slug derived from the alias as a stable key.
 */
export async function fetchClubs(jobId: string): Promise<RCClub[]> {
  const url = `${RC_BASE}/regatta/clubs?job_id=${jobId}&org_id=0`;
  let html: string;
  try {
    html = await politeGet(url);
  } catch (err) {
    console.error(`fetchClubs(${jobId}): fetch failed`, err);
    return [];
  }

  const $ = cheerio.load(html);
  const clubs: RCClub[] = [];

  $("table tr").each((_i, row) => {
    const cells = $(row).find("td");
    if (cells.length !== 6) return; // footer row has 2 cells; header has th not td

    const name = $(cells[1]).text().trim();
    if (!name) return;

    // td[2] = "alias\n   CODE"
    const aliasRaw = $(cells[2]).text();
    const [aliasPart, codePart] = aliasRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const alias = aliasPart ?? "";
    const code = codePart ?? "";

    const entryCountRaw = $(cells[3]).text().trim();
    const entry_count = parseInt(entryCountRaw, 10) || 0;

    const location = $(cells[4]).text().trim();
    const [city, stateOrProv] = location.split(",").map((s) => s.trim());

    const country = $(cells[5]).text().trim();

    clubs.push({
      club_id: alias.toLowerCase().replace(/\s+/g, "-"),
      name,
      alias,
      code,
      entry_count,
      city,
      state: stateOrProv,
      country,
    });
  });

  return clubs;
}

/**
 * Fetch the club_id map from the entries page's club-filter <select>.
 * Returns { clubName → selectValue } — these are RC's internal org_ids.
 * Useful for filtered fetches: /regatta/entries?job_id=ID&org_id={club_id}
 */
export async function fetchClubIdMap(jobId: string): Promise<Map<string, string>> {
  const url = `${RC_BASE}/regatta/entries?job_id=${jobId}&org_id=0`;
  let html: string;
  try {
    html = await politeGet(url);
  } catch (err) {
    console.error(`fetchClubIdMap(${jobId}): fetch failed`, err);
    return new Map();
  }

  const $ = cheerio.load(html);
  const map = new Map<string, string>();

  // The club filter is a <select> — each <option value="NNN">Club Name</option>
  $("select option").each((_i, opt) => {
    const value = $(opt).attr("value");
    const label = $(opt).text().trim();
    if (value && value !== "0" && label) {
      map.set(label, value);
    }
  });

  return map;
}

/**
 * Fetch entries for a regatta, optionally filtered to one club.
 *
 * Before the entry release date, each event sub-section shows
 * "Available {date}, {time}" instead of crew names. Those entries are
 * returned with an `available_date` field set and `crew_members: []`.
 *
 * Pass `orgId` (from fetchClubIdMap) to restrict to one club.
 */
export async function fetchEntries(
  jobId: string,
  orgId = "0"
): Promise<RCEntry[]> {
  const url = `${RC_BASE}/regatta/entries?job_id=${jobId}&org_id=${orgId}`;
  let html: string;
  try {
    html = await politeGet(url);
  } catch (err) {
    console.error(`fetchEntries(${jobId}): fetch failed`, err);
    return [];
  }

  const $ = cheerio.load(html);
  const entries: RCEntry[] = [];

  let currentEventNum = "";
  let currentEventName = "";

  $("table tr").each((_i, row) => {
    const cells = $(row).find("td");

    // Event header rows have 4 cells (same as events page: num, time, code, name)
    if (cells.length === 4 && /^\d+$/.test($(cells[0]).text().trim())) {
      currentEventNum = $(cells[0]).text().trim();
      currentEventName = $(cells[3]).text().trim();
      return;
    }

    // "Available {date}" sentinel — entry not yet released
    const rowText = $(row).text().trim();
    if (/^Available/i.test(rowText)) {
      entries.push({
        event_num: currentEventNum,
        event_name: currentEventName,
        club_name: "",
        club_code: "",
        crew_members: [],
        available_date: rowText.replace(/^Available\s*/i, ""),
      });
      return;
    }

    // Actual entry rows: club code in one cell, crew names in another
    // The exact column layout varies; we capture what's available
    if (cells.length >= 2 && currentEventNum) {
      const clubCell = $(cells[0]).text().trim();
      const crewCell = $(cells[1]).text().trim();
      if (clubCell && crewCell) {
        entries.push({
          event_num: currentEventNum,
          event_name: currentEventName,
          club_name: clubCell,
          club_code: clubCell,
          crew_members: crewCell
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
        });
      }
    }
  });

  return entries;
}

/**
 * Fetch results for a past regatta.
 * Use a past regatta job_id from /regattas?results for populated data.
 *
 * Results page has the same event/heat structure as the heat sheet but with
 * result times and places filled in.
 */
export async function fetchResults(jobId: string): Promise<RCHeat[]> {
  const url = `${RC_BASE}/regatta/results.jsp?job_id=${jobId}&org_id=0`;
  let html: string;
  try {
    html = await politeGet(url);
  } catch (err) {
    console.error(`fetchResults(${jobId}): fetch failed`, err);
    return [];
  }

  return parseHeatHtml(html, "result");
}

/**
 * Fetch the heat sheet for a regatta.
 *
 * Strategy:
 *   1. Try the CMS HTML page (/v3/cms/regatta/{id}/heat_sheet). If it has
 *      tabular data, parse it via parseHeatHtml().
 *   2. If the CMS page is empty/placeholder, scrape the overview page for
 *      PDF links and return them in pdf_urls for the caller to download.
 *
 * Returns { heats, pdf_urls }. If heats is non-empty, ignore pdf_urls.
 * If heats is empty but pdf_urls is non-empty, download the PDFs and use
 * pdf-parse or pdfplumber to extract lane/time/heat data.
 */
export async function fetchHeatSheet(jobId: string): Promise<RCHeatSheetResult> {
  // Step 1: Try CMS HTML heat sheet
  const cmsUrl = `${RC_BASE}/v3/cms/regatta/${jobId}/heat_sheet`;
  try {
    const html = await politeGet(cmsUrl);
    const heats = parseHeatHtml(html, "heat");
    if (heats.length > 0) {
      console.log(`fetchHeatSheet(${jobId}): found ${heats.length} heats in CMS HTML`);
      return { heats, pdf_urls: [] };
    }
    console.log(`fetchHeatSheet(${jobId}): CMS HTML heat sheet empty — checking for PDFs`);
  } catch (err) {
    console.warn(`fetchHeatSheet(${jobId}): CMS fetch failed (${(err as Error).message})`);
  }

  // Step 2: Scrape overview page for PDF bulletin/schedule links
  const pdfUrls = await findHeatSheetPdfs(jobId);
  if (pdfUrls.length === 0) {
    return { heats: [], pdf_urls: [] };
  }

  // Step 3: Download and parse the race schedule PDF (prefer "schedule" or "race" in filename)
  const scheduleUrl =
    pdfUrls.find((u) => /schedule|race/i.test(u)) ?? pdfUrls[0];
  try {
    const pdfBuffer = await downloadPdf(scheduleUrl);
    if (pdfBuffer) {
      const { heats } = await parseRcSchedulePdf(pdfBuffer);
      if (heats.length > 0) {
        console.log(
          `fetchHeatSheet(${jobId}): parsed ${heats.length} races from PDF — ${scheduleUrl}`
        );
        return { heats, pdf_urls: pdfUrls };
      }
    }
  } catch (err) {
    console.warn(`fetchHeatSheet(${jobId}): PDF parse failed — ${(err as Error).message}`);
  }

  return { heats: [], pdf_urls: pdfUrls };
}

/**
 * Download a PDF URL using Playwright and return its content as a Buffer.
 * Falls back to a direct HTTPS fetch with browser headers if Playwright
 * can't capture the response body (e.g. if the browser opens a PDF viewer).
 */
async function downloadPdf(url: string): Promise<Buffer | null> {
  // Try direct fetch first — PDFs don't need JS, just browser headers
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    }
    console.warn(`downloadPdf: direct fetch got ${res.status} for ${url}`);
  } catch (err) {
    console.warn(`downloadPdf: direct fetch failed (${(err as Error).message}), trying Playwright`);
  }

  // Playwright fallback — intercept the PDF response via page.on('response')
  try {
    const ctx = await getBrowserContext();
    const page = await ctx.newPage();
    try {
      let pdfBuffer: Buffer | null = null;
      page.on("response", async (resp) => {
        if (resp.url() === url && resp.ok()) {
          pdfBuffer = Buffer.from(await resp.body());
        }
      });
      await page.goto(url, { waitUntil: "commit", timeout: 20_000 }).catch(() => {});
      if (pdfBuffer) return pdfBuffer;
    } finally {
      await page.close();
    }
  } catch (err) {
    console.warn(`downloadPdf: Playwright fallback failed — ${(err as Error).message}`);
  }

  return null;
}

/**
 * Scrape the regatta overview page for linked PDFs (heat sheet, schedule,
 * bulletin). Returns absolute URLs for any .pdf links found.
 */
export async function findHeatSheetPdfs(jobId: string): Promise<string[]> {
  const overviewUrl = `${RC_BASE}/regatta/?job_id=${jobId}`;
  let html: string;
  try {
    html = await politeGet(overviewUrl);
  } catch (err) {
    console.error(`findHeatSheetPdfs(${jobId}): fetch failed`, err);
    return [];
  }

  const $ = cheerio.load(html);
  const pdfs: string[] = [];

  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    if (href.toLowerCase().endsWith(".pdf")) {
      pdfs.push(href.startsWith("http") ? href : `${RC_BASE}${href}`);
    }
  });

  return [...new Set(pdfs)]; // deduplicate
}

// ---------------------------------------------------------------------------
// HTML heat/result parser (shared between fetchHeatSheet and fetchResults)
// ---------------------------------------------------------------------------

/**
 * Parse the heat-sheet or results HTML into RCHeat[].
 *
 * Both pages share a similar structure:
 *   - Event header rows identify the event (event#, code, name)
 *   - Heat/race rows give stage (H1, SF2, F1 …) and scheduled time
 *   - Lane rows list lane number, club code, crew/athlete name, seed/result time
 *
 * The exact markup varies across regattas and page types, so we use heuristics
 * rather than fragile nth-child selectors.
 */
function parseHeatHtml(html: string, _mode: "heat" | "result"): RCHeat[] {
  const $ = cheerio.load(html);
  const heats: RCHeat[] = [];

  // Bail early on known "not available" placeholders
  const bodyText = $("body").text();
  if (
    /not yet available/i.test(bodyText) ||
    /misplaced our oars/i.test(bodyText) ||
    /no results/i.test(bodyText)
  ) {
    return [];
  }

  let currentEventNum = "";
  let currentEventName = "";
  let currentStage = "";
  let currentHeatNum = 1;
  let currentScheduled: string | undefined;
  let currentLanes: RCLane[] = [];
  let raceCounter = 0;

  function flushHeat() {
    if (currentEventNum && currentLanes.length > 0) {
      raceCounter++;
      heats.push({
        race_id: `${currentEventNum}-${currentStage}-${raceCounter}`,
        event_num: currentEventNum,
        event_name: currentEventName,
        stage: currentStage,
        heat_num: currentHeatNum,
        scheduled_start: currentScheduled,
        lanes: [...currentLanes],
      });
    }
    currentLanes = [];
  }

  $("table tr").each((_i, row) => {
    const cells = $(row).find("td");
    const cellTexts = cells
      .map((_j, td) => $(td).text().trim())
      .get() as string[];

    if (cellTexts.length === 0) return;

    // ── Event header: 4 cells, first is a digit (event#)
    if (cellTexts.length >= 3 && /^\d+$/.test(cellTexts[0])) {
      // Could be event header row or lane row — distinguish by column count
      if (cellTexts.length === 4) {
        // Event header
        flushHeat();
        currentEventNum = cellTexts[0];
        currentEventName = cellTexts[3];
        currentStage = "";
        currentHeatNum = 1;
        currentScheduled = undefined;
        return;
      }
    }

    // ── Heat/race label row: contains stage code like "H1", "SF2", "F1", "Final"
    const fullText = cellTexts.join(" ");
    const stageMatch = fullText.match(/\b(H\d+|SF\d+|F\d+|Final|Heat\s*\d+|Semi[-\s]?Final\s*\d*)\b/i);
    if (stageMatch && cellTexts.length <= 4) {
      flushHeat();
      const raw = stageMatch[1].replace(/\s+/g, "");
      currentStage = raw;
      const heatNumMatch = raw.match(/\d+/);
      currentHeatNum = heatNumMatch ? parseInt(heatNumMatch[0], 10) : 1;
      // Look for a time in the row: "8:00 AM" or "14:47"
      const timeMatch = fullText.match(/\d{1,2}:\d{2}(?:\s*[AP]M)?/i);
      currentScheduled = timeMatch ? timeMatch[0] : undefined;
      return;
    }

    // ── Lane row: first cell is a lane number (1–8), subsequent cells have
    //    club code, crew name, optional seed/result time
    if (cellTexts.length >= 2 && /^\d+$/.test(cellTexts[0]) && currentEventNum) {
      const laneNum = parseInt(cellTexts[0], 10);
      if (laneNum >= 1 && laneNum <= 10) {
        const club = cellTexts[1] ?? "";
        const entryName = cellTexts[2] ?? cellTexts[1] ?? "";
        const timeCell = cellTexts[3] ?? "";
        const placeCell = cellTexts[4] ?? "";

        const laneEntry: RCLane = {
          lane: laneNum,
          entry_name: entryName,
          club,
        };

        // Detect seed vs result time by pattern: "1:23.4" or "4:56.78"
        if (/^\d+:\d{2}[.:]?\d*$/.test(timeCell)) {
          if (_mode === "result") {
            laneEntry.result_time = timeCell;
          } else {
            laneEntry.seed_time = timeCell;
          }
        }

        const place = parseInt(placeCell, 10);
        if (!isNaN(place) && place >= 1) {
          laneEntry.place = place;
        }

        currentLanes.push(laneEntry);
      }
    }
  });

  // Flush the last heat
  flushHeat();

  return heats;
}
