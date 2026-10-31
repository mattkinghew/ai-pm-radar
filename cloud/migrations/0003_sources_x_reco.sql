-- User-managed sources (訊息源), X ingestion dedup, personalized recommendation.
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('rss','x')),
  value TEXT NOT NULL,
  label TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS sources_type_value ON sources(type, value);
ALTER TABLE items ADD COLUMN external_id TEXT;  -- e.g. x:<post_id>
ALTER TABLE items ADD COLUMN metrics TEXT;      -- JSON (X metrics)
ALTER TABLE items ADD COLUMN reco_score REAL;   -- 0-10 information edge for Matt
ALTER TABLE items ADD COLUMN reco_reason TEXT;  -- 繁中推薦理由
CREATE UNIQUE INDEX IF NOT EXISTS items_external_id ON items(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS items_reco ON items(run_date, reco_score);
