ALTER TABLE sources ADD COLUMN canonical_value TEXT;
ALTER TABLE sources ADD COLUMN opml_category TEXT;
UPDATE sources SET canonical_value=lower(trim(value)) WHERE canonical_value IS NULL;
CREATE UNIQUE INDEX sources_adapter_canonical ON sources(adapter_type,canonical_value) WHERE canonical_value IS NOT NULL;

CREATE TABLE source_import_jobs (
  id TEXT PRIMARY KEY,
  format TEXT NOT NULL CHECK (format IN ('text','opml','csv')),
  status TEXT NOT NULL CHECK (status IN ('queued','running','partial','completed','cancelled')),
  total INTEGER NOT NULL CHECK (total BETWEEN 0 AND 100),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE source_import_rows (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES source_import_jobs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  adapter_type TEXT NOT NULL CHECK (adapter_type IN ('rss','x','github_search','github_releases','youtube_channel')),
  value TEXT NOT NULL,
  label TEXT,
  opml_category TEXT,
  canonical_value TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','added','exists','duplicate_in_batch','invalid','failed')),
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(job_id,position)
);
CREATE INDEX source_import_rows_job_status ON source_import_rows(job_id,status,position);
