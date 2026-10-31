-- Phase 1.5A standalone local simulation; DO NOT apply to the Phase13 real D1.
-- MULTI-ARTICLE, OWNER-SCOPED. Needs an explicit independent Cloudflare D1
-- authorization and retention assessment before ANY real source deployment.
PRAGMA foreign_keys=ON;
CREATE TABLE sync_documents (
 owner_sub TEXT NOT NULL,
 source_id TEXT NOT NULL CHECK(source_id GLOB 'src_*'),
 current_revision INTEGER NOT NULL CHECK(current_revision>0),
 content_sha256 TEXT NOT NULL CHECK(length(content_sha256)=64),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 purge_due_at TEXT NOT NULL,
 PRIMARY KEY (owner_sub,source_id)
);
CREATE TABLE sync_revisions (
 owner_sub TEXT NOT NULL,
 source_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 content_sha256 TEXT NOT NULL CHECK(length(content_sha256)=64),
 source_record_json TEXT NOT NULL CHECK(json_valid(source_record_json)),
 updated_at TEXT NOT NULL,
 PRIMARY KEY(owner_sub,source_id,revision),
 FOREIGN KEY(owner_sub,source_id) REFERENCES sync_documents(owner_sub,source_id) ON DELETE CASCADE
);
CREATE TABLE sync_events (
 owner_sub TEXT NOT NULL,
 source_id TEXT NOT NULL,
 revision INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('created','edited')),
 occurred_at TEXT NOT NULL,
 PRIMARY KEY(owner_sub,source_id,revision),
 FOREIGN KEY(owner_sub,source_id,revision) REFERENCES sync_revisions(owner_sub,source_id,revision) ON DELETE CASCADE
);
CREATE INDEX sync_document_expiry ON sync_documents(purge_due_at);
CREATE INDEX sync_document_owner ON sync_documents(owner_sub);
CREATE TRIGGER sync_revisions_immutable BEFORE UPDATE ON sync_revisions
BEGIN SELECT RAISE(ABORT,'immutable source revision'); END;
CREATE TRIGGER sync_events_immutable BEFORE UPDATE ON sync_events
BEGIN SELECT RAISE(ABORT,'immutable source event'); END;
