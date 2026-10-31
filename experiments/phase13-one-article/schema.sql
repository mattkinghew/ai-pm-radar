-- LOCAL SIMULATION ONLY: prospective isolated one-real-article D1 schema.
-- DO NOT APPLY to existing synthetic D1 or create live DB without new consent.
-- D1 has no RLS. The future authenticated Worker must parameterize owner_sub
-- from verified CF Access context on EVERY read/write/deletion.
PRAGMA foreign_keys=ON;
CREATE TABLE pilot_documents (
  owner_sub TEXT NOT NULL,
  source_id TEXT NOT NULL,
  current_revision INTEGER NOT NULL CHECK (current_revision>=1),
  content_sha256 TEXT NOT NULL CHECK (length(content_sha256)=64),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  purge_due_at TEXT NOT NULL,
  PRIMARY KEY (owner_sub,source_id),
  UNIQUE (owner_sub) -- strict one live pilot article per Owner
);
CREATE TABLE pilot_revisions (
  owner_sub TEXT NOT NULL,
  source_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision>=1),
  content_sha256 TEXT NOT NULL CHECK (length(content_sha256)=64),
  source_record_json TEXT NOT NULL CHECK(json_valid(source_record_json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_sub,source_id,revision),
  FOREIGN KEY(owner_sub,source_id) REFERENCES pilot_documents(owner_sub,source_id) ON DELETE CASCADE
);
CREATE TABLE pilot_review_events (
  owner_sub TEXT NOT NULL,
  source_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('created','edited','reviewed','approved_for_daily','approved_for_reuse')),
  occurred_at TEXT NOT NULL,
  PRIMARY KEY(owner_sub,source_id,revision),
  FOREIGN KEY(owner_sub,source_id,revision) REFERENCES pilot_revisions(owner_sub,source_id,revision) ON DELETE CASCADE
);
CREATE INDEX pilot_purge_deadline_idx ON pilot_documents(purge_due_at);
-- Revisions/events cannot be modified in place; explicit owner-scoped
-- parent purge cascades their removal. Admin/raw D1 SQL bypasses application
-- access controls and must NOT be exposed through an API.
CREATE TRIGGER pilot_revisions_no_update BEFORE UPDATE ON pilot_revisions
BEGIN SELECT RAISE(ABORT,'immutable pilot revision'); END;
CREATE TRIGGER pilot_events_no_update BEFORE UPDATE ON pilot_review_events
BEGIN SELECT RAISE(ABORT,'immutable pilot event'); END;
