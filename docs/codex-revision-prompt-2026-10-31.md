# Codex 修訂計劃 Prompt — AI PM Radar（2026-10-31）

> 貼入 Codex 前：在 repo 根目錄開啟 Codex，先讀 `AGENTS.md`、`.cursor/rules/personal-defaults.mdc`、`docs/CONTEXT_SUMMARY.md`、`docs/qa/RECOVERY_R1_FINAL_EVIDENCE_2026-10-30.md`。

## Context
- Repo（canonical）：`/Users/mattgor/Documents/Daily/ai-pm-radar`，branch `main`（ahead 1，HEAD `e9c14c5` 2026-10-17，v0.4.0）。工作樹極髒（約 104 個 tracked/untracked 變更）——**不可 reset / stash / clean / commit**。
- 非 canonical：`~/Documents/marketing pm skills/ai-pm-radar`（停在 2026-07-14，乾淨，無 AGENTS.md）、`Daily/ai-pm-radar-phase-1.5e-rc*`（舊 RC，但仍有 launchd job 指向佢）。
- 架構：Next.js `output: "export"`（純靜態）＋ 本機 `scripts/mobile-production-server.mjs`（:4320，Host guard + Cloudflare Access JWT）＋ `scripts/source-fetch-helper.mjs`（AI companion，Gemini）＋ `cloudflared` tunnel（`npm run tunnel:mobile`）＋ `experiments/cloudflare-sync-spike/worker.mjs`（D1 cloud gateway，未部署）。
- Owner 目標：每日自動收集有價值嘅 AI 資訊／證照考試優惠／科技與職涯資訊 → 評分篩選 → 輸出成 Content Ops（數碼專營顧問帳號）貼文素材 ＋ Cyber Kuma 遊戲素材；手動輸入文字／社交貼文／影片連結 → AI 總結成高知識轉化率文章 → 入知識庫；長遠成為個人 IP 知識中樞。

## Root causes（事實 vs 推論）
| # | 問題 | 事實（證據） | 推論 | 狀態 |
|---|---|---|---|---|
| R1 | 「卡在 Cloudflare」 | `docs/qa/RECOVERY_R1_FINAL_EVIDENCE_2026-10-30.md`：Access 登入後 `https://radar.lamlab.cc/` 可載入；但 `/api/cloud/capabilities` 回 `api_route_not_found`；Source Inbox 只存 browser-local。Worker (`experiments/.../worker.mjs` L25-L115) 需要 `Cf-Access-Jwt-Assertion` + `ACCESS_AUD/ISSUER/JWKS_JSON/ALLOWED_EMAILS`，缺任何一個即回 `unauthenticated` 401。Worker/D1 全部檔案係 untracked `experiments/`，未併入主 app。 | 「連唔到 Cloudflare」其實係兩件事：(a) Tunnel+Access 已通（UI 可達）；(b) cloud gateway (Worker/D1) 從未部署到 production runtime，所以任何 cloud 儲存都失敗。之前把 static UI 成功誤當 cloud 成功。 | Partial（tunnel/Access）/ Blocked（Worker+D1，需 Owner 授權部署） |
| R2 | 冇每日更新 | `data/daily/` 最新檔案 `2026-07-02.json`；`ai-agent/logs` 最新 `2026-07-03.jsonl`；冇 crontab；launchd `com.lamlab.radar.library.refresh` 指向 **舊 checkout** `ai-pm-radar-phase-1.5e-rc3/...`；`cc.lamlab.radar-unified-library-phase16` exit 1；`scripts/daily_radar_collector.mjs` / `research:schedule` 存在但冇任何 scheduler 指向 canonical repo。 | 每日流程從未喺 canonical repo 啟動；排程停留在 RC 副本。 | Blocked |
| R3 | 手動素材轉 AI 文章唔得 | 新增 `lib/quick-capture.ts`、`components/HomeQuickCapture.tsx`（untracked）冇呼叫任何 AI endpoint；AI 經 `lib/companion-api.ts` → helper；`.env.example` L6-7 注明舊 Gemini model 已被拒；`.env.local` 有 AI_PROVIDER/GEMINI_* 設定（值未讀取）。R1 證據只證明 `configured=true`，**冇證明 key/quota/model 有效**。 | Quick capture 只係本機草稿，冇 wired 到 summarize→article→library；production runtime 可能冇跑 helper 或 model 名無效。 | Partial / Unknown |
| R4 | Radar→Content Ops 交付 | `/api/content-ops/status` → `content_ops_brand_allowlist_missing`；`.env.local` 缺 `AI_PM_RADAR_CONTENT_OPS_SECRET_FILE`；Content Ops receiver launchd 嘅 secret file 指向 rc3 舊 checkout。 | 兩邊 secret/brand 設定唔一致，正確 fail-closed。 | Blocked（需 Owner 提供 Brand ID） |

## Milestones（逐個做，每個完成先開下一個）

### M0 — Repo identity & baseline（只讀）
- Scope：`git status --short --branch`、`git log -5`、`npm test`、`npm run typecheck`；列出所有 launchd plist 指向嘅 path。
- Acceptance：一份 `docs/qa/BASELINE_2026-11-XX.md`，列出 HEAD、dirty 數量、測試結果、每個 scheduler 指向邊個 checkout。
- Non-goals：唔改 code、唔停/起任何 launchd。
- Verification：命令＋輸出原文貼入文件。

### M1 — 每日收集本機跑通（fixture-first）
- Scope：令 `scripts/daily_radar_collector.mjs` 可用 synthetic fixtures 產出 `data/daily/<today>.json`，經 `validate:daily` 通過；加入 candidate schema：`category ∈ {ai_news, cert_discount, tech_career}`、`score`、`score_reasons[]`、`source_url`、`fetched_at`、`provenance`。
- Acceptance：`npm run validate:daily` pass；新 test 覆蓋三類別各一筆、去重、score 排序；flexible top-N（唔寫死 10）。
- Non-goals：唔加新 crawler／唔打真實外部網絡（除非 Owner 批准 source allowlist）。
- Verification：`npm test`、`npm run validate:daily`。

### M2 — 排程遷移計劃（只出 plan，唔啟用）
- Scope：寫 `docs/ops/DAILY_SCHEDULE_PLAN.md`＋一個**未載入**嘅 plist 範本 `ops/launchd/com.lamlab.radar.daily.plist.example` 指向 canonical repo；寫明點樣 unload 舊 rc3 job。
- Acceptance：plan 列出 before/after path、log 位置、失敗通知方式、rollback。
- Non-goals：**唔執行 `launchctl load/unload`**（需 Owner GO）。

### M3 — 手動輸入 → AI 文章 → 知識庫
- Scope：Quick Capture 支援 text / social post URL / video URL；URL 只抓 metadata（title/description/transcript 若公開）；`summarize` 經現有 companion helper，輸出 `KnowledgeArticle {id, title, summary_zh, key_points[], actionable_takeaways[], knowledge_transfer_score, tags[], source{type,url,captured_at}, status:"needs_review"}`；寫入 library（本機 IndexedDB/JSON），UI 明確顯示「本機儲存」。
- Acceptance：fixture 測試覆蓋三種輸入；AI provider 未配置/失敗時有清楚錯誤訊息及「複製 prompt 手動處理」fallback；provider 呼叫用 mock 測試。
- Non-goals：未經 Owner 批准不呼叫真實 Gemini（付費）；唔下載影片。
- Verification：`npm test`、`npm run typecheck`、`npm run build`；Owner 手動用一條真連結做一次 UAT（需批准 API 用量）。

### M4 — Cloud gateway 決策包（唔部署）
- Scope：將 `experiments/cloudflare-sync-spike/worker.mjs` 需要嘅 bindings/env 名單（只列名，唔列值）、wrangler config、D1 schema 版本整理成 `docs/cloud-migration/GO_NO_GO_2026-11.md`；用 `test-cloud-auth-local.mjs` 等本機測試證明 Access JWT 驗證邏輯。
- Acceptance：本機 auth tests pass；文件寫清 Owner 需要做嘅一次性步驟（`wrangler deploy`、D1 create、secret put），每步標 Owner-only。
- Non-goals：唔 deploy、唔寫 D1、唔改 Access policy、唔開 public bypass。

### M5 — 跨專案輸出（data contract）
- Scope：實作 `exports/radar-items-<date>.json` 按下面 contract 輸出；Content Ops／Kuma 各一個 fixture。
- Acceptance：contract JSON Schema 檔 `docs/contracts/radar-item.v1.schema.json`＋validator test；`exported ≠ import_confirmed`。

## Cross-project data contract：`radar-item.v1`
```json
{
  "schema": "radar-item.v1",
  "id": "sha256(source_url|title)",
  "category": "ai_news | cert_discount | tech_career | manual_capture",
  "title": "string", "summary_zh": "string", "key_points": ["string"],
  "score": 0.0, "score_reasons": ["string"],
  "source": {"url": "string", "publisher": "string", "published_at": "ISO8601", "captured_at": "ISO8601", "rights": "link_only | quote_ok | unknown"},
  "targets": {
    "content_ops": {"eligible": true, "brand_ids": ["<Owner 確認>"], "angle_hints": ["string"]},
    "cyber_kuma": {"eligible": true, "domain": "cs | ai_pm | side_hustle | english | certification", "card_seeds": [{"prompt": "string", "answer": "string", "distractors": ["string"], "evidence_quote": "string"}]}
  },
  "review": {"status": "needs_review | approved | rejected", "reviewer": "owner", "reviewed_at": null},
  "expires_at": "ISO8601 | null"
}
```
規則：只有 `review.status=approved` 先可以被下游 import；下游要回寫 receipt 先可以標 `import_confirmed`。

## Safety boundaries
- 唔 deploy、唔 push、唔 commit（除非 Owner 明確講）；唔改 Cloudflare Access/Tunnel/D1/launchd。
- 唔呼叫付費 API（Gemini/OpenAI）——測試一律 mock；真實呼叫需 Owner 逐次批准。
- 唔讀出/打印 `.env.local`、tunnel token、HMAC secret 嘅值；只可以報「set / missing」。
- 狀態只用 Completed / Partial / Blocked / Unknown / Planned；本機/static 證據唔可以當 cloud 證據。
