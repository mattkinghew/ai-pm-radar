-- 新變現機會 flag + Matt's initial X watchlist (2026-11-01). INSERT OR IGNORE keeps user edits.
ALTER TABLE items ADD COLUMN side_income_new INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN side_income_reason TEXT;
INSERT OR IGNORE INTO sources(id,type,value,label,enabled,created_at,updated_at) VALUES
 ('seed-x-wangdaso','x','@Wangdaso','大叔｜港卡出海・AI羊毛',1,'2026-11-01T00:00:00Z','2026-11-01T00:00:00Z'),
 ('seed-x-miles_mazy','x','@miles_mazy','Miles Ma｜FDE・企業AI落地',1,'2026-11-01T00:00:00Z','2026-11-01T00:00:00Z'),
 ('seed-x-goan999999','x','@goan999999','G哥｜AI PM・AI×Web3',1,'2026-11-01T00:00:00Z','2026-11-01T00:00:00Z'),
 ('seed-x-haoge6699','x','@haoge6699','闖蕩大叔｜開源工具・資源',1,'2026-11-01T00:00:00Z','2026-11-01T00:00:00Z'),
 ('seed-x-mileson07','x','@Mileson07','超級峰｜AI自媒體・企業培訓',1,'2026-11-01T00:00:00Z','2026-11-01T00:00:00Z'),
 ('seed-x-laobaishare','x','@laobaishare','老白｜每日AI乾貨・副業',1,'2026-11-01T00:00:00Z','2026-11-01T00:00:00Z');
