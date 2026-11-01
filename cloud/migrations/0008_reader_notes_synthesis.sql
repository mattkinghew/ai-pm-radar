-- P1: reader view cache (full text + translation + summary), highlights, KB note/synthesis types.
CREATE TABLE IF NOT EXISTS articles (
  item_id TEXT PRIMARY KEY,
  url TEXT,
  status TEXT NOT NULL CHECK (status IN ('ok','paywall','failed')),
  title TEXT,
  byline TEXT,
  site TEXT,
  paragraphs TEXT,          -- JSON [{tag,text}]
  chars INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  translation TEXT,         -- JSON string[] aligned with paragraphs (繁中)
  translated_chunks INTEGER NOT NULL DEFAULT 0,
  total_chunks INTEGER NOT NULL DEFAULT 0,
  summary TEXT,             -- JSON {tldr,key_points,why_ai_pm,why_side_income,actions}
  ai_provider TEXT,
  fetched_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS highlights (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  text TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS highlights_item ON highlights(item_id, created_at);
ALTER TABLE kb_entries ADD COLUMN kb_type TEXT NOT NULL DEFAULT 'item'; -- item | note | synthesis
ALTER TABLE kb_entries ADD COLUMN source_ids TEXT;                     -- JSON kb ids (synthesis)
CREATE INDEX IF NOT EXISTS kb_type ON kb_entries(kb_type, updated_at);
