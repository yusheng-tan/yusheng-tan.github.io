-- one row per region (state or province) with its visitor count and summed coordinates
CREATE TABLE IF NOT EXISTS regions (
  key TEXT PRIMARY KEY,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  lat_sum REAL NOT NULL DEFAULT 0,
  lon_sum REAL NOT NULL DEFAULT 0
);
