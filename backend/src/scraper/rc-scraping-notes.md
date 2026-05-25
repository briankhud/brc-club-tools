# RegattaCentral scraping notes

Observations from scraping CSSRA Championships 2026 (`job_id=10115`) on 2026-05-24. Use these as a starting point for the Cheerio scraper.

## Live job_ids to test against

Pulled from the country=Canada upcoming list:

| job_id | Regatta | Dates | Type |
|---|---|---|---|
| 10115 | CSSRA Championships (St. Catharines, ON) | Jun 5–7, 2026 | Sprint, heats + SFs + finals — great test case |
| ? | Royal Canadian Henley | early Aug 2026 | larger; not pulled yet — search `season=2026&country=49` once they fix that URL or just browse `/regattas` |

You can pull a current list of all Canadian regattas with `job_id`s by hitting `/regattas`, selecting Canada (country combobox value `CA`), and parsing the table. Same trick with `US` to test U.S. events.

Other useful job_ids visible in the page text:
- `?results` query on `/regattas` filters to past regattas, which is where you'll find ones with **populated** heat sheets and results — much better for selector development than an upcoming-but-not-yet-published regatta.

## URL endpoints

All take `job_id` and (optionally) `org_id` (where `0` = no club filter):

| Path | Returns | Notes |
|---|---|---|
| `/regatta/?job_id={id}` | Overview HTML | Has dates, venue, host, entry counts |
| `/regatta/events?job_id={id}&org_id=0` | Event list (HTML table) | 4 cols: event#, final time, code, name. Day header is a single-cell row |
| `/regatta/clubs?job_id={id}&org_id=0` | Participating clubs (HTML table) | 6 cols incl. blade image cell, name, "alias\\n CODE", entries, location, country |
| `/regatta/entries?job_id={id}&org_id=0` | Per-event entries | Shows "Available {date}" placeholder until release date; otherwise lists crews per event |
| `/regatta/entries?job_id={id}&org_id={club_id}` | Same, filtered to one club | `club_id` comes from the club-filter `<select>` `value` |
| `/v3/cms/regatta/{id}/heat_sheet` | Heat sheet (CMS) | **Empty for many regattas** — content is "not yet available" until the host populates it. Often the real heat sheet is a PDF uploaded under `/cms/uploads/{org_slug}/files/…` |
| `/regatta/results.jsp?job_id={id}&org_id=0` | Results | Use this on a past regatta to develop result-parsing selectors |
| `/regattas` | Master regatta listing | Country/year/type/category filters; table has links to each regatta page |

**404'd (don't use):**
- `/regatta/event_list/?job_id={id}` — old URL, dead
- `/regatta/?org_id=&type_id=&distance_id=&season=2026&country=49` — old search URL, returns "we've misplaced our oars"

## DOM structure for Cheerio selectors

All the data pages are server-rendered tables — `fetch()` + `cheerio.load()` will work without a headless browser. I confirmed by doing exactly that in JS (`fetch(url) → DOMParser → table tr → td`).

### Clubs page (`/regatta/clubs`)

```
table tr (skip header row + footer row)
  td[0] = blade image (empty text)
  td[1] = full club name
  td[2] = "<alias>\n   <CODE>"      ← split on \n, trim
  td[3] = entry count (integer)
  td[4] = "City, ST/Prov"
  td[5] = country code (CAN/USA)
```

The footer row has only 2 cells, so filter for `cells.length === 6`.

### Events page (`/regatta/events`)

```
table tr
  Header row: single td with day text "Sunday, June 7, 2026"
  Data rows: 4 td → event#, final-time, boat-class code, event name
```

Filter for `cells.length === 4 && /^\d+$/.test(cells[0])` to skip the day header.

### Entries page (`/regatta/entries`)

Same outer table shape as the events page, but each event row is followed by a sub-section. When entries are released you'll see additional rows underneath each event with the club entries (and per-crew athlete names). Before release, the sub-row reads "Available {date}, {time}". Plan your selectors so an empty sub-section degrades gracefully.

The club-filter `<select>` element on this page gives you the full `{club_name → club_id}` map — handy for filtering per club.

### Heat sheet — the gotcha

`/v3/cms/regatta/{id}/heat_sheet` is a CMS slot, not the canonical heat sheet location. For CSSRA the real heat sheet (with lanes/seedings) is a PDF dropped into `/cms/uploads/canadian_secondary_schools_rowing_association/files/…`. So your scraper should:

1. Try the CMS heat-sheet page; if it has tabular HTML, parse it.
2. Otherwise, look on the overview page for linked PDF bulletins/schedules and download those.
3. For PDF parsing, `pdf.js` (browser) or `pdfplumber`/`pdf-parse` (node) work; the text comes out in row order so you can regex-match event/heat/lane/time tokens.

## Anti-scraping behavior

- No CAPTCHA, no obvious rate limiting in casual use.
- Plain `fetch()` from a regular User-Agent worked fine.
- The browser-mimicking header pack you'd typically want:
  ```
  User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36
  Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
  Accept-Language: en-US,en;q=0.9
  Accept-Encoding: gzip, deflate, br
  Referer: https://www.regattacentral.com/regattas
  ```
- Be polite: cache aggressively, add per-request delay (~500ms), and don't hammer `/regattas` looking for new job_ids — poll it once a day.
- The site IS allowlisted-blocked from at least one network I tried (Cowork's egress), so if Code's box can't reach it, that's an upstream network thing, not a RegattaCentral block.

## Test fixture: CSSRA 2026 (job_id=10115)

Stable data points to assert against in unit tests:

- `676` total entries, `131` clubs, `40` events
- 194 races over 3 days: 86 heats Friday + (50 SFs + 18 heats) Saturday + 40 finals Sunday
- First race: Friday 8:00 AM, Event 2 (Junior Men Coxed Four), H1
- Last race: Sunday 2:47 PM, Event 40 (Senior Women Eight), F1
- Event 1 (JrWLwt4x+) has only a final, no heats — useful edge case for the "events-with-no-heats" branch
- Club with the most entries: E.L. Crossley S.S. (32)

For a fully populated heat-sheet/results test, pick a past regatta from `/regattas?results` and pin its job_id.

## TL;DR for the Code agent

1. Use `job_id=10115` against `/regatta/events`, `/regatta/clubs`, `/regatta/entries` for HTML-table selectors. Use a past regatta (filter `/regattas?results`) for `/regatta/results.jsp` and for a populated `/v3/cms/regatta/{id}/heat_sheet`.
2. Cheerio works — no headless browser needed for the table pages.
3. Heat sheets are often PDFs linked from the overview, not HTML — handle both code paths.
4. The page text already shows "Available {date}" before entries release; treat that as a sentinel, not a parse error.
