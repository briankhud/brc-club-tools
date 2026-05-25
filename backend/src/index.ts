import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

// ---------------------------------------------------------------------------
// Hardcoded seed data — Brighton Burn 2026 (indoor erg regatta)
// Brighton Rowing Club · Twelve Corners Middle School · Rochester, NY
// ---------------------------------------------------------------------------

const REGATTAS = [
  {
    id: "bb-2026",
    rc_regatta_id: "29441",
    name: "Brighton Burn 2026",
    short_name: "Brighton Burn",
    start_date: "2026-02-28",
    end_date: "2026-02-28",
    venue: "Twelve Corners Middle School",
    city: "Rochester",
    state: "NY",
    status: "upcoming",
    description:
      "Annual indoor erg rowing fundraiser hosted by Brighton Rowing Club. All ages, all abilities. Proceeds support BRC youth programs.",
    event_count: 6,
  },
  {
    id: "sny-spring-2026",
    rc_regatta_id: "29800",
    name: "Scholastic Nationals Qualifier — Spring 2026",
    short_name: "SNY Qualifier",
    start_date: "2026-04-18",
    end_date: "2026-04-19",
    venue: "Onondaga Lake Park",
    city: "Liverpool",
    state: "NY",
    status: "upcoming",
    description:
      "Scholastic Nationals Qualifier for New York scholastic programs.",
    event_count: 24,
  },
];

// Athletes at Brighton Rowing Club
const BRC_ATHLETES = [
  { id: "a1", first_name: "Mia", last_name: "Kellerman", gender: "F", birth_date: "2009-03-14" },
  { id: "a2", first_name: "Nora", last_name: "Ashworth", gender: "F", birth_date: "2008-11-22" },
  { id: "a3", first_name: "Sophie", last_name: "Vandenberg", gender: "F", birth_date: "2009-07-05" },
  { id: "a4", first_name: "Lily", last_name: "Okonkwo", gender: "F", birth_date: "2008-04-30" },
  { id: "a5", first_name: "Emma", last_name: "Trzcinski", gender: "F", birth_date: "2007-09-18" },
  { id: "a6", first_name: "Cora", last_name: "Buchanan", gender: "F", birth_date: "2007-12-01" },
  { id: "a7", first_name: "Zoe", last_name: "Harrington", gender: "F", birth_date: "2010-02-27" },
  { id: "a8", first_name: "Ava", last_name: "Sievert", gender: "F", birth_date: "2010-08-11" },
  { id: "a9", first_name: "Jack", last_name: "Moreau", gender: "M", birth_date: "2008-06-03" },
  { id: "a10", first_name: "Owen", last_name: "Patel", gender: "M", birth_date: "2008-01-15" },
  { id: "a11", first_name: "Finn", last_name: "Castellano", gender: "M", birth_date: "2007-10-09" },
  { id: "a12", first_name: "Liam", last_name: "Dougherty", gender: "M", birth_date: "2009-05-21" },
  { id: "a13", first_name: "Noah", last_name: "Eriksen", gender: "M", birth_date: "2007-03-08" },
  { id: "a14", first_name: "Caleb", last_name: "Winters", gender: "M", birth_date: "2010-11-14" },
  { id: "a15", first_name: "Marcus", last_name: "Yuen", gender: "M", birth_date: "2009-09-25" },
];

// Events at Brighton Burn 2026
const BB_2026_EVENTS = [
  {
    id: "e1",
    rc_event_id: "e-101",
    regatta_id: "bb-2026",
    event_number: 1,
    name: "Novice Girls 2k",
    gender: "F",
    boat_class: "1x",
    category: "Novice",
    distance_meters: 2000,
    display_order: 1,
    description: "First-year rowers, girls. Individual erg piece.",
  },
  {
    id: "e2",
    rc_event_id: "e-102",
    regatta_id: "bb-2026",
    event_number: 2,
    name: "Novice Boys 2k",
    gender: "M",
    boat_class: "1x",
    category: "Novice",
    distance_meters: 2000,
    display_order: 2,
    description: "First-year rowers, boys. Individual erg piece.",
  },
  {
    id: "e3",
    rc_event_id: "e-103",
    regatta_id: "bb-2026",
    event_number: 3,
    name: "JV Girls 2k",
    gender: "F",
    boat_class: "1x",
    category: "JV",
    distance_meters: 2000,
    display_order: 3,
    description: "Junior Varsity girls. Individual erg piece.",
  },
  {
    id: "e4",
    rc_event_id: "e-104",
    regatta_id: "bb-2026",
    event_number: 4,
    name: "JV Boys 2k",
    gender: "M",
    boat_class: "1x",
    category: "JV",
    distance_meters: 2000,
    display_order: 4,
    description: "Junior Varsity boys. Individual erg piece.",
  },
  {
    id: "e5",
    rc_event_id: "e-105",
    regatta_id: "bb-2026",
    event_number: 5,
    name: "Varsity Girls 2k",
    gender: "F",
    boat_class: "1x",
    category: "Varsity",
    distance_meters: 2000,
    display_order: 5,
    description: "Varsity girls. Individual erg piece.",
  },
  {
    id: "e6",
    rc_event_id: "e-106",
    regatta_id: "bb-2026",
    event_number: 6,
    name: "Varsity Boys 2k",
    gender: "M",
    boat_class: "1x",
    category: "Varsity",
    distance_meters: 2000,
    display_order: 6,
    description: "Varsity boys. Individual erg piece.",
  },
];

// Clubs entered in Brighton Burn 2026
const BB_2026_CLUBS = [
  { id: "c1", rc_org_id: "brc-1", name: "Brighton Rowing Club", short_name: "BRC", city: "Rochester", state: "NY" },
  { id: "c2", rc_org_id: "pcrc-1", name: "Pittsford Crew", short_name: "PCR", city: "Pittsford", state: "NY" },
  { id: "c3", rc_org_id: "wrc-1", name: "Webster Rowing Club", short_name: "WRC", city: "Webster", state: "NY" },
  { id: "c4", rc_org_id: "frc-1", name: "Fairport Rowing Club", short_name: "FRC", city: "Fairport", state: "NY" },
  { id: "c5", rc_org_id: "rcc-1", name: "Rochester Crew", short_name: "RCC", city: "Rochester", state: "NY" },
];

// Heats for Event 1 (Novice Girls 2k) — BRC athletes in lanes
const E1_HEATS = [
  {
    id: "h1-1",
    rc_race_id: "r-1001",
    event_id: "e1",
    display_number: "1A",
    stage_name: "Heat 1",
    // 9:15 AM Feb 28 2026
    scheduled_start: "2026-02-28T09:15:00-05:00",
    actual_start: null,
    status: "scheduled",
    progression: "Top 3 to Final",
    display_order: 1,
    lanes: [
      { id: "l1", lane_number: 1, entry_name: "Zoe Harrington", club_short: "BRC", athlete_id: "a7", seed_time_ms: 535000, place: null, time_ms: null, dnf: false, dns: false, dq: false },
      { id: "l2", lane_number: 2, entry_name: "Paige Holloway", club_short: "PCR", athlete_id: null, seed_time_ms: 528000, place: null, time_ms: null, dnf: false, dns: false, dq: false },
      { id: "l3", lane_number: 3, entry_name: "Ava Sievert", club_short: "BRC", athlete_id: "a8", seed_time_ms: 541000, place: null, time_ms: null, dnf: false, dns: false, dq: false },
      { id: "l4", lane_number: 4, entry_name: "Chloe Nakamura", club_short: "WRC", athlete_id: null, seed_time_ms: 519000, place: null, time_ms: null, dnf: false, dns: false, dq: false },
      { id: "l5", lane_number: 5, entry_name: "Brianna Costa", club_short: "FRC", athlete_id: null, seed_time_ms: 547000, place: null, time_ms: null, dnf: false, dns: false, dq: false },
      { id: "l6", lane_number: 6, entry_name: "Tess Malone", club_short: "RCC", athlete_id: null, seed_time_ms: 556000, place: null, time_ms: null, dnf: false, dns: false, dq: false },
    ],
  },
  {
    id: "h1-2",
    rc_race_id: "r-1002",
    event_id: "e1",
    display_number: "1B",
    stage_name: "Heat 2",
    scheduled_start: "2026-02-28T09:30:00-05:00",
    actual_start: null,
    status: "scheduled",
    progression: "Top 3 to Final",
    display_order: 2,
    lanes: [
      { id: "l7", lane_number: 1, entry_name: "Darcy Kim", club_short: "PCR", athlete_id: null, seed_time_ms: 509000, place: null, time_ms: null, dnf: false, dns: false, dq: false },
      { id: "l8", lane_number: 2, entry_name: "Mia Kellerman", club_short: "BRC", athlete_id: "a1", seed_time_ms: 522000, place: null, time_ms: null, dnf: false, dns: false, dq: false },
      { id: "l9", lane_number: 3, entry_name: "Hailey Forsberg", club_short: "WRC", athlete_id: null, seed_time_ms: 518000, place: null, time_ms: null, dnf: false, dns: false, dq: false },
      { id: "l10", lane_number: 4, entry_name: "Nora Ashworth", club_short: "BRC", athlete_id: "a2", seed_time_ms: 514000, place: null, time_ms: null, dnf: false, dns: false, dq: false },
      { id: "l11", lane_number: 5, entry_name: "Riley Dupont", club_short: "FRC", athlete_id: null, seed_time_ms: 531000, place: null, time_ms: null, dnf: false, dns: false, dq: false },
      { id: "l12", lane_number: 6, entry_name: "Quinn Aldridge", club_short: "RCC", athlete_id: null, seed_time_ms: 526000, place: null, time_ms: null, dnf: false, dns: false, dq: false },
    ],
  },
];

// Heats for Event 5 (Varsity Girls 2k)
const E5_HEATS = [
  {
    id: "h5-1",
    rc_race_id: "r-1010",
    event_id: "e5",
    display_number: "5A",
    stage_name: "Heat 1",
    scheduled_start: "2026-02-28T11:00:00-05:00",
    actual_start: null,
    status: "scheduled",
    progression: "Top 2 to Final",
    display_order: 1,
    lanes: [
      { id: "l20", lane_number: 1, entry_name: "Emma Trzcinski", club_short: "BRC", athlete_id: "a5", seed_time_ms: 441000, place: null, time_ms: null, dnf: false, dns: false, dq: false },
      { id: "l21", lane_number: 2, entry_name: "Sofia Marchetti", club_short: "PCR", athlete_id: null, seed_time_ms: 437000, place: null, time_ms: null, dnf: false, dns: false, dq: false },
      { id: "l22", lane_number: 3, entry_name: "Cora Buchanan", club_short: "BRC", athlete_id: "a6", seed_time_ms: 448000, place: null, time_ms: null, dnf: false, dns: false, dq: false },
      { id: "l23", lane_number: 4, entry_name: "Maya Sundaram", club_short: "WRC", athlete_id: null, seed_time_ms: 434000, place: null, time_ms: null, dnf: false, dns: false, dq: false },
      { id: "l24", lane_number: 5, entry_name: "Abby Fitzgerald", club_short: "RCC", athlete_id: null, seed_time_ms: 452000, place: null, time_ms: null, dnf: false, dns: false, dq: false },
    ],
  },
];

const HEAT_MAP: Record<string, typeof E1_HEATS> = {
  e1: E1_HEATS,
  e5: E5_HEATS,
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// List all regattas
app.get("/api/regattas", (c) => {
  return c.json({ regattas: REGATTAS });
});

// Get single regatta with its events
app.get("/api/regattas/:id", (c) => {
  const { id } = c.req.param();
  const regatta = REGATTAS.find((r) => r.id === id);
  if (!regatta) {
    return c.json({ error: "Regatta not found" }, 404);
  }
  const events = BB_2026_EVENTS.filter((e) => e.regatta_id === id);
  return c.json({ regatta, events });
});

// List clubs entered in a regatta
app.get("/api/regattas/:id/clubs", (c) => {
  const { id } = c.req.param();
  const regatta = REGATTAS.find((r) => r.id === id);
  if (!regatta) {
    return c.json({ error: "Regatta not found" }, 404);
  }
  // For Brighton Burn all clubs are entered; real impl would query entries
  return c.json({ regatta_id: id, clubs: BB_2026_CLUBS });
});

// Get a club's full heat schedule for a regatta
app.get("/api/regattas/:id/club/:clubId/schedule", (c) => {
  const { id, clubId } = c.req.param();
  const regatta = REGATTAS.find((r) => r.id === id);
  if (!regatta) {
    return c.json({ error: "Regatta not found" }, 404);
  }
  const club = BB_2026_CLUBS.find((c) => c.id === clubId);
  if (!club) {
    return c.json({ error: "Club not found" }, 404);
  }

  // Collect all heats where this club has a lane entry
  const schedule: Array<{
    event: (typeof BB_2026_EVENTS)[0];
    heat: (typeof E1_HEATS)[0];
    club_lanes: (typeof E1_HEATS)[0]["lanes"];
  }> = [];

  for (const event of BB_2026_EVENTS.filter((e) => e.regatta_id === id)) {
    const heats = HEAT_MAP[event.id] ?? [];
    for (const heat of heats) {
      const clubLanes = heat.lanes.filter((l) => l.club_short === club.short_name);
      if (clubLanes.length > 0) {
        schedule.push({ event, heat, club_lanes: clubLanes });
      }
    }
  }

  // Sort by scheduled_start
  schedule.sort(
    (a, b) =>
      new Date(a.heat.scheduled_start).getTime() -
      new Date(b.heat.scheduled_start).getTime()
  );

  return c.json({
    regatta_id: id,
    club,
    schedule,
  });
});

// Get heat sheet for a specific race
app.get("/api/regattas/:id/event/:eventId/heat/:heatId", (c) => {
  const { id, eventId, heatId } = c.req.param();
  const regatta = REGATTAS.find((r) => r.id === id);
  if (!regatta) {
    return c.json({ error: "Regatta not found" }, 404);
  }
  const event = BB_2026_EVENTS.find((e) => e.id === eventId);
  if (!event) {
    return c.json({ error: "Event not found" }, 404);
  }
  const heats = HEAT_MAP[eventId] ?? [];
  const heat = heats.find((h) => h.id === heatId);
  if (!heat) {
    return c.json({ error: "Heat not found" }, 404);
  }

  return c.json({ regatta, event, heat });
});

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? "3000", 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`RowDay backend running on http://localhost:${info.port}`);
});

export default app;
