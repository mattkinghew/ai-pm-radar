# Radar quota governor + source correction

Status: **PARTIAL** — local implementation and tests are complete; live paragraph-translation UI behavior was not browser-verified.

## 完成項目

- 自動分析改用 UTC 日別的 5 項預設上限與 provider 手動保留額度；只挑相關候選，短中文貼文先走零成本 `extractive`。
- Gemini 失敗會退回用量；只在 429、5xx、逾時時轉用 Workers AI。短文、`insufficient_content`、格式錯誤不會觸發後備模型。
- Capture、逐項翻譯、Reader 翻譯／總結和知識庫整理使用手動額度；保留現有人工審核 gate。
- `/api/ingest/x` 跳過停用 handle 並分開回報；sources 預設只列啟用來源，管理頁仍可查看和重新啟用停用來源。
- 新 migration 以停用方式修正三個 X 種子來源；未刪除來源或既有貼文。
- UI 分開顯示「自動分析 已用／上限（剩餘）」與「手動整理保留額度剩餘」。Reader 前端程式只在明確按「翻譯成中文／繼續翻譯」後 POST；重新開啟載入已保存結果不會重新扣額，但未做 live 瀏覽器點擊驗收，故標記 PARTIAL。

## 修改檔案

- `cloud/src/ai.mjs`
- `cloud/src/collector.mjs`
- `cloud/src/worker.mjs`
- `cloud/src/reader.mjs`
- `cloud/public/app.js`
- `cloud/wrangler.toml`
- `cloud/migrations/0009_quota_governor_source_correction.sql`
- `tests/cloud-worker.test.mjs`
- `tests/cloud-sources-x.test.mjs`
- `tests/helpers/cloud-fakes.mjs`
- `last-message.md`

## 驗證

- `node --test tests/cloud-worker.test.mjs tests/cloud-p1-reader.test.mjs tests/cloud-sources-x.test.mjs` — **28/28 PASS**。
- Scoped `git diff --check` — PASS。
- 未執行部署；migration 尚未套用到遠端 D1。

## 風險 / 注意

- migration 套用後，Jun 若仍使用舊硬編碼清單，已停用 handle 會被略過並計入 `skipped_disabled`。
- 今日已匯入的貼文不會刪除；抽取式短貼文之後不會由 cron 自動翻譯。
- 早上「今日焦點」的自動 AI 卡片數會明顯減少，剩餘項目由 owner 自行選擇使用手動額度。
- `AI_DAILY_CAP=10` 與 `WORKERS_AI_DAILY_CAP=100` 保持原值；沒有讀取 secrets／`.env*`。
- 未 commit。
