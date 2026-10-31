-- Bilingual fields + per-provider daily AI usage (UTC day, matches Workers AI reset 00:00 UTC = 08:00 HKT).
ALTER TABLE items ADD COLUMN title_zh TEXT;
ALTER TABLE items ADD COLUMN title_original TEXT;
ALTER TABLE items ADD COLUMN summary_en TEXT;
ALTER TABLE items ADD COLUMN key_points_en TEXT; -- JSON array
CREATE TABLE IF NOT EXISTS ai_usage_provider (day TEXT NOT NULL, provider TEXT NOT NULL, calls INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, provider));
