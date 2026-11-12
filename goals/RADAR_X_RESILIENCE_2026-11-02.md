# Goals — Radar 每日更新韌性（唔依賴 Grok Bot 用量）— 2026-11-02

> 喺 repo 根目錄用 Codex 執行。先讀 `AGENTS.md`、現有 `docs/`、`cloud/wrangler.toml`、`scripts/daily_radar_collector.mjs`。
> **唔好** reset / stash / clean；工作樹極髒。**唔好** push、deploy、改 Cloudflare Access、讀印 secrets。

## Context（事實）
- Cloud Worker `ai-pm-radar-cloud` 已有 cron `0 0 * * *`（08:00 HKT）跑 RSS／日常收集；X 帖靠外部 ingest `POST /api/ingest/x`。
- Grok Bot 排程「Radar 每朝抓 X 帖文」用免費 X 讀取 → `/workspace/radar-x-ingest/ingest.mjs`；2026-11-02 因 Grok Bot **用量用盡**失敗（唔係 Radar API 壞）。
- Owner 要求：用 Codex CLI 做下一版，令**就算 Grok Bot 用量用盡都可以持續更新**。
- Canonical repo：`/Users/mattgor/Documents/Daily/ai-pm-radar`，branch `feat/cloudflare-cloud`（ahead of origin；HEAD 以 `git log -1` 為準）。**唔好 commit**，除非 Owner 之後明確批准。

## Scope
1. **本機可獨立跑嘅每日非 X 收集**：令 `scripts/daily_radar_collector.mjs`（或 cloud collector 對應本機入口）可以用 **fixture 或已允許嘅 RSS** 喺 Mac 產出當日 `data/daily/<YYYY-MM-DD>.json`，並通過現有 `validate:daily`（若 script 名唔同，用 package.json 入面實際 script）。
2. **launchd 計劃（只出文件 + 未 load 嘅 plist 範本）**：`docs/ops/DAILY_UPDATE_WITHOUT_GROK_BOT.md` + `ops/launchd/com.lamlab.radar.daily-local.plist.example`，指向 canonical repo；寫明 log 路徑、失敗時點樣知、同現有舊 rc3 launchd 嘅關係；**唔執行 launchctl load**。
3. **X 路徑邊界寫清楚**：文件內用 Completed/Partial/Blocked 標明——X 公開讀取目前仍依賴 Grok Bot 免費工具；本機 Codex／launchd **唔可以**擅自用 scrapers、唔可以要求 Owner 貼 X API key。列出 Owner 若要 X 亦離線可用時嘅選項（只列選項，唔實作付費 API）。
4. **Drop-folder ingest（可選實作，本機 only）**：若已存在 CF Access client 憑證／ingest token 喺 Owner 本機慣用位置，寫一個 **唔打印 secret** 嘅 `scripts/ingest-x-batch-local.mjs`：讀 `~/radar-x-drop/batch.json` → POST `https://radar-cloud.lamlab.cc/api/ingest/x`；無憑證則只寫 stub + README，狀態 Blocked／Planned。唔新造／唔索取 secret。
5. **簡短 QA 證據**：`docs/qa/DAILY_LOCAL_RESILIENCE_2026-11-02.md`——命令、結果、日期、commit、邊啲係本機證據 vs cloud。

## Acceptance Criteria
- [ ] `docs/ops/DAILY_UPDATE_WITHOUT_GROK_BOT.md` 存在，分清：RSS／日常收集（可離 Grok Bot）vs X ingest（仍依 Grok Bot，除非 Owner 另批來源）。
- [ ] 未 load 嘅 plist.example 指向 canonical path；有 before/after、log、rollback。
- [ ] 本機至少一次：fixture 或 dry-run 證明 daily collector／validate 可跑（記錄 exit code）。
- [ ] 無 secret 出現喺任何新文件或 log；無 push／deploy／launchctl load。
- [ ] 現有 `npm test`（或專案慣用測試）唔被你改壞；若跑得通就記錄，跑唔通就記 Blocked 原因，唔好亂修無關失敗。

## Non-goals
- 唔改 Grok Bot routine；唔 follow／發帖；唔呼叫付費 Gemini／X API；唔 deploy Worker；唔 commit／push；唔 unload 現有 launchd。
- 唔實作 X scraper；唔要求 Owner 貼 key。

## Verification
- 列每條實際跑過嘅命令同 exit code。
- 狀態只用 Completed / Partial / Blocked / Unknown / Planned。
- 完成後喺 stdout 印：改咗邊啲路徑、點樣用 `tail -f` 睇未來 launchd log（範本路徑）、同「X 仍依 Grok Bot」一句。

## Codex 執行方式（給啟動 script）
`codex exec -s workspace-write -C /Users/mattgor/Documents/Daily/ai-pm-radar` 並把本檔全文當 task。VPN 若 403，停並寫入 log。
