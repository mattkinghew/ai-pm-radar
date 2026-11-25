-- Shared summary/translation provenance and an auditable, non-content error state.
ALTER TABLE items ADD COLUMN source_type TEXT CHECK (source_type IS NULL OR source_type IN ('rss','x_post','github_search','github_releases','youtube_channel','manual_text','selected_url','imported','official_adapter','api'));
UPDATE items SET source_type=CASE
  WHEN source LIKE 'x:@%' OR category='X_POST' THEN 'x_post'
  WHEN source='quick-capture' THEN CASE WHEN raw_excerpt IS NULL OR raw_excerpt='' THEN 'selected_url' ELSE 'manual_text' END
  WHEN category='GITHUB_PROJECT' THEN 'official_adapter'
  WHEN source='hn' THEN 'api'
  ELSE NULL
END WHERE source_type IS NULL;

ALTER TABLE items ADD COLUMN ai_model TEXT;
ALTER TABLE items ADD COLUMN analysis_basis TEXT CHECK (analysis_basis IS NULL OR analysis_basis IN ('from_excerpt','full_text','insufficient'));
ALTER TABLE items ADD COLUMN analysis_source_type TEXT;
ALTER TABLE items ADD COLUMN analysis_status TEXT CHECK (analysis_status IS NULL OR analysis_status IN ('pending','completed','skipped','failed','not_requested'));
ALTER TABLE items ADD COLUMN analysis_error_code TEXT;

UPDATE items SET analysis_status=CASE
  WHEN ai_provider='extractive' THEN 'not_requested'
  WHEN ai_provider IS NOT NULL THEN 'completed'
  ELSE 'pending'
END;

ALTER TABLE articles ADD COLUMN ai_model TEXT;
ALTER TABLE articles ADD COLUMN translation_model TEXT;
ALTER TABLE articles ADD COLUMN content_basis TEXT CHECK (content_basis IS NULL OR content_basis IN ('from_excerpt','full_text','insufficient'));
ALTER TABLE articles ADD COLUMN error_code TEXT;

UPDATE articles SET content_basis=CASE
  WHEN status='ok' THEN 'full_text'
  ELSE 'insufficient'
END;
