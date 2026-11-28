# G7 — 私有批次匯入

TASK-ID: G7
Goal: 本機管線透過獨立 Bearer token，循序匯入私有 KB 筆記；重試不重複、不覆寫人工修改。

## API

`POST /api/ingest/batch`

必須提供 `Authorization: Bearer <INGEST_API_TOKEN>`。Token 只從 Worker secret 讀取；設定方式為 `wrangler secret put INGEST_API_TOKEN`，不寫入 TOML、檔案、命令列參數或 Git。本任務未執行 secret 設定。

```json
{
  "source_type": "video_watch",
  "dry_run": true,
  "items": [
    {
      "external_id": "synthetic-video-001",
      "title": "Synthetic workflow notes",
      "url": "https://video.example/watch?v=001",
      "summary": "Synthetic summary",
      "content": "Owned synthetic transcript notes.",
      "key_points": ["First point"],
      "tags": ["AI PM"],
      "captured_at": "2026-11-27T00:00:00Z"
    }
  ]
}
```

- `source_type` 必須為 `threads_saved`、`video_watch` 或 `generic`。
- `items` 必須為 1–50 筆陣列；`dry_run` 預設 `false`，只接受 boolean。
- `video_watch` / `generic`：`title` 必填；其他範例欄位可省略。文字欄位為字串；移除控制字元、修整空白及統一換行。標題最多 300 字元、正文 20,000、摘要 8,000、外部 ID 256、URL 2,048；`key_points` / `tags` 各最多 30 筆，單筆分別最多 1,000 / 80 字元。超限或錯誤型別會拒收該項，不靜默截斷正文。
- `captured_at` 如提供，須為可解析的 ISO 日期時間；標準化後存於私有 note metadata，缺省為 `null`。KB 建立時間是伺服器匯入時間。
- `threads_saved` 接受 G2 原始貼文欄位（`id` / `post_id` / `postId`、`text` / `content` / `caption`、`url` / `permalink` / `link`）。直接共用純 ESM `cloud/public/threads-import.mjs`，沿用 ID/標準 URL 去重、雜訊隔離和 URL 抽取。隔離項目列入 `rejected`，不寫入 KB。
- URL 僅接受 HTTP(S)，拒絕含帳密的 URL；也會從文字抽取連結。Worker 不擷取連結或呼叫 AI。
- 請求 body 上限 4 MiB，包含無 `Content-Length` 的串流請求。

成功回應（包括部分項目被拒收）：

```json
{"ok":true,"dry_run":true,"source_type":"video_watch","received":1,"inserted":0,"skipped_duplicates":0,"rejected":0,"errors":[]}
```

`errors` 只含通用代碼，不回傳原文、token 或資料庫錯誤。`dry_run` 會讀取既有去重資料並執行同樣清理，不寫入；可新增筆數為 `received - skipped_duplicates - rejected`，`inserted` 固定為 0。實際匯入時三個計數之和等於 `received`。

錯誤：非 POST → 405（`Allow: POST`）；token 未設定/空白 → 503 `ingest_not_configured`；缺少或錯誤 Bearer → 401 `unauthorized`；無效 envelope / JSON → 400 `invalid_payload`；無法由 G2 解析的項目 → 400 `invalid_items`；body 過大 → 413 `payload_too_large`；儲存失敗 → 503 `ingest_unavailable`。

## 去重與私隱

去重鍵由版本命名空間、來源類型與以下第一個可用身分決定：外部 ID → 標準化 URL → 標題、摘要、正文及重點。沿用既有 URL 標準化，移除追蹤參數及 fragment，保留影片等資源的有效 query。SHA-256 取前 128 位元作 32 字元十六進位 KB ID，兼容既有 KB 編輯、刪除及整理介面。標籤與擷取時間不影響內容備援身分。

同一身分再次傳入只略過，不更新舊內容；需要將修訂視為新筆記時，呼叫端須提供新的 `external_id`。刪除筆記後重新傳入會再次建立。同一 URL 的不同私有筆記應提供各自的外部 ID。

全部以 `origin='manual'`、`kb_type='note'`、`item_id=NULL` 寫入 `kb_entries`；不建立 `items`、審核批准或 AI 任務。呼叫端傳入的批准及私隱欄位不會採用。公開 showcase、每日/每週 digest 及 legacy `?days=` digest 繼續使用原有 G6 發布條件。

授權只在這個精確路徑替代 Worker Access 驗證，無法用 G7 token 讀取 KB、digest、sources 或使用舊 `/api/ingest/x`。比較採用 G6 同樣的原生 HMAC 驗證模式；相關操作見 [Cloudflare Web Crypto 文件](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)。外部 Cloudflare Access 政策及線上端點未驗證或變更。

## 本機 CLI

先由自己的安全環境設定 `INGEST_API_TOKEN`，不要將值寫進 repo 或命令參數。`RADAR_INGEST_URL` 預設 `https://radar-cloud.lamlab.cc/api/ingest/batch`，僅接受無帳密、query、fragment 的 HTTPS `/api/ingest/batch` URL。

```sh
node scripts/push-radar-batch.mjs --source video_watch --file /path/to/synthetic-items.json --dry-run
node scripts/push-radar-batch.mjs --source video_watch --file /path/to/synthetic-items.json
```

JSON 檔可為項目陣列或 `{ "items": [...] }`。CLI 每批最多 50 筆、循序送出（120 筆 → 50 + 50 + 20），拒絕 redirect，每批 timeout 30 秒。stdout 只輸出來源、dry-run、批次及總計數。拒收項目、HTTP / 網路錯誤、錯誤 JSON 或無效回應均 exit 1，不回顯 token、URL、檔案原文或伺服器錯誤 body。

寫入不是整批 transaction；遇錯前的成功項目可能已儲存。CLI 在失敗批次停止，修正原因後可重送原檔；既有鍵會略過。

## 驗收與非目標

Acceptance criteria: fail-closed 503/401/405；批次/來源驗證；G2 及影片/通用素材匯入；dry-run 無寫入；重試與並行去重；showcase/digest 私隱隔離；CLI 分批；既有測試、型別及語法檢查。

Non-goals: 不部署、不設定 secret、不修改 Access、排程、D1 migrations 0001–0018、不呼叫遠端 D1、AI、爬蟲或第三方內容、不改 UI。

Changed files / diff: `cloud/src/ingest-batch.mjs`（新 API）、`cloud/src/worker.mjs`（精確路由）、`cloud/public/threads-import.mjs`（保留去重外部 ID）、`scripts/push-radar-batch.mjs`（新 CLI）、`tests/cloud-g07-ingest-batch.test.mjs`（回歸測試）、`package.json`（註冊測試）、`cloud/wrangler.toml`（secret 說明註解）、本文件。

Verification evidence / Known failures: 見 [G7 驗證紀錄](qa/G7_VERIFICATION.md)。
