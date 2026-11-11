# AI PM Radar Research Lanes QA

日期：2026-11-10｜範圍：Worker / D1 cloud app 的 Research Lanes；本地合成驗收

## 結果

| 項目 | 狀態 | 證據 / 限制 |
|---|---|---|
| 九個固定 lane、規則表與偏好分數 | DONE | `LANE_RULES` 同時供 lane 指派及權重評分。權重：商業需求 +25、Agent 治理 +20、內容工作流 +15、官方免費資源/低成本算力 +10、hype -20、高風險搬運/未核實網安歸因 -30。每一來源權重為 -2..+2（每級 5 分）；已知發布日使用 `max(-10, 10-ageDays)`，未知發布日保持 Unknown 並記 `freshness_unknown`。原因以 rule ID 保存。 |
| Lane tabs、Top N、archive、14 日行動列 | DONE | UI 支援 5/10/20/All、lane tabs 與負分 archive。行動列優先顯示 Owner 欄位；無欄位時從 extractive 摘要取首句，資料不足顯示待補。 |
| Per-source 設定與 API 驗證 | DONE | lane、weight、include/exclude keywords、max_per_day、ai_eligible 可新增與編輯；測試涵蓋權重邊界與設定保存。既有 `sources.type` CHECK 保持原狀；新 adapter 名稱存在 additive `adapter_type`。 |
| GitHub Search / Releases、YouTube 官方 Atom | DONE | 使用官方端點；測試含 GitHub repository metadata、release、YouTube Atom 及 GitHub 403。請求 timeout 10 秒，併發最多 6；每次 run 最多 30 個新增 adapter request。使用者來源的每日項目上限由 `max_per_day` 檢查。 |
| 每來源錯誤記錄 | DONE | 單一來源錯誤不終止收集；錯誤摘要寫入該次 `runs.error` JSON，並回傳 `sourceErrors`。 |
| Capture store-first / Source Inbox import | DONE | Capture 不抓取 URL、不呼叫 AI；37 筆合成 SourceInput 全數入庫，9 筆 URL-only 留在 `NEEDS_SOURCE_REVIEW`，URL 與標題 hash 去重。欄位 `review_status` 承載此狀態，既有受 CHECK 限制的 `items.status` 保持 `draft`。 |
| AI 深讀與配額 | DONE | Owner 手動按「AI 深讀」才呼叫現有 provider；合成測試確認一次成功分析消耗一個 Gemini manual reserve。Cron 自動分析仍受既有 `AI_AUTO_ANALYZE_LIMIT` 與 provider cap 約束；新來源 `ai_eligible` 預設 0。 |
| Injection / claims / evidence 欄位 | DONE | 三組合成注入內容均標記 `injection_suspect=1`、`claim_status=unverified`；prompt 將來源標成不可信資料，不將指令轉為動作。無真實資料或外部指令執行。 |
| Digest | DONE | `/api/digest?days=7` 回傳每 lane 最多 3 筆，明示 `ai_calls: 0`。 |
| Owner Top-10 偏好校準 | PARTIAL | 規則及權重來自 preference summary；匯入測試固定採合成內文，未以 37 筆原文做排序比對，也未做 Owner 人工 relevance 標注，因此不宣稱 Top-10 已校準。 |
| 完整 Worker HTTP smoke | BLOCKED | `npm run cloud:dev` 在 sandbox 內因無權寫 Wrangler 使用者 log 及無法 bind `localhost:8787` 結束；未改用遠端 Worker。路由/資料庫行為以合成 Worker 測試覆蓋。 |

## 驗證

- `npm test`：PASS，286 tests / 286 passed（最後加入 adapter success test 後請以本輪實際結果為準）。
- `node --test tests/cloud-lanes.test.mjs tests/cloud-worker.test.mjs`：PASS。
- `node --check cloud/src/{collector,curation,worker,ai}.mjs` 及 `node --check cloud/public/app.js`：PASS。
- Scoped `git diff --check`：PASS。
- `npx wrangler d1 migrations apply ai-pm-radar --local --config cloud/wrangler.toml`：PASS；本機 D1 套用 0009 與 0010。沒有使用 `--remote`。
- `npm run cloud:dev`：BLOCKED，sandbox 不允許本機 port bind；Wrangler log 寫入使用者目錄亦回報 EPERM。

## Migration SQL（0010）

```sql
ALTER TABLE sources ADD COLUMN lane_default TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE sources ADD COLUMN weight INTEGER NOT NULL DEFAULT 0 CHECK (weight BETWEEN -2 AND 2);
ALTER TABLE sources ADD COLUMN include_keywords TEXT NOT NULL DEFAULT '[]';
ALTER TABLE sources ADD COLUMN exclude_keywords TEXT NOT NULL DEFAULT '[]';
ALTER TABLE sources ADD COLUMN max_per_day INTEGER NOT NULL DEFAULT 5 CHECK (max_per_day BETWEEN 1 AND 100);
ALTER TABLE sources ADD COLUMN ai_eligible INTEGER NOT NULL DEFAULT 0 CHECK (ai_eligible IN (0,1));
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
UPDATE items SET lane='TECH_NEWS' WHERE category='AI_TECH_NEWS';
UPDATE items SET lane='FREE_RESOURCE' WHERE category='FREEBIE_CERT_DEAL';
UPDATE items SET lane='APPLY_NOW' WHERE category='AI_PRACTICE';
UPDATE items SET lane='OTHER' WHERE category='CAPTURE';
```

Migration also adds indexes for lane ranking and title-hash lookup. It does not drop columns or delete rows. The repository source CHECK constraint is preserved; `adapter_type` adds new adapter values without rebuilding the table.

## Side effects / limits

- Local Wrangler D1 state only was migrated. No remote migration, deploy, publish, schedule change, or Git commit/push occurred.
- GitHub and YouTube adapter tests use mocked responses; no live external request was issued. `GITHUB_TOKEN` is read only as a Worker binding and is not written to Wrangler config or logs.
- No dependency was added and no AI vendor/cap was changed.
- The synthetic fixture preserves input shape and source identifiers but replaces saved body text with synthetic text; it is not a research result or Owner ranking acceptance.

未 commit、push、merge 或 deploy。
