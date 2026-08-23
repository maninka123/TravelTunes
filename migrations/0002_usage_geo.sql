CREATE TABLE IF NOT EXISTS usage_geo (
  day      TEXT NOT NULL,   -- YYYY-MM-DD only, never a full timestamp
  country  TEXT NOT NULL,
  city     TEXT,
  runs     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, country, city)
);
