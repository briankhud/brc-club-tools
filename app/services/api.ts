/**
 * RowDay API client
 *
 * Points to the Hono backend running at EXPO_PUBLIC_API_URL (defaults to
 * localhost:3000 for local dev). When testing on a physical device, replace
 * with your Mac's LAN IP: e.g. http://192.168.1.xx:3000
 */

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types (mirrors backend response shapes)
// ---------------------------------------------------------------------------

export interface Regatta {
  id: string;
  rc_regatta_id: string;
  name: string;
  short_name?: string;
  start_date: string;
  end_date: string;
  venue?: string;
  city: string;
  state: string;
  status: string;
  description?: string;
  event_count?: number;
}

export interface Event {
  id: string;
  rc_event_id?: string;
  regatta_id: string;
  event_number: number;
  name: string;
  gender: string;
  boat_class: string;
  category: string;
  distance_meters: number;
  display_order: number;
}

export interface Club {
  id: string;
  rc_org_id?: string;
  name: string;
  short_name: string;
  city: string;
  state: string;
}

export interface HeatLane {
  id: string;
  lane_number: number;
  entry_name: string;
  club_short: string;
  athlete_id: string | null;
  seed_time_ms: number | null;
  place: number | null;
  time_ms: number | null;
  dnf: boolean;
  dns: boolean;
  dq: boolean;
}

export interface Heat {
  id: string;
  rc_race_id: string;
  event_id: string;
  display_number: string;
  stage_name: string;
  scheduled_start: string;
  actual_start: string | null;
  status: string;
  progression: string;
  display_order: number;
  lanes: HeatLane[];
}

export interface ScheduleItem {
  event: Event;
  heat: Heat;
  club_lanes: HeatLane[];
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/** List all regattas. */
export async function getRegattas(): Promise<{ regattas: Regatta[] }> {
  return apiFetch("/api/regattas");
}

/** Get regatta detail plus its event list. */
export async function getRegatta(
  id: string
): Promise<{ regatta: Regatta; events: Event[] }> {
  return apiFetch(`/api/regattas/${id}`);
}

/** Get all clubs entered in a regatta. */
export async function getRegattaClubs(
  regattaId: string
): Promise<{ regatta_id: string; clubs: Club[] }> {
  return apiFetch(`/api/regattas/${regattaId}/clubs`);
}

/** Get a club's full heat schedule for a regatta. */
export async function getClubSchedule(
  regattaId: string,
  clubId: string
): Promise<{ regatta_id: string; club: Club; schedule: ScheduleItem[] }> {
  return apiFetch(`/api/regattas/${regattaId}/club/${clubId}/schedule`);
}

/** Get heat sheet (all lanes) for a specific heat. */
export async function getHeatSheet(
  regattaId: string,
  eventId: string,
  heatId: string
): Promise<{ regatta: Regatta; event: Event; heat: Heat }> {
  return apiFetch(
    `/api/regattas/${regattaId}/event/${eventId}/heat/${heatId}`
  );
}
