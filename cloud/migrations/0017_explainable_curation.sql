ALTER TABLE items ADD COLUMN pref_breakdown TEXT NOT NULL DEFAULT '{}';
ALTER TABLE items ADD COLUMN curation_status TEXT NOT NULL DEFAULT 'main' CHECK (curation_status IN ('main','quarantine','released'));
ALTER TABLE items ADD COLUMN curation_reason TEXT;

-- Historical records without a mapped lane, and records already flagged as untrusted, remain recoverable in quarantine.
UPDATE items SET curation_status='quarantine', curation_reason=CASE WHEN injection_suspect=1 THEN 'injection_suspect' ELSE 'relevance_unknown' END
WHERE lane='OTHER' OR injection_suspect=1;

CREATE TABLE item_curation_actions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('release_quarantine')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX item_curation_actions_item ON item_curation_actions(item_id, created_at);
