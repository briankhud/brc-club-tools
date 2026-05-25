/**
 * RC Race Schedule PDF parser
 *
 * Parses the "Preliminary Race Schedule" PDF that RegattaCentral hosts at:
 *   /cms/uploads/{org_slug}/files/{filename}.pdf
 *
 * This PDF contains the full race schedule skeleton:
 *   - Event number and name
 *   - Heat/race labels (H1, H2, SF1, F1, etc.)
 *   - Scheduled start times
 *   - Race numbers (RC's internal sequential race ID)
 *
 * NOTE: This PDF does NOT contain lane/club/athlete assignments — those come
 * from the HTML entries page (after release) or a later "official heat sheet"
 * PDF. The parser returns RCHeat objects with empty lanes[].
 *
 * Observed text layout (from CSSRA 2026 / job_id=10115):
 *
 *   "8:00 AM"               ← standalone time = first heat of next event
 *   "2"                     ← event number
 *   "Junior Men Coxed Four - Tony Carr"   ← event name part 1
 *   "Event"                 ← event name part 2 (sometimes split)
 *   "H 1"                   ← heat label
 *   "Scheduled"             ← status
 *   "1"                     ← RC race number
 *
 *   "8:06 AMH 2"            ← time+heat combined = subsequent heat, same event
 *   "Scheduled"
 *   "2"                     ← race number
 *
 * Day sections start with lines like "Friday, 5 June, 2026" or "Friday Heats".
 * The parser tracks these and attaches the day to each heat's scheduled_start.
 *
 * See ./rc-pdf-notes.md for the full observed format documentation.
 */

import pdfParse from "pdf-parse";
import type { RCHeat } from "./rc-client.js";

export interface RCSchedulePdfResult {
  heats: RCHeat[];
  raw_text: string;
  race_count: number;
  event_count: number;
}

// ── Regex constants ────────────────────────────────────────────────────────

/** Standalone time: "8:00 AM" or "2:47 PM" */
const RE_TIME_ALONE = /^(\d{1,2}:\d{2}\s*[AP]M)$/i;

/** Time with heat appended: "8:06 AMH 2" or "10:30 AMF 1" or "1:12 PMSF 1" */
const RE_TIME_WITH_HEAT = /^(\d{1,2}:\d{2}\s*[AP]M)\s*(H\s*\d+|SF\s*\d*|F\s*\d*|Final)$/i;

/** Pure event number: a standalone integer */
const RE_EVENT_NUM = /^\d+$/;

/** Heat label on its own line: "H 1", "H1", "SF 2", "F 1", "Final" */
const RE_HEAT_LABEL = /^(H\s*\d+|SF\s*\d*|F\s*\d*|Final\s*\d*)$/i;

/**
 * Event name with heat label appended — no space separator.
 * RC sometimes runs the name and heat together: "Mixed DoubleH 1" or
 * "Novice Women Coxed QuadSF 1" or "Junior Men Double - Doug Wells EventSF 1"
 */
const RE_NAME_WITH_HEAT =
  /^(.+?)\s*(H\s*\d+|SF\s*\d*|F\s*\d*|Final\s*\d*)$/i;

/** Day header lines */
const RE_DAY_HEADER = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i;

/** Section headers to skip */
const RE_SECTION_HEADER =
  /^(Friday|Saturday|Sunday)\s+(Heats|Semi.?Finals?|Finals?|Races?)/i;

/** Status values to skip */
const RE_STATUS = /^(Scheduled|Official|Unofficial|Cancelled|Scratched)$/i;

/** Column header lines to skip */
const RE_COL_HEADER = /^(Event|Race|Time|No\.|Status|Race Schedule)$/i;

/** Title lines to skip */
const RE_TITLE =
  /^(2026 CSSRA|\d+-\d+ (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|Race Schedule)$/i;

// ── Parser state machine ────────────────────────────────────────────────────

type ParserState = "seeking_event" | "reading_event_name" | "reading_heat";

interface ParseCtx {
  state: ParserState;
  currentDay: string;
  currentTime: string;
  currentEventNum: string;
  currentEventNameParts: string[];
  currentHeatLabel: string;
  pendingTimeWithHeat: { time: string; heatLabel: string } | null;
  heats: RCHeat[];
  raceCounter: number;
}

/**
 * Parse a RegattaCentral race schedule PDF buffer into an array of RCHeat.
 * Lane assignments are not present in this PDF — all heats returned have lanes: [].
 */
export async function parseRcSchedulePdf(
  pdfBuffer: Buffer
): Promise<RCSchedulePdfResult> {
  const data = await pdfParse(pdfBuffer);
  const rawText = data.text;

  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const ctx: ParseCtx = {
    state: "seeking_event",
    currentDay: "",
    currentTime: "",
    currentEventNum: "",
    currentEventNameParts: [],
    currentHeatLabel: "",
    pendingTimeWithHeat: null,
    heats: [],
    raceCounter: 0,
  };

  for (const line of lines) {
    // Always skip boilerplate
    if (
      RE_TITLE.test(line) ||
      RE_COL_HEADER.test(line) ||
      RE_STATUS.test(line) ||
      RE_SECTION_HEADER.test(line)
    ) {
      continue;
    }

    // Day headers — update current day context.
    // Page headers repeat mid-data at page breaks. Update the day label but
    // do NOT reset the event context — a page break mid-event must carry on.
    if (RE_DAY_HEADER.test(line)) {
      ctx.currentDay = line;
      // Don't change state or clear currentEventNum here
      continue;
    }

    // ── Time + heat combined: "8:06 AMH 2" or "8:06 AMSF 2"
    const timeHeatMatch = line.match(RE_TIME_WITH_HEAT);
    if (timeHeatMatch) {
      const time = timeHeatMatch[1].trim();
      const heatLabel = normalizeHeatLabel(timeHeatMatch[2].trim());
      ctx.currentTime = time;
      pushHeat(ctx, time, heatLabel);
      ctx.state = "reading_heat";
      continue;
    }

    // ── Standalone time: "8:00 AM" → next line will be event number
    if (RE_TIME_ALONE.test(line)) {
      ctx.currentTime = line.trim();
      ctx.state = "seeking_event";
      continue;
    }

    // ── Pure integer: could be event number OR race number
    if (RE_EVENT_NUM.test(line)) {
      if (ctx.state === "seeking_event" && ctx.currentTime) {
        // This is an event number — start reading the event name
        ctx.currentEventNum = line;
        ctx.currentEventNameParts = [];
        ctx.state = "reading_event_name";
        continue;
      }
      // Otherwise it's a race number (RC internal sequential ID) — skip
      continue;
    }

    // ── Heat label on its own: "H 1", "SF 2", "Final"
    if (RE_HEAT_LABEL.test(line)) {
      const heatLabel = normalizeHeatLabel(line);
      pushHeat(ctx, ctx.currentTime, heatLabel);
      ctx.state = "reading_heat";
      continue;
    }

    // ── Text line in event-name state: could be plain name OR "name + heat" merged
    if (ctx.state === "reading_event_name") {
      // Check for "EventNameH 1" or "EventNameSF 1" merged on same line
      const nameHeatMatch = line.match(RE_NAME_WITH_HEAT);
      if (nameHeatMatch) {
        const namePart = nameHeatMatch[1].trim();
        const heatLabel = normalizeHeatLabel(nameHeatMatch[2].trim());
        if (namePart) ctx.currentEventNameParts.push(namePart);
        pushHeat(ctx, ctx.currentTime, heatLabel);
        ctx.state = "reading_heat";
      } else {
        // Plain name line — accumulate
        ctx.currentEventNameParts.push(line);
      }
      continue;
    }

    // ── Text line in reading_heat state: could be "name + heat" for an event
    // that has no standalone event number (edge case — skip safely)
    if (ctx.state === "reading_heat") {
      const nameHeatMatch = line.match(RE_NAME_WITH_HEAT);
      if (nameHeatMatch) {
        const heatLabel = normalizeHeatLabel(nameHeatMatch[2].trim());
        pushHeat(ctx, ctx.currentTime, heatLabel);
      }
      // Otherwise: stray text — skip
      continue;
    }
  }

  // Final event name cleanup — remove trailing "Event" suffix RC often appends
  const uniqueEvents = new Set(ctx.heats.map((h) => h.event_num));

  return {
    heats: ctx.heats,
    raw_text: rawText,
    race_count: ctx.heats.length,
    event_count: uniqueEvents.size,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeHeatLabel(raw: string): string {
  // "H 1" → "H1", "SF 2" → "SF2", "F 1" → "F1", "Final" → "F1"
  const s = raw.replace(/\s+/g, "").toUpperCase();
  if (/^FINAL$/i.test(s)) return "F1";
  return s;
}

function buildEventName(parts: string[]): string {
  // Join parts, strip trailing "Event" suffix RC appends
  return parts
    .join(" ")
    .replace(/\s*Event\s*$/i, "")
    .trim();
}

function heatNumFromLabel(label: string): number {
  const m = label.match(/\d+/);
  return m ? parseInt(m[0], 10) : 1;
}

function stageFromLabel(label: string): string {
  if (/^H\d+$/.test(label)) return "heat";
  if (/^SF\d*$/.test(label)) return "semifinal";
  if (/^F\d*$/.test(label)) return "final";
  return label;
}

function pushHeat(ctx: ParseCtx, time: string, heatLabel: string): void {
  if (!ctx.currentEventNum) return;

  ctx.raceCounter++;
  const eventName = buildEventName(ctx.currentEventNameParts);

  const heat: RCHeat = {
    race_id: `${ctx.currentEventNum}-${heatLabel}-${ctx.raceCounter}`,
    event_num: ctx.currentEventNum,
    event_name: eventName || `Event ${ctx.currentEventNum}`,
    stage: stageFromLabel(heatLabel),
    heat_num: heatNumFromLabel(heatLabel),
    scheduled_start: time
      ? `${ctx.currentDay} ${time}`.trim()
      : undefined,
    lanes: [], // lane assignments not in schedule PDF
  };

  ctx.heats.push(heat);
}
