-- Phase 1.2 candidate. LOCAL ONLY. Do not run on existing remote D1
-- without a separate migration and backup authorization.
-- Every table is explicitly owner-scoped: D1 does NOT offer PostgreSQL RLS.
-- Actual Worker API MUST check a verified Cloudflare Access identity for
-- every read/write and never trust a client-supplied owner_sub.
CREATE TABLE IF NOT EXISTS cloud_source_heads (
  owner_sub TEXT NOT NULL,
  source_id TEXT NOT NULL,
  current_revision INTEGER NOT NULL CHECK (current_revision >= 1),
  current_fingerprint TEXT NOT NULL CHECK (length(current_fingerprint) = 64),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_sub, source_id)
);

CREATE TABLE IF NOT EXISTS cloud_source_revisions (
  owner_sub TEXT NOT NULL,
  source_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  content_fingerprint TEXT NOT NULL CHECK (length(content_fingerprint) = 64),
  source_record_json TEXT NOT NULL CHECK (json_valid(source_record_json)),
  changed_at TEXT NOT NULL,
  PRIMARY KEY (owner_sub, source_id, revision),
  FOREIGN KEY (owner_sub, source_id)
    REFERENCES cloud_source_heads(owner_sub, source_id)
);

CREATE TABLE IF NOT EXISTS cloud_source_review_events (
  event_id TEXT NOT NULL,
  owner_sub TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
  content_fingerprint TEXT NOT NULL CHECK (length(content_fingerprint) = 64),
  action TEXT NOT NULL CHECK (action IN (
    'captured', 'edited', 'reviewed', 'rejected',
    'approved_for_daily', 'approved_for_reuse'
  )),
  acted_at TEXT NOT NULL,
  PRIMARY KEY (owner_sub, event_id),
  FOREIGN KEY (owner_sub, source_id, source_revision)
    REFERENCES cloud_source_revisions(owner_sub, source_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_cloud_source_heads_updated
  ON cloud_source_heads(owner_sub, updated_at);
CREATE INDEX IF NOT EXISTS idx_cloud_review_history
  ON cloud_source_review_events(owner_sub, source_id, source_revision);

-- Immutable library version. This table does NOT auto-populate on Daily approval.
-- The application must validate Source Library v4, explicit reuse approval and
-- matching CURRENT source fingerprint BEFORE inserting a snapshot.
CREATE TABLE IF NOT EXISTS cloud_library_snapshots (
  owner_sub TEXT NOT NULL,
  source_id TEXT NOT NULL,
  approved_source_revision INTEGER NOT NULL,
  content_fingerprint TEXT NOT NULL CHECK (length(content_fingerprint) = 64),
  library_entry_json TEXT NOT NULL CHECK (json_valid(library_entry_json)),
  approved_at TEXT NOT NULL,
  PRIMARY KEY (owner_sub, source_id, approved_source_revision),
  FOREIGN KEY (owner_sub, source_id, approved_source_revision)
    REFERENCES cloud_source_revisions(owner_sub, source_id, revision)
);

-- Prevent accidental mutation of historical revisions/events/snapshots.
CREATE TRIGGER IF NOT EXISTS immutable_cloud_source_revisions_update
  BEFORE UPDATE ON cloud_source_revisions BEGIN SELECT RAISE(ABORT, 'immutable revision'); END;
CREATE TRIGGER IF NOT EXISTS immutable_cloud_source_revisions_delete
  BEFORE DELETE ON cloud_source_revisions BEGIN SELECT RAISE(ABORT, 'immutable revision'); END;
CREATE TRIGGER IF NOT EXISTS immutable_cloud_source_events_update
  BEFORE UPDATE ON cloud_source_review_events BEGIN SELECT RAISE(ABORT, 'immutable event'); END;
CREATE TRIGGER IF NOT EXISTS immutable_cloud_source_events_delete
  BEFORE DELETE ON cloud_source_review_events BEGIN SELECT RAISE(ABORT, 'immutable event'); END;
CREATE TRIGGER IF NOT EXISTS immutable_cloud_library_snapshots_update
  BEFORE UPDATE ON cloud_library_snapshots BEGIN SELECT RAISE(ABORT, 'immutable library'); END;
CREATE TRIGGER IF NOT EXISTS immutable_cloud_library_snapshots_delete
  BEFORE DELETE ON cloud_library_snapshots BEGIN SELECT RAISE(ABORT, 'immutable library'); END;
