# G6 — Telegram 雙向橋接交接

- TASK-ID: G6-TELEGRAM
- Status: Blocked（完整測試受本機 sandbox 綁定埠限制；G6 測試通過）
- Goal: G5 每日晨報推送與 Owner 私有 Telegram 筆記收錄。
- Base: `feat/cloudflare-cloud` / `57260df`；保留所有原有未提交變更。

## Acceptance criteria

1. HTML 晨報轉義動態文字，保留完整標籤，原始訊息長度不超過 4096；包含 Top 3、Research Lane、控制台連結及空摘要提示。
2. 手動推送必須通過既有 Owner Access JWT；每日排程在收集完成後發送，Telegram 失敗不影響已完成的收集。
3. Webhook 只處理 POST；缺密鑰或 Owner 設定回 503，密鑰錯誤回 401；chat/from 必須同時符合 Owner。
4. 文字、caption、URL entities、隱藏連結及轉寄來源保存在私有 KB；重送不重複寫入；Owner `/digest` 回覆今日晨報。
5. Telegram 筆記不出現在公開展示與任何 digest contract。
6. 所有既有及新增測試、typecheck 通過；此項完整測試 gate 尚未達成。

## Non-goals

不修改 migrations 0001–0018、不新增 migration 或依賴、不部署、不操作遠端 D1、不設定實際密鑰或 webhook、不修改 Access policy、cron 時間或正式 daily JSON。

## Changed files / diff

- `cloud/src/telegram.mjs`: 格式化、發送、URL／來源擷取、限 64 KB JSON、Webhook 與手動推送處理。
- `cloud/src/worker.mjs`: 精確 webhook 路徑分流；手動推送留在 JWT gate 後；排程收集後推送。
- `cloud/wrangler.toml`: 僅加上三個密鑰名稱的註解。
- `package.json`: 將 G6 測試加入既有 `npm test`。
- `tests/cloud-g06-telegram.test.mjs`: 14 項本地測試，使用既有 migrations 的 SQLite fake D1、簽署測試 JWT 與模擬 Telegram API。
- `docs/G6_TELEGRAM_BRIDGE.md`: 本交接與操作契約。

## Runtime contract

- 密鑰只透過 Wrangler secret 管理：`TELEGRAM_BOT_TOKEN`、`TELEGRAM_OWNER_CHAT_ID`、`TELEGRAM_WEBHOOK_SECRET`。
- `POST /api/digest/push-telegram` 接受可選 `{ "window": "daily" | "weekly", "date": "YYYY-MM-DD" }`。無 body 表示 HKT 今日；不回退至舊日期。失敗不暴露 Telegram token、URL 或服務回應。
- `POST /api/webhooks/telegram` 使用 `X-Telegram-Bot-Api-Secret-Token`；原生 Web Crypto HMAC verification 驗證密鑰，避免直接字串比較。其他方法回 405。
- 寫入只有 `kb_entries`，`id=telegram:<chat_id>:<message_id>`、`item_id=NULL`、`origin=manual`、`kb_type=note`。原文、連結及轉寄 metadata 存於 `note` JSON。無 AI、抓取來源 URL、審批或發布動作。
- 重送、並行重送及 edited_message 均保留第一次寫入快照。確認回覆失敗時回 503，Telegram 重試不重複寫入；確認訊息可能重複。
- 訊息格式化在轉義前按 Unicode 字元切分，以完整區塊加入訊息並預留 footer。無效、含帳密或轉義後超過 360 字元的連結顯示純文字，避免破壞 HTML 或長度限制。
- 控制台連結使用目前 `cloud/wrangler.toml` 的 Worker 網域 `https://radar-cloud.lamlab.cc/`。
- Worker webhook 分流不代表 Cloudflare 邊緣 Access 已允許 Telegram 到達；本次未變更遠端 policy，真實 webhook 可達性仍為 Unknown。

## Verification evidence — 2026-11-27

- `node --experimental-strip-types --test tests/cloud-g06-telegram.test.mjs` → exit 0 → 14/14，0 failures。Log: `/private/tmp/radar-g6-focused.log`。
- `node --experimental-strip-types --test tests/cloud-*.test.mjs` → exit 0 → 176/176（加入最後一項 cron 成功測試前的雲端回歸）。Log: `/private/tmp/radar-g6-cloud.log`。
- `npm run typecheck` → exit 0。Log: `/private/tmp/radar-g6-typecheck.log`。專案 typecheck 不涵蓋 `.mjs`；新增 Worker 邏輯由上述執行測試覆蓋。
- `npm test` → exit 1 → 436 tests，431 pass，5 fail；新增 G6 全部通過。Log: `/private/tmp/radar-g6-npm-test.log`。
- 修改前 `npm test` 已為 422 tests，417 pass，完全相同的 5 項失敗。Log: `/private/tmp/radar-g6-baseline.log`。

## Known failures / stop packet

- Failure: 完整測試無法達到零失敗。
- Command: `npm test`。
- Exact error: `Error: listen EPERM: operation not permitted 127.0.0.1`（`code: 'EPERM', errno: -1, syscall: 'listen'`）。
- Files involved: `tests/mobile-production-server.test.mjs` 的 5 項既有測試，透過第 15 行 `server.listen(0, "127.0.0.1", resolve)` 綁定本機埠。
- What was attempted: 修改前基線、G6 focused、雲端回歸、typecheck、修改後完整測試；未變更或跳過任何既有測試。同一環境錯誤兩次出現，依停止規則停止實作。
- Most likely blocker: 執行環境禁止開啟 loopback listener。
- Smallest next decision required: 由 Owner 在允許本機 listener 的終端執行相同 `npm test`，提供 exit code 與完整結果以關閉驗收 gate。
- 未執行真實 Telegram、Cloudflare Access 邊緣、實際 Worker/D1、Telegram 用戶端視覺驗收；不宣稱 production 可用。

## References

- [Telegram Bot API](https://core.telegram.org/bots/api#sendmessage)：HTML、訊息長度、entities 與 webhook secret header。
- [Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)：HMAC sign/verify 平台介面。
