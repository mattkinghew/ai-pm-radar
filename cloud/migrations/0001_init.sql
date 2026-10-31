CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('daily','capture','library')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','approved','rejected')),
  title TEXT NOT NULL,
  url TEXT,
  source TEXT,
  category TEXT,
  summary TEXT,
  key_points TEXT,          -- JSON array
  score REAL,
  raw_excerpt TEXT,
  ai_provider TEXT,
  run_date TEXT,            -- YYYY-MM-DD (HKT)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS items_url_kind ON items(url, kind) WHERE url IS NOT NULL;
CREATE INDEX IF NOT EXISTS items_status ON items(status, updated_at);
CREATE INDEX IF NOT EXISTS items_run_date ON items(run_date);
CREATE TABLE IF NOT EXISTS ai_usage (day TEXT PRIMARY KEY, calls INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, started_at TEXT, finished_at TEXT, collected INTEGER, analyzed INTEGER, error TEXT);
