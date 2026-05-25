# RC Race Schedule PDF — format notes

Observed from CSSRA Championships 2026 (`job_id=10115`), PDF:
`/cms/uploads/canadian_secondary_schools_rowing_association/files/2026 CSSRA Preliminary Race Schedule v1.pdf`

Downloaded and parsed 2026-05-24 with `pdf-parse@1.1.1`.

## What this PDF contains

The "Preliminary Race Schedule" is the **schedule skeleton** — it tells you:
- Which events exist (number + name)
- How many heats per event and what stage (H, SF, F)
- Scheduled start time for every race
- RC's internal sequential race number

It does **NOT** contain:
- Lane assignments (which club/crew is in lane 1, 2, …)
- Athlete names
- Seed times

Lane assignments appear in the HTML entries page (`/regatta/entries`) after the release date, or in a separate "Official Heat Sheet" PDF published closer to race day.

## Text layout

`pdf-parse` extracts text in column-reading order. The schedule table becomes a flat sequence of short lines. 8 pages → ~1025 non-empty lines.

### First event block pattern

```
"8:00 AM"                       ← standalone time = first heat start time
"2"                             ← event number (standalone integer)
"Junior Men Coxed Four - Tony"  ← event name (may wrap across 1-2 lines)
"Carr Event"                    ← continuation (RC appends "Event" as suffix)
"H 1"                           ← heat label (standalone)
"Scheduled"                     ← status (skip)
"1"                             ← RC race number (skip — we use our own counter)
```

### Subsequent heats of the same event (time + label merged)

```
"8:06 AMH 2"    ← time and heat label concatenated — NO space between AM and H
"Scheduled"
"2"
"8:12 AMH 3"
...
```

### Next event (new standalone time)

```
"8:18 AM"       ← standalone time signals a new event block begins
"3"             ← next event number
...
```

### Merged event name + heat label (edge case — ~6 events)

RC sometimes omits the line break between the event name and the first heat label:

```
"Mixed DoubleH 1"               ← event name + H1 on same line
"Novice Women Coxed QuadSF 1"  ← event name + SF1 on same line
"Junior Men Single - Otto Swinton EventSF 1"
```

These require the `RE_NAME_WITH_HEAT` regex: `^(.+?)\s*(H\s*\d+|SF\s*\d*|F\s*\d*|Final\s*\d*)$`

### Page break headers

Each new page starts with the section day header and column headers:

```
"Saturday, 6 June, 2026"
"Event"
"Race"
"Time"
"Race"
"No."
"Status"
"Saturday Heats and Semi-finals"
```

These appear mid-data and must be skipped without resetting the current event
context (the previous page ended mid-event and the next page continues it).

## Regexes used

| Pattern | Regex | Matches |
|---------|-------|---------|
| Standalone time | `/^(\d{1,2}:\d{2}\s*[AP]M)$/i` | `"8:00 AM"`, `"2:47 PM"` |
| Time + heat merged | `/^(\d{1,2}:\d{2}\s*[AP]M)\s*(H\s*\d+\|SF\s*\d*\|F\s*\d*\|Final)$/i` | `"8:06 AMH 2"` |
| Heat label alone | `/^(H\s*\d+\|SF\s*\d*\|F\s*\d*\|Final\s*\d*)$/i` | `"H 1"`, `"SF 2"`, `"Final"` |
| Name + heat merged | `/^(.+?)\s*(H\s*\d+\|SF\s*\d*\|F\s*\d*\|Final\s*\d*)$/i` | `"Mixed DoubleH 1"` |
| Status line | `/^(Scheduled\|Official\|Unofficial\|Cancelled\|Scratched)$/i` | skip |
| Day header | `/^(Monday\|…\|Sunday)/i` | update `currentDay` only |
| Section header | `/^(Friday\|Saturday\|Sunday)\s+(Heats\|Semi…)/i` | skip entirely |

## Validation (CSSRA 2026 / job_id=10115)

| Check | Expected | Got |
|-------|----------|-----|
| Events | 40 | ✅ 40 |
| Total races | 194 | ✅ 194 |
| First race | E2 H1 Fri 8:00 AM | ✅ |
| Last race | E40 F1 Sun 2:47 PM | ✅ |
| Event 1 has no heats | finals-only | ✅ |
| Event 16 has 9 races | H1-5 + SF1-3 + F1 | ✅ |

## Direct fetch vs Playwright

The PDF URL can be fetched directly with a browser `User-Agent` header — no
headless browser needed. `downloadPdf()` tries a direct `fetch()` first
(faster) and falls back to Playwright only if that returns non-200.

## pdf-parse version

Use `pdf-parse@1.1.1` (the stable 1.x release). Version 2.x is a complete
rewrite with a broken CJS/ESM export and a different class-based API that
doesn't work with the same call pattern.
