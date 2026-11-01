-- P0: richer actions, mutes, URL-normalized dedup, knowledge base in D1.
ALTER TABLE items ADD COLUMN url_norm TEXT;                         -- normalized URL for cross-source dedup
ALTER TABLE items ADD COLUMN starred INTEGER NOT NULL DEFAULT 0;    -- 收藏入知識庫
ALTER TABLE items ADD COLUMN read_later INTEGER NOT NULL DEFAULT 0; -- 稍後讀
ALTER TABLE items ADD COLUMN dismissed_reason TEXT;                 -- 唔感興趣原因 (hidden from home feed)
CREATE INDEX IF NOT EXISTS items_url_norm ON items(url_norm);
CREATE INDEX IF NOT EXISTS items_read_later ON items(read_later, updated_at);

CREATE TABLE IF NOT EXISTS item_actions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('star','unstar','read_later','unread_later','not_interested','restore')),
  reason TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS item_actions_item ON item_actions(item_id, created_at);

CREATE TABLE IF NOT EXISTS mutes (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('topic','keyword','handle')),
  value TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS mutes_kind_value ON mutes(kind, value);

CREATE TABLE IF NOT EXISTS kb_entries (
  id TEXT PRIMARY KEY,
  item_id TEXT UNIQUE,
  title TEXT NOT NULL,
  url TEXT,
  source TEXT,
  category TEXT,
  summary TEXT,
  key_points TEXT,   -- JSON array
  tags TEXT,         -- JSON array
  note TEXT,
  score REAL,
  origin TEXT NOT NULL DEFAULT 'star' CHECK (origin IN ('star','approved','manual')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS kb_updated ON kb_entries(updated_at);

-- Backfill: already-approved items become KB entries.
INSERT OR IGNORE INTO kb_entries(id,item_id,title,url,source,category,summary,key_points,tags,note,score,origin,created_at,updated_at)
  SELECT lower(hex(randomblob(16))), id, COALESCE(title_zh, title), url, source, category, summary, key_points, '[]', NULL, score, 'approved', created_at, updated_at
  FROM items WHERE status='approved';
