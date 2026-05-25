-- RowDay PostgreSQL Schema
-- Run with: psql -d rowday -f schema.sql

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- club
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS club (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rc_org_id     TEXT UNIQUE,             -- Regatta Central organization ID
  name          TEXT NOT NULL,
  short_name    TEXT,
  city          TEXT,
  state         TEXT,
  country       TEXT DEFAULT 'USA',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_rc_org_id ON club (rc_org_id);
CREATE INDEX IF NOT EXISTS idx_club_name ON club (name);

-- ---------------------------------------------------------------------------
-- athlete
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS athlete (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rc_participant_id   TEXT UNIQUE,        -- RC participant identifier
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  birth_date          DATE,
  gender              CHAR(1),            -- 'M' | 'F'
  club_id             UUID REFERENCES club (id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_athlete_rc_participant_id ON athlete (rc_participant_id);
CREATE INDEX IF NOT EXISTS idx_athlete_club_id ON athlete (club_id);
CREATE INDEX IF NOT EXISTS idx_athlete_last_name ON athlete (last_name);

-- ---------------------------------------------------------------------------
-- regatta
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS regatta (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rc_regatta_id   TEXT UNIQUE NOT NULL,   -- RC regatta identifier
  name            TEXT NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  venue           TEXT,
  city            TEXT,
  state           TEXT,
  status          TEXT NOT NULL DEFAULT 'upcoming', -- upcoming | active | completed | cancelled
  fetched_at      TIMESTAMPTZ,            -- last successful scrape
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regatta_rc_regatta_id ON regatta (rc_regatta_id);
CREATE INDEX IF NOT EXISTS idx_regatta_start_date ON regatta (start_date);
CREATE INDEX IF NOT EXISTS idx_regatta_status ON regatta (status);

-- ---------------------------------------------------------------------------
-- event
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rc_event_id       TEXT UNIQUE,
  regatta_id        UUID NOT NULL REFERENCES regatta (id) ON DELETE CASCADE,
  event_number      INTEGER,
  name              TEXT NOT NULL,
  gender            TEXT,               -- 'M' | 'F' | 'Mixed' | 'Open'
  boat_class        TEXT,               -- '1x' | '2x' | '4+' | '8+' | etc.
  category          TEXT,               -- 'Novice' | 'JV' | 'Varsity' | 'Open' | 'Masters'
  distance_meters   INTEGER,
  display_order     INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_regatta_id ON event (regatta_id);
CREATE INDEX IF NOT EXISTS idx_event_display_order ON event (regatta_id, display_order);

-- ---------------------------------------------------------------------------
-- entry  (a club/team entered into an event)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entry (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rc_entry_id     TEXT UNIQUE,
  event_id        UUID NOT NULL REFERENCES event (id) ON DELETE CASCADE,
  club_id         UUID REFERENCES club (id) ON DELETE SET NULL,
  entry_name      TEXT,               -- display name (e.g. "Brighton RC Varsity A")
  bow_number      INTEGER,
  status          TEXT DEFAULT 'entered', -- entered | scratched | withdrawn
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entry_event_id ON entry (event_id);
CREATE INDEX IF NOT EXISTS idx_entry_club_id ON entry (club_id);

-- ---------------------------------------------------------------------------
-- lineup  (individual rower in an entry)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lineup (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id    UUID NOT NULL REFERENCES entry (id) ON DELETE CASCADE,
  athlete_id  UUID NOT NULL REFERENCES athlete (id) ON DELETE CASCADE,
  seat        INTEGER,                -- 1 = bow seat; 8 = stroke for 8+; NULL for erg 1x
  is_cox      BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entry_id, athlete_id)
);

CREATE INDEX IF NOT EXISTS idx_lineup_entry_id ON lineup (entry_id);
CREATE INDEX IF NOT EXISTS idx_lineup_athlete_id ON lineup (athlete_id);

-- ---------------------------------------------------------------------------
-- race  (a single heat/final within an event)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS race (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rc_race_id        TEXT UNIQUE,
  event_id          UUID NOT NULL REFERENCES event (id) ON DELETE CASCADE,
  display_number    TEXT,               -- e.g. "1A", "Final"
  stage_name        TEXT,               -- "Heat 1", "Semifinal", "A Final"
  scheduled_start   TIMESTAMPTZ,
  actual_start      TIMESTAMPTZ,
  status            TEXT DEFAULT 'scheduled', -- scheduled | official | unofficial | cancelled
  progression       TEXT,               -- e.g. "Top 3 advance to Final"
  display_order     INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_race_event_id ON race (event_id);
CREATE INDEX IF NOT EXISTS idx_race_scheduled_start ON race (scheduled_start);
CREATE INDEX IF NOT EXISTS idx_race_status ON race (status);

-- ---------------------------------------------------------------------------
-- lane  (one entry's result in a race — for erg events each lane = one athlete)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lane (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  race_id         UUID NOT NULL REFERENCES race (id) ON DELETE CASCADE,
  entry_id        UUID NOT NULL REFERENCES entry (id) ON DELETE CASCADE,
  lane_number     INTEGER,
  place           INTEGER,            -- finish place; NULL until results posted
  time_ms         INTEGER,            -- finish time in milliseconds
  margin_ms       INTEGER,            -- margin behind winner
  dnf             BOOLEAN DEFAULT false,
  dns             BOOLEAN DEFAULT false,
  dq              BOOLEAN DEFAULT false,
  result_status   TEXT,               -- 'official' | 'unofficial' | 'pending'
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (race_id, lane_number)
);

CREATE INDEX IF NOT EXISTS idx_lane_race_id ON lane (race_id);
CREATE INDEX IF NOT EXISTS idx_lane_entry_id ON lane (entry_id);

-- ---------------------------------------------------------------------------
-- subscription  (push notification preferences per device)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_token          TEXT NOT NULL,
  platform              TEXT NOT NULL,    -- 'ios' | 'android'
  club_id               UUID REFERENCES club (id) ON DELETE SET NULL,
  athlete_id            UUID REFERENCES athlete (id) ON DELETE SET NULL,
  regatta_id            UUID REFERENCES regatta (id) ON DELETE SET NULL,
  notify_heat_start     BOOLEAN DEFAULT true,
  notify_results        BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_token, regatta_id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_device_token ON subscription (device_token);
CREATE INDEX IF NOT EXISTS idx_subscription_athlete_id ON subscription (athlete_id);
CREATE INDEX IF NOT EXISTS idx_subscription_club_id ON subscription (club_id);
CREATE INDEX IF NOT EXISTS idx_subscription_regatta_id ON subscription (regatta_id);
