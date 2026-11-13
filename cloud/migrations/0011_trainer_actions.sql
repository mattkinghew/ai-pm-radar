-- Preserve existing actions while allowing explicit, auditable preference training.
CREATE TABLE item_actions_new (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('star','unstar','read_later','unread_later','not_interested','restore','train_up','train_down')),
  reason TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO item_actions_new SELECT id,item_id,action,reason,created_at FROM item_actions;
DROP TABLE item_actions;
ALTER TABLE item_actions_new RENAME TO item_actions;
CREATE INDEX item_actions_item ON item_actions(item_id, created_at);
