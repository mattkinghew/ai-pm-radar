# Radar 每日更新韌性（不依賴 Grok Bot）

日期：2026-11-02。此 runbook 說明本機候選收集與現有 cloud 排程的界線；不代表 launchd 已安裝或 cloud 已驗收。

## 狀態

- **Completed**：Cloud Worker 每日 `0 0 * * *`（08:00 HKT）收集 RSS/HN 候選，與 Grok Bot 分開。`cloud/src/collector.mjs` 將項目保存為 D1 draft；這不是本機 `data/daily/YYYY-MM-DD.json`，也不等於已批准發布。
- **Completed**：本機 `scripts/daily_radar_collector.mjs` 可收集 RSS/HN 候選到 `.runtime/daily-radar-inbox.json`，項目維持 `needs_review`。全來源失敗會回傳非零；HTTP 403 會停止該次收集、不更新 inbox，並在 stderr 記錄來源代號與狀態（不記錄回應正文）。
- **Completed**：`scripts/daily-radar-local-fixture.mjs` 可產生 schema-valid 的合成 daily JSON，以本機 validator 驗證輸出流程。
- **Partial**：launchd 範本未載入；Mac 睡眠、未登入、離線或 VPN 擋住 RSS 時不會產生新候選。
- **Blocked**：X 公開讀取目前仍依賴 Grok Bot 的免費工具。即使本機 RSS/Worker cron 正常，也不代表有 X 貼文輸入。
- **Planned**：若要讓 X 在 Grok Bot 不可用時仍能匯入，Owner 可考慮：① 手動匯出並放入 drop-folder；② 另行批准官方 X API（可能收費）；③ 另行批准有授權的第三方 feed/供應商。本文不實作付費來源、scraper 或新的排程。

## 本機非 X 收集

### 真實來源 daily 草稿（仍需人工編輯）

在主機上執行 `npm run daily:real`：先讀取公開 RSS/HN，再從當日（HKT）新收集且來源可識別的候選建立 `data/daily/YYYY-MM-DD.json`。預設依既存 `pref_score`、來源時間排序取最多 10 筆；少於 3 筆會非零退出，不會建立 daily。`injection_suspect` 項目只列在輸出 JSON 的 `held`，不進入文章。既有 daily 絕不覆寫。收集器會合併舊 inbox；builder 只選同日 `discoveredAt`，避免以舊候選補數。HTTP 403 仍依現有收集器處理。

產出只是一份 `review.status: draft`、`needs_review: true` 的待審候選清單。標題及摘要來自來源，其他分析欄位是明示待編輯佔位文字，三個 1–10 分數也是佔位值；`pref_score` 只表示規則信號。來源未提供發布時間時，`published_at` 暫用發現時間並標 `published_at_basis: discovered_at_fallback`。Owner 須核實來源、日期及內容，補寫分析並明確審核後才可公開建置或發布。

```bash
npm run daily:real
npm run validate:data
npm run validate:daily
```

本機研究 LaunchAgent `com.ai-pm-radar.research` 是另一條研究流程，並非上述命令；目前是否可恢復排程，見 `docs/tasks/RADAR-DAILY-REVIVE.md`。此任務不安裝或載入任何 LaunchAgent。

### 來源故障與執行日誌（2026-11-15）

本機收集採「fail-closed at day level, fail-soft at source level」：單一來源 HTTP 403／404、逾時或解析失敗會記錄原因並繼續其他來源；當次新收集且符合日報條件的唯一候選少於 3 筆時，collector 以 exit 3 結束，不更新 inbox，也不建立 daily。達 3 筆後才更新 inbox，再由 builder 建立待審日報。每次收集的來源狀態、候選數與決策寫入已被 Git 忽略的 `.runtime/collector-runs/`，不記錄回應正文或請求憑證。`config/source-skip-list.json` 列出停用來源與複查日期；停用來源不會發出請求。Anthropic 於 2026-11-15 依官方網站探測紀錄停用，官方現行 feed 是否另有網址仍待確認。Cloud Worker 來源清單尚未同步，屬 Planned。

launchd 範本排程的入口：

```bash
node --experimental-strip-types scripts/daily_radar_collector.mjs
```

預設將候選寫入 `.runtime/daily-radar-inbox.json`，每筆以 cloud `scoreLane` 規則寫入 `lane`、`pref_score`、`pref_reasons` 及 `injection_suspect`；分數只反映規則信號，不核實來源事實。它不建立正式文章、不呼叫 AI，也不替候選補寫批准。每日 JSON 格式的純本機 QA fixture 可用：

```bash
node --experimental-strip-types scripts/daily_radar_collector.mjs --fixture 2026-11-02
npm run validate:daily
```

Fixture 會寫入 `data/daily/2026-11-02.json`，且拒絕覆寫既有檔案。它亦使用相同 lane 規則，並標示 `local_fixture: true`、`review.status: draft` 和 `human_review_required: true`；不可發布或納入正式 build。QA 完成後，依照下方 rollback 手動移除這個本機 QA 檔。實際 RSS 標題需經人工核實與編輯，不能只靠收集器轉成可發布 daily 文章。

## Drop-folder X ingest

`scripts/ingest-x-batch-local.mjs` 是手動入口，讀取 `~/radar-x-drop/batch.json`，向固定的 `https://radar-cloud.lamlab.cc/api/ingest/x` 發送最多 200 篇。需要啟動該程序時已存在的 `CF_ACCESS_CLIENT_ID`、`CF_ACCESS_CLIENT_SECRET`、`INGEST_TOKEN` 環境變數；腳本不讀 `.env.local`、不輸出憑證或回應正文。此工作階段沒有讀取或搜尋本機 secret，因此憑證是否已配置為 **Unknown**；沒有憑證時腳本會以 Blocked 狀態退出。不要把 key 貼到對話或 repo。

X batch 格式應符合現有 API 合約：`{"posts":[{"handle":"...","post_id":"...","text":"...","url":"...","created_at":"...","metrics":{}}]}`。執行腳本前由 Owner 確認來源授權、Access 和 token 已按既有安全方式配置。此次沒有執行該腳本，也沒有發出網絡請求。

手動呼叫入口（只有在 Owner 已配置上述環境變數並確認可送出時才執行）：

```bash
node scripts/ingest-x-batch-local.mjs
```

## launchd 範本、日誌與故障判斷

範本：`ops/launchd/com.lamlab.radar.daily-local.plist.example`。它指向 canonical repo `/Users/mattgor/Documents/Daily/ai-pm-radar`，預設每日 08:00（使用 Mac 當地時區；Mac 時區應為 Asia/Hong_Kong 才等於 HKT）。範本尚未載入。

日誌：

- stdout：`~/Library/Logs/ai-pm-radar-daily-local.log`
- stderr：`~/Library/Logs/ai-pm-radar-daily-local-error.log`
- 收集 inbox：`<repo>/.runtime/daily-radar-inbox.json`

排程啟用後可用以下命令追蹤：

```bash
tail -f ~/Library/Logs/ai-pm-radar-daily-local.log ~/Library/Logs/ai-pm-radar-daily-local-error.log
```

看到 `Source failure: ... (http_403)` 時，該次收集會停止且 inbox 不更新；依任務要求先檢查 VPN/網絡並停止重試，不要繞過 Access 或改用 scraper。非零退出碼、`no source was reachable`、Node/path error 或當日沒有新時間戳，均表示需檢查日誌。單一來源失敗會記入 stderr；只要至少一個來源成功，其他來源仍可部分收集。

### 啟用前 / 啟用後 / rollback（只供 Owner 日後操作）

**Before**：確認 canonical checkout、`/usr/local/bin/node`、log 目錄可用，並先檢查既有 Radar launchd jobs。此範本採用獨立 label `com.lamlab.radar.daily-local`。舊 rc3 記錄指向另一個 `ai-pm-radar-phase-1.5e-rc3/...` checkout 的 Archive listener；目前是否有相關 launchd job **Unknown**。不要因安裝本範本而卸載、覆蓋或改動舊 rc3 job/listener。

**After**：如 Owner 日後批准載入，先將 `.plist.example` 複製成 `~/Library/LaunchAgents/com.lamlab.radar.daily-local.plist`，再檢查 plist 內容與 `launchctl print gui/$(id -u)/com.lamlab.radar.daily-local`。驗證首次執行 log、退出狀態、inbox 更新時間及 `needs_review`；這只證明本機 RSS/HN 候選流程，不證明 cloud/D1 或 X ingest。

**Rollback**：如日後已載入且 Owner 要停用，只卸載這個新 label（`launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.lamlab.radar.daily-local.plist`），再移走該 plist；保留 logs/inbox 供檢查。此次沒有執行 `launchctl load`、`bootstrap` 或 `bootout`。

## X 路徑界線

X 公開讀取目前仍依 Grok Bot 的免費工具；Codex/launchd 不會擅自使用 scraper，也不會要求 Owner 貼 X API key。Drop-folder 只是經 Owner 提供合法匯出及既有憑證後的手動傳輸路徑，不是新的 X 讀取器。
