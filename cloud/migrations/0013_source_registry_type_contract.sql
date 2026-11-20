-- Keep the legacy source type and adapter type columns aligned for every supported adapter.
-- Data is copied in full. Legacy X rows are recognized from either column and normalized to X.
ALTER TABLE sources RENAME TO sources_legacy;

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('rss','x','github_search','github_releases','youtube_channel')),
  value TEXT NOT NULL,
  label TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  lane_default TEXT NOT NULL DEFAULT 'OTHER',
  weight INTEGER NOT NULL DEFAULT 0 CHECK (weight BETWEEN -2 AND 2),
  include_keywords TEXT NOT NULL DEFAULT '[]',
  exclude_keywords TEXT NOT NULL DEFAULT '[]',
  max_per_day INTEGER NOT NULL DEFAULT 5 CHECK (max_per_day BETWEEN 1 AND 100),
  ai_eligible INTEGER NOT NULL DEFAULT 0 CHECK (ai_eligible IN (0,1)),
  adapter_type TEXT NOT NULL DEFAULT 'rss' CHECK (adapter_type IN ('rss','x','github_search','github_releases','youtube_channel'))
);

INSERT INTO sources(id,type,value,label,enabled,created_at,updated_at,lane_default,weight,include_keywords,exclude_keywords,max_per_day,ai_eligible,adapter_type)
SELECT id,
  CASE WHEN type='x' OR adapter_type='x' THEN 'x' ELSE adapter_type END,
  value,label,enabled,created_at,updated_at,lane_default,weight,include_keywords,exclude_keywords,max_per_day,ai_eligible,
  CASE WHEN type='x' OR adapter_type='x' THEN 'x' ELSE adapter_type END
FROM sources_legacy;

DROP TABLE sources_legacy;
CREATE INDEX sources_type_value ON sources(type, value);
CREATE TRIGGER sources_unique_adapter_insert BEFORE INSERT ON sources
WHEN EXISTS (SELECT 1 FROM sources WHERE type=NEW.type AND lower(value)=lower(NEW.value))
BEGIN
  SELECT RAISE(IGNORE);
END;

-- Manual rollback mapping: rebuild the legacy table with CHECK(type IN ('rss','x')) and
-- copy every row back using type=CASE WHEN adapter_type='x' THEN 'x' ELSE 'rss' END;
-- Keep adapter_type unchanged so the canonical adapter identity remains recoverable. Preserve
-- every row and the non-unique lookup index; do not recreate the old unique index if legacy rows
-- collide after canonicalization. Re-add the insert trigger against the legacy (type,value) pair.
