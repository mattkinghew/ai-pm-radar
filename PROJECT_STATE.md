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
