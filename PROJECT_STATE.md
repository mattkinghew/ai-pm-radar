# AI PM Radar — G00 證據帳本（2026-11-25 結案）

## 1. 本機與 Repo 狀態（已同步）
- **Repo 路徑**：`/Users/mattgor/Documents/Daily/ai-pm-radar`
- **分支**：`feat/cloudflare-cloud`（已對齊 `origin/feat/cloudflare-cloud`）
- **本機測試基線**：`npm test`（`ai-pm-radar@0.4.1-rc.0`）**381 / 381 pass、0 fail**

## 2. 遠端生產狀態（2026-11-25 已上線並驗收通過）
- **Wrangler Profile**：`personal`（已綁定專案目錄，保留公司預設帳號）
- **線上 Worker**：`ai-pm-radar-cloud`，Version ID `5df5fc1e-16f1-4614-98c7-65233d5b9a37`（`radar-cloud.lamlab.cc`）
- **遠端 D1**：`ai-pm-radar` 已套用至 `0018_x_original_text.sql`（`No migrations to apply`）；快照備份於 `/tmp/ai-pm-radar-d1-backup-2026-11-25.sql`（3.0M）
- **排程與配額**：Cloudflare Cron `0 0 * * *`（08:00 HKT）；本機 LaunchAgent `com.ai-pm-radar.research` 維持關閉（`schedule.enabled: false`）
- **UAT 驗收**：瀏覽器 Cloudflare Access 登入、介面載入與 Threads Pilot 10 筆 KB 匯入（0 AI 消耗）皆通過

## 3. 2026-11-28 帳本更新（唔取代第 1–2 節 G00 結案證據）

- 本機 HEAD：`fd05b4b`（2026-11-27 13:22 HKT），分支仍對齊 `origin/feat/cloudflare-cloud`，但工作樹有已修改同大量未追蹤檔（含 `.playwright-cli/` 傾印、`*.bak`、本地 `data/daily/` 等，唔應全部提交）。
- G00 之後已提交、生產部署狀態 Unknown：`rsshub://`、公開 `/showcase`、Daily／Weekly Digest、OpenRouter free routing、G6 Telegram digest／webhook、G7 批次入庫 API 同本機 pusher。
- 線上 Worker 最後已驗收生產身分仍係 2026-11-25 嘅 `ai-pm-radar-cloud` version `5df5fc1e-16f1-4614-98c7-65233d5b9a37`（`radar-cloud.lamlab.cc`）。其後提交有無再部署：Unknown。未獲 Owner 明示批准前唔 deploy。
- **現行阻擋（G6）**：2026-11-28 11:24（香港時間）無 Header POST `https://radar-cloud.lamlab.cc/api/webhooks/telegram` → `HTTP/2 503` `{"error":"telegram_not_configured"}`。請求已到 Worker，唔係 Access 302。Secret 只可由 Owner 喺預設環境執行 `npx wrangler secret put … --config cloud/wrangler.toml`（唔加 `--env`）；Agent 不得接收或代填 Token／Chat ID／Webhook Secret。端點穩定回 `401` 之後先 `setWebhook`，再開 G6／G7 驗收。
