# Goal 07：知識庫 FTS5 全文搜尋

## 背景
`GET /api/kb?q=` 而家用 LIKE，筆記多過幾千篇就會慢，冇排名，中文都唔會斷詞。

## 目標
- 新 migration：`kb_fts` virtual table（fts5，tokenize='trigram'，中英都用得），以 trigger 同 kb_entries 同步，同時包埋 highlights 同 articles 全文。
- 改 `/api/kb`：q 長度 ≥ 3 用 MATCH 加 bm25 排序，短過 3 照舊用 LIKE；結果加 snippet() 高亮。
- 要先確認 D1 支援 fts5 trigram（local 同 remote 都要試）。

## 驗收
用 fakeD1（node:sqlite）測試；由 500 篇 seed 做 benchmark。
