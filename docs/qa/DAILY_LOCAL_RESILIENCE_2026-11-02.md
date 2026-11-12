# QA：每日更新韌性（2026-11-02）

## Scope / 狀態

- **Completed**：檢視 HEAD、現有 local collector、Worker collector、daily validators；新增收集器失敗可觀察性、合成 daily fixture、launchd 範本、運作說明及 guarded X drop-folder 手動入口。
- **Partial**：本機 fixture / validator 與測試可證明本機檔案流程；沒有執行 RSS live run、沒有載入排程。
- **Blocked**：X 公開讀取仍依賴 Grok Bot 免費工具；本次沒有確認 Owner 的本機憑證，也沒有執行 drop-folder ingest。
- **Unknown**：cloud Worker/D1 本次 runtime 狀態、Owner 本機 drop-folder/secret 設定、舊 rc3 是否有載入的 launchd job。

## Repo identity

- 日期：2026-11-02（Asia/Hong_Kong）
- HEAD：`3d3758c` (`P1: reader view (full text, chunked zh translation, AI summary, highlights), bulk sources, bulk KB import, KB search/tags/AI synthesis, shortcuts; migration 0008; codex goals 05-08`)
- Branch：`feat/cloudflare-cloud`（ahead of origin 7）
- 初始狀態含未追蹤 `AGENTS.md.bak-20261031`、`README.md.bak-20261031`、`goals/`；未清理、未 stage、未 commit。

## Commands / results

以下命令在本機實際執行：

- `node scripts/daily-radar-local-fixture.mjs 2026-11-02` — exit 0; wrote synthetic local QA JSON to `data/daily/2026-11-02.json` (new untracked file).
- `node --experimental-strip-types scripts/daily_radar_collector.mjs --fixture 2026-11-02 /private/tmp/radar-daily-fixture-check && npm run validate:daily -- /private/tmp/radar-daily-fixture-check && npm run validate:data -- /private/tmp/radar-daily-fixture-check` — exit 0; collector fixture mode produced one article and both validators passed (1 file / 1 article).
- `npm run validate:daily` — exit 0; 3 files, 13 articles; Validation passed.
- `npm run validate:data` — exit 0; 3 files, 13 articles; no warnings/errors.
- `npm test` — exit 0; 268 tests passed, 0 failed (includes the new HTTP 403 stop regression test).
- `node --check scripts/daily_radar_collector.mjs && node --check scripts/daily-radar-local-fixture.mjs && node --check scripts/ingest-x-batch-local.mjs` — exit 0.
- `plutil -lint ops/launchd/com.lamlab.radar.daily-local.plist.example` — exit 0; OK.
- `git diff --check -- scripts/daily_radar_collector.mjs` — exit 0. New files are untracked, so this scoped Git check does not include them.
- `rg -n '[\t ]+$' docs/ops/DAILY_UPDATE_WITHOUT_GROK_BOT.md docs/qa/DAILY_LOCAL_RESILIENCE_2026-11-02.md ops/launchd/com.lamlab.radar.daily-local.plist.example scripts/daily-radar-local-fixture.mjs scripts/ingest-x-batch-local.mjs data/daily/2026-11-02.json` — exit 1; no trailing-whitespace matches (ripgrep uses 1 for no matches).

## Evidence boundary

- **Local evidence**：收集器程式碼、fixture 檔案及本機驗證器/測試輸出；fixture 明確標為 synthetic draft，不能宣稱是真實來源或已審批文章。
- **Cloud evidence**：本次沒有連線到 Worker、D1 或 Cloudflare；`cloud/src/collector.mjs` 及 `cloud/wrangler.toml` 是 repo code/config inspection，不代表現行部署證據。
- 未執行 live RSS fetch、X ingest、Cloudflare API、Gemini、`launchctl`、deploy、push 或 commit。
