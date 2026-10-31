-- Synthetic Phase 1.0 PoC only; not a production migration or full SourceRecord schema.
CREATE TABLE IF NOT EXISTS source_items (
  owner_sub TEXT NOT NULL,
  source_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  record_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  review_state TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (review_state IN ('needs_review','reviewed','rejected')),
  reviewed_fingerprint TEXT,
  approved_fingerprint TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_sub, source_id)
);
CREATE INDEX IF NOT EXISTS idx_sources_owner_updated ON source_items(owner_sub, updated_at);
