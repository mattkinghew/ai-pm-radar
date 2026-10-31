# AI PM Radar — Cloudflare 雲端部署 Runbook

狀態：**Planned（未部署）**。以下所有指令都會寫入 Matt 的 Cloudflare 帳戶，必須先得到 Matt 明確批准才執行。
Branch：`feat/cloudflare-cloud`。代碼在 `cloud/`。Mac 本機流程（`npm run dev:local`、launchd 08:00 收集）不受影響，兩者獨立運作。

## 架構
- Worker `ai-pm-radar-cloud`：`/api/*` + 靜態手機 UI（`cloud/public`，Workers static assets，`run_worker_first=true` 所以 UI 亦要過 Access 驗證）。
- 驗證：Cloudflare Access 在邊緣攔截；Worker 再驗證 `Cf-Access-Jwt-Assertion`（RS256、iss=team domain、aud=AUD、owner email SHA-256），**預設拒絕**。
- D1 `ai-pm-radar`：`items`、`ai_usage`（每日 AI 上限，HKT 日界）、`runs`。
- Cron `0 0 * * *`（00:00 UTC = 08:00 HKT）：收集 5 個 RSS + HN → D1 草稿 → Gemini 分析（每日上限 `AI_DAILY_CAP=10`）。
- Quick Capture：`POST /api/capture` → Gemini（可選 Workers AI 後備）→ `draft` → `review` → `approve` 先入知識庫（人工審核保留）。

## API
| Method | Path | 用途 |
|---|---|---|
| GET | /api/cloud/capabilities | 能力狀態 |
| GET | /api/library?status=approved\|draft\|reviewed\|rejected\|all | 知識庫 |
| GET | /api/daily?date=YYYY-MM-DD | 每日項目（預設最新） |
| GET | /api/items/:id | 單篇 |
| POST | /api/items/:id/review\|approve\|reject | 審核（approve 必須先 review） |
| POST | /api/capture `{url?, text?}` | AI 整理成草稿 |

## 部署前（本機，已驗證）
```bash
npm test && npm run typecheck
npm run cloud:smoke          # wrangler dev --local + 本地 D1 + mocked JWT + __scheduled
```

## 部署步驟（需 Matt 批准）
```bash
cd cloud
npx wrangler login                                   # 用 Matt 帳戶
npx wrangler d1 create ai-pm-radar                   # 將輸出的 database_id 填入 wrangler.toml（取代 PLACEHOLDER）
npx wrangler d1 migrations apply ai-pm-radar --remote
node ../cloud/scripts/export-local-to-d1.mjs         # 產生 cloud/.import/import.sql（可加 --library <export.json>）
npx wrangler d1 execute ai-pm-radar --remote --file .import/import.sql
npx wrangler secret put GEMINI_API_KEY               # 互動輸入，不要放入檔案或命令列
```
填 `wrangler.toml` 的 `[vars]`：
- `CF_ACCESS_TEAM_DOMAIN`：`https://<team>.cloudflareaccess.com`
- `CF_ACCESS_AUD`：Access application 的 Application Audience (AUD) tag
- `OWNER_EMAIL_SHA256`：`printf '%s' 'you@example.com' | tr A-Z a-z | shasum -a 256`

Access 設定（Zero Trust dashboard）：
1. 新增 Self-hosted application，domain 建議用新子網域例如 `radar-cloud.lamlab.cc`（避免影響現有 `radar.lamlab.cc` tunnel）。
2. Policy：Allow，Include = Matt 的 email；其餘全部拒絕。session 可設 24h–7d。
3. 複製 AUD tag 到 `CF_ACCESS_AUD`。

加 custom domain 後部署：
```toml
# wrangler.toml
routes = [{ pattern = "radar-cloud.lamlab.cc", custom_domain = true }]
```
```bash
npx wrangler deploy
npx wrangler tail            # 觀察首次請求 / cron
```
驗證：手機開 `https://radar-cloud.lamlab.cc` → Access 登入 → 見「今日 / 待審核 / 知識庫 / 擷取」。未登入 curl 應得 302/401。

## 部署會改動 Cloudflare 帳戶的內容
- 新 Worker `ai-pm-radar-cloud`（含靜態資產）、1 個 Cron Trigger（免費版每帳戶上限 5 個）。
- 新 D1 database `ai-pm-radar`（免費版上限 10 個）。
- 1 個 Worker secret `GEMINI_API_KEY`。
- DNS：新 custom domain 記錄 `radar-cloud.lamlab.cc`（由 Workers 自動建立）。
- Zero Trust：新 Access application + policy。
- 現有 `radar.lamlab.cc` tunnel / Access app **不會改動**。

## 回滾
```bash
npx wrangler deployments list
npx wrangler rollback <version-id>        # 回上一版
npx wrangler triggers deploy --crons ""    # 或在 dashboard 停 Cron（停每日收集）
npx wrangler delete ai-pm-radar-cloud     # 完全移除 Worker（D1 保留）
npx wrangler d1 export ai-pm-radar --remote --output backup.sql  # 刪 D1 前先備份
```
Mac 本機流程一直保留，可隨時改返用 Mac。

## 免費額度評估（官方頁面，2026-10-31 查核）
來源：[Workers limits](https://developers.cloudflare.com/workers/platform/limits/)（頁面更新 2026-10-29）、[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)（頁面更新 2026-10-30）。
| 項目 | Free 上限 | Radar 預計用量 | 判斷 |
|---|---|---|---|
| Workers requests | 100,000/日 | 個人手機使用 < 500/日 | 充足 |
| CPU / request | 10 ms | API 多為 D1 I/O（不計 CPU）；JWT RS256 驗證 ~1–3 ms | 應該夠 |
| CPU / Cron | 10 ms | 解析 5 個 RSS（fast-xml-parser）+ 30 筆 | **風險**：可能偶爾超出 |
| Subrequests | 50/次（外部）；1,000 內部 | Cron：6 feeds + ≤10 Gemini ≈ 16 外部；D1 ~80 | 充足 |
| Cron Triggers | 5/帳戶 | 1 | 充足 |
| Cron wall time | 15 分鐘 | < 1 分鐘 | 充足 |
| D1 rows read | 5M/日 | < 10k/日 | 充足 |
| D1 rows written | 100k/日 | < 500/日 | 充足 |
| D1 storage | 5 GB | < 50 MB | 充足 |

Gemini 免費 key 用量同 Mac 一樣（每日最多 10 次，cron 與 Quick Capture 共用 `ai_usage` 上限）。Workers AI 後備預設關閉（`AI_FALLBACK_PROVIDER=none`）；其免費額度條款未在此次核實。

## 成本風險
- Cron 10 ms CPU：如 `wrangler tail` 見 `exceededCpu`，選項：(a) 減少 feed 數 / 每 feed 條數；(b) 改為 cron 只排隊、由多次請求分批處理；(c) 升級 Workers Paid（US$5/月起，按官方價錢頁為準）。免費版超限只會失敗，**不會自動收費**。
- Workers 免費版每日 100k request 用完會回 1027 錯誤，不會收費。
- 唯一可能產生費用的是：升級 Paid plan、或把 Gemini key 換成付費 key（每日上限 10 次保護）。
- Gemini 免費版內容會被 Google 用作改善產品（見 Gemini 定價頁）；介意則改用付費 key。
