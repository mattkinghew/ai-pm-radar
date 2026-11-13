-- Conditional GET validators for built-in feeds and configured source adapters.
CREATE TABLE IF NOT EXISTS source_http_cache (
  source_key TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  etag TEXT,
  last_modified TEXT,
  updated_at TEXT NOT NULL
);
