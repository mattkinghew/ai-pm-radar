# G7 驗證紀錄 — 2026-11-27

TASK-ID: G7
Status: Blocked
Goal / Acceptance criteria / Non-goals: [G7 API 與 CLI 交接文件](../G7_INGEST_BATCH.md)。

本機分支 `feat/cloudflare-cloud`，HEAD `461298b`。未 commit、push、deploy、設定 secret 或執行遠端 D1。只使用合成資料與既有 SQLite fakeD1（套用原有 0001–0018 migrations）。

## 驗證

| Command | Exit code | Evidence |
| --- | --- | --- |
| `npm test`（修改前） | 1 | 436 tests；431 pass、5 fail；`/private/tmp/radar-g07-baseline.log` |
| `node --test tests/cloud-g07-ingest-batch.test.mjs`（實作前） | 1 | 15 tests；14 fail、1 pass；503 驗證實際為 401，新 CLI 尚不存在；`/private/tmp/radar-g07-red.log` |
| `node --test tests/cloud-g07-ingest-batch.test.mjs tests/threads-import.test.mjs`（第一輪） | 0 | 20/20 pass |
| `node --test tests/cloud-g07-ingest-batch.test.mjs tests/threads-import.test.mjs tests/cloud-worker.test.mjs tests/cloud-g04-showcase.test.mjs tests/cloud-g05-digest.test.mjs tests/cloud-g06-telegram.test.mjs`（第二輪） | 0 | 85/85 pass；`/private/tmp/radar-g07-focused.log` |
| `npm test`（最終） | 1 | 453 tests；448 pass、5 fail；G7 17/17 pass；`/private/tmp/radar-g07-npm-test.log` |
| `npm run typecheck` | 0 | `tsc --noEmit`；`/private/tmp/radar-g07-typecheck.log`。此指令不檢查 `.mjs`，另有語法、單元及打包檢查 |
| `node --check scripts/push-radar-batch.mjs` | 0 | 語法有效 |
| `node --check cloud/src/ingest-batch.mjs` | 0 | 語法有效 |
| `node --check cloud/src/worker.mjs` | 0 | 語法有效 |
| `node --check tests/cloud-g07-ingest-batch.test.mjs` | 0 | 語法有效 |
| `git diff --check -- cloud/src/worker.mjs cloud/public/threads-import.mjs cloud/wrangler.toml package.json` | 0 | 本任務既有追蹤檔無 whitespace 問題 |
| `git diff --exit-code -- cloud/migrations package-lock.json` | 0 | migrations 與 lockfile 無修改 |
| `git status -sb` | 0 | 分支正確；修改保留為未提交狀態，含新檔 |
| `git diff --stat` | 0 | 追蹤檔統計包含既存使用者修改，不包含新未追蹤檔；詳見下文 |

Worker 打包命令（exit 0）：

```sh
node --input-type=module -e 'import { build } from "esbuild"; await build({ entryPoints: ["cloud/src/worker.mjs"], bundle: true, platform: "browser", format: "esm", outfile: "/private/tmp/radar-g07-worker.mjs", logLevel: "info" });'
```

產物 `/private/tmp/radar-g07-worker.mjs`，打包器顯示 350.4kb。未啟動 Worker runtime 或瀏覽器；無 UI 渲染修改，G2 原有行為以共用模組測試覆核。型別、打包及 SQLite 測試不代表線上 Workers/D1 驗收。

## Changed files / diff

- `cloud/src/ingest-batch.mjs`（新增）：受限 body、獨立 Bearer 驗證、G2 共用清理、私有 KB、確定性去重、dry-run。
- `cloud/src/worker.mjs`：新增 import 與精確路由，2 行。
- `cloud/public/threads-import.mjs`：G2 清理結果保留外部 ID，1 行替換；未改 UI。
- `scripts/push-radar-batch.mjs`（新增）：環境變數、JSON 檔、循序 50 筆分批、安全錯誤及計數輸出。
- `tests/cloud-g07-ingest-batch.test.mjs`（新增）：17 項測試，含機器/Owner 權限隔離、格式/大小、G2/影片/通用、並行去重、人工修改保留、公開端點、CLI 主程式及分批。
- `package.json`：在原有 `npm test` 清單加上 G7，無刪改既有測試。
- `cloud/wrangler.toml`：僅加 `INGEST_API_TOKEN` secret 說明註解。
- `docs/G7_INGEST_BATCH.md`（新增）：API/CLI 合約及限制。
- `docs/qa/G7_VERIFICATION.md`（新增）：本紀錄。

`git diff --stat` 的追蹤檔結果為 7 files changed, 24 insertions(+), 3 deletions(-)。其中 `.gitignore`、`README.md`、`tsconfig.tsbuildinfo` 在開始前已修改；前兩個沒有編輯，typecheck 會更新既有 dirty 的產生式 `tsconfig.tsbuildinfo`，未嘗試還原。新 G7 檔案不會出現在未 staged 的 `git diff --stat` 中，`git status -sb` 會列出。所有既有未追蹤檔保留，沒有 stage、stash、reset 或 clean。

## Known failures / 停止封包

- Failure: 整套測試未達 exit 0，不能宣告 Completed。
- Command: `npm test`。
- Exact error: `Error: listen EPERM: operation not permitted 127.0.0.1`（`code: 'EPERM'`, `errno: -1`, `syscall: 'listen'`）。
- Files involved: `tests/mobile-production-server.test.mjs` 的 5 項測試：未授權存取、靜態檔/allowlist proxy、helper unavailable、host/protocol、Content Ops Origin。
- What was attempted: 修改前完整基線一次；新增 G7 實作前失敗測試；兩輪最小實作後針對性檢查；最終完整測試一次。前後同樣 5 個 listen 權限失敗，無新增失敗；17 項 G7 皆通過。未放寬驗證、刪除測試或更改沙箱。
- Most likely blocker: 目前執行沙箱禁止開啟 loopback listener。
- Smallest next decision required: 在允許 loopback listener 的本機終端執行 `npm test`，提供 exit code 與測試總計；不需要部署或改權限邏輯。

未執行的線上 Workers/D1、外部 Access 政策、實際 secret 設定及真實資料匯入皆為 Unknown。逐項寫入可部分成功，故 503/timeout 後應以同一檔案重試；不保證整批 rollback。
