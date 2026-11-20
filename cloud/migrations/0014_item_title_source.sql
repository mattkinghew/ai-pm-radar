-- Record where an item's source-language title came from. NULL means historical provenance is unknown.
ALTER TABLE items ADD COLUMN title_source TEXT CHECK (
  title_source IS NULL OR title_source IN ('feed','og','page','x_text_truncation','user','synthesized','inferred')
);

-- X ingestion constructs its title from the post text; this is known from the existing source marker.
UPDATE items SET title_source='x_text_truncation'
WHERE title_source IS NULL AND (source LIKE 'x:@%' OR category='X_POST');

-- URL-reader titles have their own provenance because item.title may initially be a URL placeholder.
ALTER TABLE articles ADD COLUMN title_source TEXT CHECK (
  title_source IS NULL OR title_source IN ('feed','og','page','x_text_truncation','user','synthesized','inferred')
);
