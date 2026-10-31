-- Score reason + lightweight feedback weights for retrieval learning.
ALTER TABLE items ADD COLUMN score_reason TEXT;
CREATE TABLE IF NOT EXISTS feedback_weights (
  key TEXT PRIMARY KEY,
  weight REAL NOT NULL DEFAULT 0,
  pos INTEGER NOT NULL DEFAULT 0,
  neg INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS items_score_run ON items(run_date, score);
