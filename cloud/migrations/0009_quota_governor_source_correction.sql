-- Track quota pool ownership and daily auto-analyze items (UTC quota boundary).
ALTER TABLE ai_usage_provider ADD COLUMN manual_calls INTEGER NOT NULL DEFAULT 0;
-- Conservatively classify pre-migration calls as manual; their original pool is unknown.
UPDATE ai_usage_provider SET manual_calls=calls;
CREATE TABLE IF NOT EXISTS ai_auto_usage (
  day TEXT PRIMARY KEY,
  items INTEGER NOT NULL DEFAULT 0
);
-- If quota was already spent today, hold auto-analysis until the next UTC quota day.
INSERT OR IGNORE INTO ai_auto_usage(day,items)
SELECT date('now'),5 WHERE EXISTS (SELECT 1 FROM ai_usage_provider WHERE day=date('now'));

-- Disable off-topic seeded accounts without deleting them, so the owner can re-enable them.
UPDATE sources SET enabled=0
WHERE id IN ('seed-x-wangdaso','seed-x-ai_dvd6','seed-x-goan999999');
