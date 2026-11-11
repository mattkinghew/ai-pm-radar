ALTER TABLE sources ADD COLUMN lane_default TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE sources ADD COLUMN weight INTEGER NOT NULL DEFAULT 0 CHECK (weight BETWEEN -2 AND 2);
ALTER TABLE sources ADD COLUMN include_keywords TEXT NOT NULL DEFAULT '[]';
ALTER TABLE sources ADD COLUMN exclude_keywords TEXT NOT NULL DEFAULT '[]';
ALTER TABLE sources ADD COLUMN max_per_day INTEGER NOT NULL DEFAULT 5 CHECK (max_per_day BETWEEN 1 AND 100);
ALTER TABLE sources ADD COLUMN ai_eligible INTEGER NOT NULL DEFAULT 0 CHECK (ai_eligible IN (0,1));
-- Keep the original CHECK-constrained type column intact; adapter_type adds new adapters safely.
ALTER TABLE sources ADD COLUMN adapter_type TEXT NOT NULL DEFAULT 'rss' CHECK (adapter_type IN ('rss','x','github_search','github_releases','youtube_channel'));

ALTER TABLE items ADD COLUMN lane TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE items ADD COLUMN pref_score REAL NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN pref_reasons TEXT NOT NULL DEFAULT '[]';
ALTER TABLE items ADD COLUMN published_at TEXT;
ALTER TABLE items ADD COLUMN claim_status TEXT NOT NULL DEFAULT 'unverified' CHECK (claim_status IN ('unverified','official_verified','refuted'));
ALTER TABLE items ADD COLUMN evidence_tier TEXT NOT NULL DEFAULT 'social' CHECK (evidence_tier IN ('official','primary','secondary','social'));
ALTER TABLE items ADD COLUMN review_status TEXT NOT NULL DEFAULT 'needs_review';
ALTER TABLE items ADD COLUMN injection_suspect INTEGER NOT NULL DEFAULT 0 CHECK (injection_suspect IN (0,1));
ALTER TABLE items ADD COLUMN action_14d TEXT;
ALTER TABLE items ADD COLUMN title_hash TEXT;
ALTER TABLE items ADD COLUMN ai_eligible INTEGER NOT NULL DEFAULT 1 CHECK (ai_eligible IN (0,1));
CREATE INDEX IF NOT EXISTS items_title_hash ON items(title_hash) WHERE title_hash IS NOT NULL;

UPDATE items SET lane='TECH_NEWS' WHERE category='AI_TECH_NEWS';
UPDATE items SET lane='FREE_RESOURCE' WHERE category='FREEBIE_CERT_DEAL';
UPDATE items SET lane='APPLY_NOW' WHERE category='AI_PRACTICE';
UPDATE items SET lane='OTHER' WHERE category='CAPTURE';
CREATE INDEX IF NOT EXISTS items_lane_score ON items(lane, pref_score DESC, created_at DESC);
