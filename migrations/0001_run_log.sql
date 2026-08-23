CREATE TABLE IF NOT EXISTS runs (
  id            TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL,
  provider      TEXT NOT NULL,
  vision_model  TEXT,
  songs_model   TEXT,
  countries     TEXT,   -- JSON array of {name, count}, user-selected only
  energy        INTEGER,
  style         INTEGER,
  mood_json     TEXT,   -- the vision call's returned JSON
  songs_json    TEXT,   -- JSON array of {title, artist, language}
  vision_ms     INTEGER,
  songs_ms      INTEGER,
  error         TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
