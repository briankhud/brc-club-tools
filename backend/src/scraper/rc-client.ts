/**
 * Regatta Central data fetcher
 *
 * RC does not publish an official public API. The v3 endpoint below is
 * observed from their web app's network traffic and may change without notice.
 * If the API returns a non-200 status, fall back to HTML scraping via cheerio.
 *
 * Target patterns:
 *   Regatta list:   https://www.regattacentral.com/regatta/index.jsp
 *   Heat sheet:     https://www.regattacentral.com/regatta/heats.jsp?job_id={regattaId}
 *   Results:        https://www.regattacentral.com/regatta/results.jsp?job_id={regattaId}
 *
 * Unofficial v3 API (JSON — subject to change):
 *   https://api.regattacentral.com/v3.0/regattas?state=upcoming
 *   https://api.regattacentral.com/v3.0/regattas/{regattaId}/events
 *   https://api.regattacentral.com/v3.0/regattas/{regattaId}/heats
 */

const RC_API_BASE = process.env.RC_API_BASE ?? "https://api.regattacentral.com/v3.0";
const RC_WEB_BASE = "https://www.regattacentral.com";

export interface RCRegatta {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  venue?: string;
  city?: string;
  state?: string;
}

export interface RCHeat {
  race_id: string;
  event_name: string;
  stage: string;
  scheduled_start: string;
  lanes: RCLane[];
}

export interface RCLane {
  lane: number;
  entry_name: string;
  club: string;
  seed_time?: string;
}

/**
 * Attempt to fetch upcoming regattas from the RC v3 API.
 * Falls back to noting that HTML scraping is required if the API is unavailable.
 */
export async function fetchRegattaList(): Promise<RCRegatta[]> {
  const url = `${RC_API_BASE}/regattas?state=upcoming`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "RowDay/0.1 (rowing companion app)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(
        `RC API returned ${res.status} — falling back to HTML scraping (not yet implemented)`
      );
      // TODO: implement cheerio-based scraper targeting:
      //   GET ${RC_WEB_BASE}/regatta/index.jsp
      //   Parse <table id="regatta-list"> rows
      return [];
    }

    const data = (await res.json()) as { regattas?: RCRegatta[] };
    return data.regattas ?? [];
  } catch (err) {
    console.error("fetchRegattaList error:", err);
    return [];
  }
}

/**
 * Fetch the heat sheet for a given regatta ID.
 *
 * TODO: implement full scraping pipeline:
 *   1. GET ${RC_WEB_BASE}/regatta/heats.jsp?job_id=${regattaId}
 *   2. Parse event sections and lane rows using cheerio
 *   3. Map to RCHeat[] and persist via db/queries
 */
export async function fetchHeatSheet(regattaId: string): Promise<RCHeat[]> {
  const apiUrl = `${RC_API_BASE}/regattas/${regattaId}/heats`;
  const fallbackUrl = `${RC_WEB_BASE}/regatta/heats.jsp?job_id=${regattaId}`;

  console.log(`Fetching heat sheet for regatta ${regattaId}`);
  console.log(`  API URL:      ${apiUrl}`);
  console.log(`  Fallback URL: ${fallbackUrl}`);

  try {
    const res = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "RowDay/0.1 (rowing companion app)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`RC API heat sheet returned ${res.status}`);
      // TODO: scrape fallbackUrl with cheerio
      //   const html = await res.text();
      //   const $ = cheerio.load(html);
      //   Parse heat rows...
      return [];
    }

    const data = (await res.json()) as { heats?: RCHeat[] };
    return data.heats ?? [];
  } catch (err) {
    console.error("fetchHeatSheet error:", err);
    return [];
  }
}

/**
 * Fetch live results for a regatta.
 * TODO: implement — target URL: ${RC_WEB_BASE}/regatta/results.jsp?job_id=${regattaId}
 */
export async function fetchResults(regattaId: string): Promise<void> {
  const url = `${RC_WEB_BASE}/regatta/results.jsp?job_id=${regattaId}`;
  console.log(`TODO: implement fetchResults — ${url}`);
}
