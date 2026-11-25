# AI PM Radar — G00 證據帳本（2026-11-25 更新）

> 依據交接文件與 2026-11-24 至 2026-11-25 唯讀實測整理；尚未核實之項目仍明確標示為 Unknown。

## 1. 本機與 Repo 狀態（已核實）
- **Repo 路徑**：`/Users/mattgor/Documents/Daily/ai-pm-radar`（軟連結 `~/workspace/ai-pm-radar`）
- **分支與 Commit**：`feat/cloudflare-cloud`，相對 `origin/feat/cloudflare-cloud` ahead 13，HEAD `1725db5`
- **工作區狀態**：28 個已追蹤檔案修改（`+1432 / -193`）、含 `cloud/migrations/0015`–`0018` 與 `docs/qa/T216_*.md` 等未追蹤檔；尚未執行 `git commit` / `git push`
- **本機測試基線**：`npm test`（`ai-pm-radar@0.4.1-rc.0`）共 **381 / 381 pass、0 fail**

## 2. 遠端生產與認證狀態（2026-11-25 已核實）
- **Wrangler 認證隔離**：已建立 `personal` profile 並綁定至專案目錄（保留公司預設登入）
- **線上 Worker 版本**：`ai-pm-radar-cloud`，最新部署為 `2026-11-08T06:43:42Z`，版本 ID `a546bd8d-06d6-4470-95d5-93540d863d0a`
- **遠端 D1 狀態**：`database_name = "ai-pm-radar"`，目前停留在 `0009`；**待套用共 9 份 migration**（`0010_research_lanes.sql` 至 `0018_x_original_text.sql`）
- **排程設計**：Cloudflare Cron `0 0 * * *`（08:00 HKT）；本機 LaunchAgent `com.ai-pm-radar.research` 目前 `not running`（`config.json` 中 `schedule.enabled: false`，歷史 `launchctl` 狀態曾為 `78`）

## 3. 尚未核實／待拍板項目（Unknown / Pending Approval）
- 遠端部署放行：需明確批准後，始得依序執行 `git commit` → `wrangler d1 migrations apply ai-pm-radar --remote` → `wrangler deploy`
- 瀏覽器／iPhone 視覺 UAT 與生產端 Cloudflare Access 實際頁面驗收
- 上游 Gemini 模型間歇性 `provider_service_unavailable` 之長期穩定性觀察
