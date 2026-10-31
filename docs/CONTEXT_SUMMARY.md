# AI PM Radar Context Summary

## 專案概覽
AI PM Radar 是以 Next.js static export 建立的每日 AI / business radar 網站。產品重點不是即時抓新聞，而是把每日選出的少量內容整理成對非技術讀者有用的學習與決策材料。

## 目前狀態
- 已建立 Level 3 Agent Safety Executor
- 已新增 `ai-agent/QUEUE.md`、`ai-agent/state.json`、`ai-agent/executor.mjs`
- 已加入 approval gate、validation gate、local audit log、manual rollback plan
- 已新增 `docs/AGENT_SAFETY_WORKFLOW.md`
- 狀態：`Local Verified Baseline + Verification Record Committed`
- 架構：Next.js + TypeScript + local JSON
- Live demo：`https://ai-pm-radar-pages.pages.dev/`
- 部署目標：Cloudflare Pages 或 Firebase Hosting
- 內容來源：`data/daily/YYYY-MM-DD.json`
- 已有資料驗證腳本：`npm run validate:data`、`npm run validate:daily`
- 驗收紀錄：`docs/LOCAL_VERIFICATION_2026-07-01.md`
- 新增 Universal Source Inbox：`lib/source-inbox.ts`
- 新增 Normalised Source Schema 文件：`docs/DATA_SCHEMA.md`
- SourceRecord 流程：`Source -> Adapter -> Normaliser -> SourceRecord -> Enrichment -> Review -> Library`
- 目前本機服務：`npm run dev:local`；app `http://localhost:3000/`、helper `http://127.0.0.1:4310/`
- 最近確認 helper `/status`：`provider=gemini`、`model=gemini-3.5-flash-lite`、`configured=true`；configured 不代表 key 有效或尚有 quota
- 新增 `/research/` 本機每日研究簡報頁與 runtime v3；正式 daily JSON 仍是獨立發布格式
- v0.8 本機驗收完成：72/72 tests、TypeScript、validators、build、一次真實 Gemini runner、瀏覽器 feedback／reload／backup／Source Inbox handoff，以及隔離 LaunchAgent 生命週期均已通過
- 目前實際 runtime 為收集開啟、runner AI 分析關閉；macOS 排程關閉且未載入。使用者須明確啟用分析或排程，不會自動送出素材或發布

## 檔案結構
```text
ai-pm-radar/
├── app/
│   ├── about/page.tsx
│   ├── archive/page.tsx
│   ├── article/[slug]/page.tsx
│   ├── research/page.tsx
│   ├── source-inbox/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ArchiveExplorer.tsx
│   ├── ArchiveContent.tsx
│   ├── ArticleContent.tsx
│   ├── ArticleCard.tsx
│   ├── Footer.tsx
│   ├── Header.tsx
│   ├── HomeContent.tsx
│   ├── LanguageProvider.tsx
│   ├── ResearchBriefs.tsx
│   ├── SourceSubscriptions.tsx
│   └── SourceInboxWorkbench.tsx
├── data/
│   ├── daily/
│   │   └── 2026-06-25.json
│   └── templates/
├── docs/
├── lib/
│   ├── articles.ts
│   ├── format.ts
│   ├── i18n.ts
│   ├── daily-candidate.ts
│   ├── research-runtime.ts
│   ├── source-feed.ts
│   └── source-inbox.ts
├── scripts/
│   ├── run-local.mjs
│   ├── research-runner.mjs
│   ├── research-schedule.mjs
│   └── source-fetch-helper.mjs
├── fixtures/
│   ├── source-inbox/
│   ├── source-records/
│   └── candidates/
├── tests/
│   ├── source-inbox.test.ts
│   ├── daily-candidate.test.ts
│   └── source-fetch-helper.test.mjs
├── prompts/
├── firebase.json
├── next.config.ts
├── package.json
├── README.md
└── tsconfig.json
```

## 已完成工作
- 已建立首頁 `/`
- 已建立 Archive 頁 `/archive`
- 已建立 About 頁 `/about`
- 已建立 article detail 頁 `/article/[slug]`
- 已實作 `ArticleCard`、`ArchiveExplorer`、`Header`、`Footer`
- 已支援 Top 5 daily section
- 已支援 category filter
- 已設定 `output: "export"` 與 `out/` 靜態輸出
- 已新增 `scripts/validate_daily_data.mjs`，可檢查 daily JSON 結構、必填欄位、URL、分數與重複來源
- 已新增 `scripts/validate-daily-json.mjs` 作為 daily JSON 驗證流程
- 已新增本地驗收紀錄 `docs/LOCAL_VERIFICATION_2026-07-01.md`
- README 已補上 demo link、目前狀態、驗收證據、case study 入口與 portfolio value proposition
- 已新增 `docs/CASE_STUDY.md` 作為面試與作品集用 case study
- About page 已加入 AI Product Manager portfolio case study 定位
- 已建立 P0 SourceRecord contract，統一 manual URL、貼上文字、transcript、Markdown、TXT、SRT、VTT
- 已建立 X、Telegram、YouTube、Bilibili adapter capability interface 與 manual fallback
- 已加入 SRT/VTT parsing、URL detection、invalid source validation 與 review-safe defaults
- 已加入 `npm test` 的 Source Inbox focused tests
- 已加入三組 synthetic Source Inbox fixtures：Paste Text、SRT、URL-only recovery
- 已加入人工 enrichment / review 範例，明確區分原文 evidence、分析推論與 uncertainties
- 已加入 `lib/daily-candidate.ts`：只允許 `reviewed + approved + 有正文 + 有 evidence` 的 SourceRecord 轉成 daily candidate
- 候選輸出寫入 `fixtures/candidates/`，完整 SourceRecord provenance 寫入 `fixtures/source-records/`，不覆寫正式 `data/daily/`
- 既有兩個 daily validators 已支援可選資料目錄，並已實際掃描候選輸出
- 已加入 `/source-inbox/` URL / Paste Text 來源工作台，沿用既有 SourceRecord 與 daily candidate converter
- 主導覽新增「來源工作台 / Source Inbox」，保留既有 Radar 首頁、Archive、About 與 article detail
- 新增集中式 `lib/i18n.ts` 與 `LanguageProvider`；預設繁中，可切換繁中＋英文並記住瀏覽器語言偏好；首頁、每日 Radar、文章詳情、導覽、來源工作台與 footer 共用字典
- 工作台只在瀏覽器記憶體處理資料，明確分開 review、approval 與 verified；修改表單或日期會使舊 approval fingerprint 失效
- 工作台提供 candidate 與完整 SourceRecord JSON 預覽／下載，未通過既有 gate 時停用 candidate 下載，不寫入正式 `data/daily/`
- `getReviewGateState` 與測試覆蓋「內容修改後 approval 失效」
- 來源工作台收斂為三階段：匯入素材、核對草稿、批准與下載；正文段落可直接選為 evidence
- `scripts/source-fetch-helper.mjs` 是只綁定 `127.0.0.1` 的公開 HTML helper；每次 redirect 重新驗證 DNS、私有／保留位址、content type、timeout 與回應大小
- helper 使用 DNS-pinned lookup 兼容目前 Node 的 multi-address connection mode；前端 URL fetch callback 已修正為不把 React event 當成 URL
- `npm run dev:local` 啟動前檢查 app/helper port，並同步 `NEXT_PUBLIC_AI_PM_RADAR_FETCH_PORT` 與 helper allowlist；靜態部署或 helper 不可用時會清楚分類錯誤並回到貼正文 recovery
- SourceRecord 可選擇保留 `source_url_original` 與 `source_url_final`；daily candidate 仍只使用既有 `source_url`
- 2026-09-19 真實驗證：使用者提供的 Yipee URL 經瀏覽器成功進入草稿，標題非空、正文 1374 字元、`source_url_original`／`source_url_final`／`captured_at` 與 evidence 預填可見；X 直接顯示平台不支援；helper 關閉時 UI 顯示服務不可用且 Paste Text 仍可建立草稿

## 重要實作細節
- `lib/articles.ts` 會在 build time 讀取所有 `data/daily/*.json`
- article slug 由 `date + short_title/question_title` 組成
- priority score 計算方式：
  - `impact_score * 0.5 + relevance_score * 0.3 + trust_score * 0.2`
- 首頁會取最新日期資料
- source link 已設定新分頁開啟，避免離開站內內容

## 已知問題
- 目前只有一份 sample data，內容覆蓋度有限
- 尚未建立 lint 與 typecheck script
- `package.json` 目前沒有 `lint` 或 `typecheck` script
- sample data 屬示範內容，不代表真實新聞研究結果
- 平台 adapter 仍不做 X／YouTube／Bilibili／Telegram 自動擷取；公開 HTML／RSS helper 與明確使用者觸發的 server-side Gemini 分析已實作
- daily candidate 不新增 schema 欄位；完整 provenance 以 SourceRecord `id`、`source_url_original`、`source_url_final` 與 `source_url` 保留在 source-record layer
- 工作台 candidate 與 SourceRecord 檔名共用日期與 SourceRecord ID；daily JSON 本身仍不新增 ID 或 provenance 欄位
- helper 連線錯誤曾由自訂 DNS callback 以錯誤 shape 回傳，造成 `ERR_INVALID_IP_ADDRESS`；已改為依 `options.all` 回傳 pinned address array 或單一 address，並加 regression test
- 前端曾把 click event 傳入 URL fetch，造成 `requestedUrl.trim is not a function`；已改用明確 callback wrapper，並以瀏覽器實測確認資料進入表單

## 限制條件
- 不引入 backend
- 前端不放 API key；X adapter 只預留 environment variable interface
- 不修改目前 build config
- 不移除既有 sample data
- 內容品質主要依賴人工與 prompt workflow 控管
- X credentials 若未設定則保持 disabled；只允許 environment variable
- Telegram 只規劃 Collector Bot / forwarded content，不做 arbitrary public-channel scraping
- Bilibili 為 Experimental，P0 不依賴 cookies、SESSDATA 或 private login session
- 工作台支援最多 5 個 URL、Paste Text、TXT／Markdown／SRT／VTT；不包含社群／影片平台自動擷取或雲端 API 服務
- URL helper 不支援非 HTML、首頁、登入／驗證頁、影片下載、付費牆或私有／保留網路位址；X／YouTube／Bilibili／Telegram 直接要求手動補正文／字幕
- 來源工作台文字素材與 AI 草稿存於目前瀏覽器 IndexedDB；清除網站資料可能遺失，需定期下載備份
- Research runner 使用本機 `.runtime/research/` JSON；完整備份可下載，但目前沒有完整 runtime backup 匯入／還原功能

## 下一步任務
- 擴充更多真實 daily content samples
- 擴充 `docs/CASE_STUDY.md` 成 Notion / LinkedIn / 面試簡報可用版本
- 視需要補上更嚴格的 schema validation 與內容品質規則
- 建立更完整的內容審核腳本或 pre-build 檢查
- 規劃後續半自動化內容產出流程
- 如未來需要跨裝置還原，再設計具版本驗證的完整 runtime backup import；目前只提供下載備份
- 若啟用實際每日排程，先人工核對來源清單、模型設定與每日上限；排程目前保持關閉
- 介面語言不會翻譯文章或保證模型輸出語言；即使本輪繁中合成素材成功回傳繁中摘要，每份草稿仍須人工核對
- 繼續以 SourceRecord 作為 daily JSON、Trend Library、Case Library、Creator Library、Video Reference Library、Content Idea Library 的共同來源層

## Phase 2.0A mobile draft / protected sync follow-up (2026-10-18)

- Fresh local verification: `npm test` 202/202; TypeScript; data and daily validators; synthetic Source Sync service 12/12; isolated cross-device browser test passed with in-memory SQLite and simulated Access. No live D1 write occurred.
- `npm run health:mobile` confirms local origin `127.0.0.1:4320` is fail-closed and helper is listening; helper status `configured` reports setting presence only. The active production `out/` was not rebuilt or overwritten.
- Isolated `build:mobile` succeeded and created the static-only candidate archive at `docs/qa/phase20-mobile-cloud/artifacts/ai-pm-radar-mobile-candidate-2026-10-18.tar.gz` (SHA-256 recorded in `preflight.md`). The archive is not deployed and contains no helper/runtime.
- Candidate browser check: Paste Text → draft → IndexedDB save/reload restore passed; 390px/768px had no horizontal overflow. Review gate kept daily candidate download disabled for missing approval and required fields. Static-only host produced 404 for `/api/automation/status`; this pass did not verify the companion service.
- Cloudflare Dashboard shows Worker Access protection and the existing exact-email policy attached to the expected Worker. However, the protected Worker request still returns JSON `unauthenticated`; current Wrangler config has Static Assets and the handler only reads `ctx.access`. Cloudflare documents that the internal assets router does not pass `ctx.access` to the user Worker. A fail-closed JWT verifier is the likely local code correction, but is awaiting Owner approval; no Access policy or Worker was changed/deployed.
- Prior “Unable to find your Access application” login page is a separate unresolved Access control-plane/authentication issue. No D1 capability/list/create/readback/cleanup call was made. Remote synthetic E2E and `import_confirmed` remain blocked; production and real-owner source flow remain HOLD.

### Follow-up — 2026-10-26
- Fresh isolated `npm run build:mobile` passed with Next.js 16.2.9, TypeScript and static generation (22/22 pages); repo `out/` was preserved. Candidate r4 is `docs/qa/phase20-mobile-cloud/artifacts/ai-pm-radar-phase20a-mobile-candidate-r4-2026-10-26.tar.gz`, SHA-256 `e4d0ec2c3a2715cf09123e433918fc7ae186e9ea998739453c3802ee6e8438e0`; it contains only static `out/` (210 files), not helper/runtime/secrets.
- Sandboxed `npm run health:mobile` first hit `EPERM`; an approved read-only retry confirmed `ECONNREFUSED 127.0.0.1:4320` (origin not listening). The health script exits before helper status; no services were started/stopped. A browser request to the protected synthetic Worker was blocked by the origin approval gate before navigation; no alternate path or remote request was used. Remote authenticated D1 and Access identity remain NOT VERIFIED.
- Current verification: `npm test` **204/204** with narrowly approved local loopback; `validate:data` (2 files / 12 articles, no warnings/errors), `validate:daily`, scoped `git diff --check`, and isolated `build:mobile` (TypeScript + 22/22 static pages) passed. The local synthetic two-context Source Sync simulation passed in the preceding revalidation. These do not prove live D1, physical phone, or cellular acceptance. Current release decision remains **HOLD**.
- Browser backup round-trip is now verified locally with synthetic data: real download → file chooser import into a clean local origin → reload preserved the body. Restored status remained unreviewed/unapproved and candidate download disabled. It does not prove remote sync; temporary preview servers/tabs were stopped/closed. The synthetic JSON download remains in `~/Downloads/source-inbox-draft-2026-10-26.json`.
- `unauthenticated` diagnosis: `experiments/phase13-one-article/worker.mjs` obtains its caller only from `ctx.access.getIdentity()` and returns 401 if absent. The Worker configs use Static Assets; Cloudflare's current docs say its internal assets router does not pass `ctx.access` into the user Worker. Local tests mock that context, so they miss the Static Assets execution case. A fail-closed `Cf-Access-Jwt-Assertion` signature/issuer/audience/expiry/Owner validation is the proposed local correction; it requires explicit approval because it changes auth logic. No Access policy or Worker was modified/deployed, and actual deployed identity/config remain unverified.

### 2026-10-28 — local Access JWT repair (not deployed)
- With Owner authorization limited to local code/tests, the Phase 1.3 Worker now retains `ctx.access` as the primary authenticated identity path and validates `Cf-Access-Jwt-Assertion` only when `ctx.access` is absent (the Static Assets router case). The fallback requires RS256/JWKS signature, exact configured issuer and AUD, app-token type, valid `iat`/`nbf`/`exp`, and a SHA-256 email match to the existing `OWNER_EMAIL_SHA256`; it fails closed and does not fall back when a present `ctx.access` identity is wrong.
- Synthetic Worker-path tests use a generated RSA keypair and mocked issuer JWKS; they cover valid Owner, tampering, wrong issuer/AUD/email, expired/not-yet-valid token, malformed token, missing auth, and identity-path non-fallback. No Wrangler/Access policy, D1, Tunnel, or deployed Worker was changed. Runtime `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` values have not been verified in the deployed Worker; remote login/API and D1 remain NOT VERIFIED, and release remains HOLD.

### 2026-10-29 — Recovery R1 recheck (local only)
- Re-ran `node --experimental-strip-types --test experiments/phase13-one-article/test-worker-local.mjs`: 15/15 passed; `npm test`: 206/206 passed; `npm run typecheck`: passed. These verify local behavior only.
- `npm run health:mobile` currently fails with `ECONNREFUSED 127.0.0.1:4320`. Listener inspection found no Radar Origin on 4320 or helper on 4310. Port 3000 belongs to another project; ports 4482 belong to a separate Radar phase-1.5e checkout; port 4496 belongs to Content Ops. None were stopped or modified.
- Local browser verification on an isolated `localhost:47888` origin: synthetic Paste Text produced a SourceRecord draft, showed “已自動保存於目前瀏覽器”, and reload restored the same text. The gate showed `未審核` / `未批准` and disabled candidate download with concrete missing-field reasons. No AI request was made. The single synthetic draft remains in that isolated browser origin; no default-origin or production draft was touched.
- Browser viewport was 1280 CSS px with document/body width 1280 and no captured console errors. 390/768px, physical iPhone, Access, Cloud persistence, and actual receiver import remain NOT VERIFIED.
- The historical `421` remains explained by strict public-host enforcement when probed with a loopback Host; current state is Origin unavailable, not a fresh 421. The deployed Worker still has not been updated with the local JWT fallback; remote Access identity, protected API, D1, Tunnel and receiver-side import remain NOT VERIFIED. No remote request, D1 operation, deployment or production change occurred. Release remains HOLD.

## v0.6 低摩擦素材收集與 AI 分析草稿（2026-09-19）

- `SourceRecord` 增加 `record_version=2`、`material_status` 與版本化 `analysis` 狀態；素材取得、AI 分析與 daily candidate gate 分開管理。
- 公開 HTML helper 改以 article／metadata／正文品質判斷；頁面有登入導覽不再直接阻擋。真正 login／verification interstitial 仍拒絕；teaser／付費牆前言回傳 `completeness=partial` 警告。
- 來源工作台支援一批最多 5 個 URL（一行一個）、貼正文及 TXT／Markdown／SRT／VTT 上傳；素材卡片逐筆顯示 captured、manual fallback、failed，單筆失敗不阻擋其他筆。
- 加入 IndexedDB 本地文字型草稿保存、版本驗證的 JSON 匯出／匯入與刪除確認；不保存 API key、大型媒體或原始 HTML，不提供雲端同步。
- helper 新增 `/status` 與 `/analyze`。AI 只有使用者明確按下按鈕才呼叫；provider 為 OpenAI Responses API `gpt-4.1-mini`，使用 server-side `OPENAI_API_KEY`、strict JSON Schema、有限重試／timeout／輸入長度限制，瀏覽器不接觸 secret。沒有 key 時素材與人工流程仍可用。
- AI evidence 套用前會核對 `text_reference` 是否存在於正文；失敗時保留素材、不套用結果。AI 草稿不會自動變成 reviewed、approved 或 verified；daily candidate 原有 gate 未放寬。
- 新增 `lib/ai-analysis.ts` 與 `lib/source-draft-storage.ts` 的純函式測試，以及「登入導覽但完整正文」／「真正登入阻擋」／「teaser incomplete」helper fixtures。
- 未完成／未宣稱：本機沒有真實 `OPENAI_API_KEY`，因此尚未做 live provider API 成功測試；browser 完整 AI 分析、修改、IndexedDB reload、加入 daily、批准與下載仍需在使用者本機以自己的 key 做驗證。模型輸出不可用 mock 代替真實證據。

## v0.6.1 Gemini provider 接入（2026-09-19）

- helper 現在支援明確 provider 選擇：`AI_PROVIDER=gemini` 使用 Gemini，`AI_PROVIDER=openai` 保留既有 OpenAI Responses adapter；不自動 fallback、不因 Gemini 失敗啟用 OpenAI。
- 初版 Gemini adapter 使用 `gemini-2.5-flash-lite`；其後因目前帳戶實際生成回 404，helper 與範例的現行預設已改為 `gemini-3.5-flash-lite`。兩者都使用 server-side `GEMINI_API_KEY`、`x-goog-api-key`、`generateContent` 與 JSON schema structured output；免費層、quota、地區與帳戶可用性仍以每次帳戶實測為準。
- `scripts/source-fetch-helper.mjs` 會載入專案根目錄 `.env.local`；已有 process environment 優先，不列印 key。`/status` 回報 `provider`、`model`、`configured`，後者只表示必要設定存在，不代表 key 有效或尚有額度。
- Gemini 回應會轉成既有 AI draft，保存 usage，並在套用前核對原文 evidence；分析結果仍保持 draft／needs review，不會變成 reviewed、approved 或 verified。
- 加入 provider selection、`.env.local` precedence、Gemini response/usage mapping、錯誤分類與 evidence regression tests。錯誤 log 只保存 provider、model、status、stage、request id（如有）與耗時，不保存 API key 或完整正文／provider response。
- 本次本機啟動實測：`npm run dev:local` 在替代 port 3032/4332 成功啟動 app/helper；`/status` 回報 `provider=none`, `configured=false`，`/analyze` 正確回報 `provider_not_configured`。目前沒有可用 Gemini key，因此未宣稱 live Gemini 成功；沒有 mock 代替 live 結果。

## v0.6.2 Gemini structured response diagnostics（2026-09-19）

- 已確認分析失敗的可觀察根因分層：Gemini provider HTTP、無 candidate、無文字 parts、`MAX_TOKENS`／`LENGTH` 截斷、JSON parse、draft schema mismatch、evidence 不在原文，以及 SourceRecord mapping；不再把這些情況共用一個格式錯誤。
- raw REST `generateContent` 的 `generationConfig` 使用 lowerCamelCase `responseMimeType` 與 `responseJsonSchema`；後者符合目前 API reference 對完整 JSON Schema 的欄位，避免把已 deprecated 的 `responseSchema` 與 `additionalProperties` contract 混用。prompt 明確要求所有 required 欄位、無法確認時使用空字串／陣列、不使用 `null` 或額外欄位。
- helper 現在會在 server-side 依同一份 `ANALYSIS_SCHEMA` 檢查 required、型別、數字範圍與額外欄位，再獨立驗證 evidence 是否為原文可追溯片段；diagnostic 只保存 provider/model、stage、HTTP status、request id、耗時、candidate／parts／文字長度、finish reason、usage 及脫敏欄位路徑，不保存 key、正文或完整模型輸出。
- browser validator 與 Gemini schema 對齊額外欄位及 evidence timestamp 型別；前端會分別提示「沒有可用回應」、「輸出被截斷」、「JSON 無法解析」、「欄位格式不符」及 evidence 無法核對，失敗不清空素材、草稿或人工編輯。
- regression tests 覆蓋 REST request 欄位、完整 structured response、空 candidate、截斷、非法 JSON、schema mismatch、evidence mismatch；測試 fixture 不代替 live provider 證據。

- 2026-09-19 live 診斷更新：helper 實際選中 `gemini`／`gemini-2.5-flash-lite` 且設定存在；第一次 request 在 sandbox 以 network stage 失敗，第二次受控重測收到 provider `400 INVALID_ARGUMENT`，沒有進入 response parsing。修正 `responseJsonSchema` 後未再呼叫 provider，遵守最多一次初測／一次修正後重測；最終 live success 仍待使用者本機確認。

## v0.6.3 Gemini model availability diagnosis（2026-09-19）

- 重新核對執行中程序：helper PID 37729、app PID 37751，工作目錄均為本專案；port 為 `4310`／`3000`。helper `/status` 實際回報 `provider=gemini`、`model=gemini-2.5-flash-lite`、`configured=true`。未輸出 process environment 或 key。
- 使用同一 server-side 設定查詢官方 `v1beta/models`，分頁成功（1 page）。`models/gemini-2.5-flash-lite` 存在並回報支援 `generateContent`；因此 ListModels 成功不等於實際生成權限、帳戶資格或免費 quota。
- 對同一 model、同一 `v1beta` endpoint 做一次短篇合成 `generateContent`：HTTP `404`，`error.status=NOT_FOUND`，脫敏 message 為「此模型不再提供給新使用者，請更新至 `models/gemini-3.5-flash-lite`」，無 field violations。失敗階段是 provider HTTP，未進入 JSON、schema、evidence 或 SourceRecord mapping。
- 根因是 `gemini-2.5-flash-lite` 對目前 key 的新使用者生成資格已失效；不是模型 ID 未出現在 ListModels，也不是 endpoint 連線。沒有自動改寫 `.env.local`、沒有 fallback、沒有啟用 billing。需由使用者明確將本機設定改為 `GEMINI_MODEL=gemini-3.5-flash-lite` 後再測；該候選只代表目前 ListModels 可見且支援 `generateContent`，不代表免費 quota 或 live generation 已成功。
- `scripts/source-fetch-helper.mjs` 現在保留脫敏 provider message／field violations，並區分 `model_unavailable_for_account`、`provider_resource_not_found`、`provider_permission_denied` 與 `provider_service_unavailable`；UI 不再把所有 404／403 共用模型不存在文案。
- 官方核對：[Models API](https://ai.google.dev/api/models) 說明 `models.list`、分頁與 `supportedGenerationMethods`；[Generate Content API](https://ai.google.dev/api/generate-content) 說明 `v1beta/{model=models/*}:generateContent`；結構化輸出欄位以現行 REST 文件為準。

## v0.6.4 Evidence mismatch 修正（2026-09-19）

- 合成重現確認：中文分析內容搭配英文原文時，若模型把 `text_reference` 翻譯、改寫、拼接非連續句子或加入省略號，原有 evidence gate 會阻擋；舊驗證同時以大小寫與 whitespace 正規化，且沒有把合法 whitespace 差異還原成原文片段。
- `lib/ai-analysis.ts` 與 `scripts/source-fetch-helper.mjs` 現在只允許相同字元／原文語言的連續片段；僅允許 whitespace／換行差異，拒絕翻譯、改寫、大小寫替換及語意相似內容。通過後會以 source span 還原 `text_reference`，保存原文，不放寬 evidence gate。
- prompt 明確要求 evidence 逐字複製來源，保留語言、拼字、大小寫、標點及措辭；摘要與分析可用其他語言，但不得把翻譯放入 evidence。字幕的 timestamp 仍由回應保留，且只有 evidence 文字通過原文定位才會套用。
- 分析請求現在帶有 transient `source_id` 與正文 hash version；helper 回聲後由前端核對。分析期間正文或素材識別變更，舊回應標記為過期、不覆寫目前內容；分析／mapping／candidate gate 仍維持 needs review、not approved、not verified。
- 新增合成 regression 覆蓋英文原文＋繁中摘要、whitespace canonicalisation、翻譯 evidence、SourceRecord snapshot 變更與 helper 回應 canonicalisation。未使用私人素材或 provider 完整輸出。

## v0.6.5 Evidence 修正實際驗收狀態（2026-09-19）

- 執行環境先確認為同一 repo 的舊 `run-local`：app `http://localhost:3032/source-inbox/`，client bundle 實際指向 helper `http://127.0.0.1:4332/`。舊 helper PID `39424` 的回應沒有回傳 `source_id`／`source_version`，與 v0.6.4 的目前程式不一致；因此歷史／舊程序結果不可當作本輪修正已載入。
- 重啟前唯一一次 live Gemini 呼叫使用短篇合成英文素材，實際回報 `HTTP 200`、`provider=gemini`、`model=gemini-3.5-flash-lite`、`finishReason=STOP`、1 candidate、1 text part；繁中分析語境下的兩項英文 `text_reference` 可逐字在合成正文中定位。這次證明 provider 與基本 evidence 結果可用，但因命中舊 helper，沒有完成 source snapshot echo 驗收。
- 已確認舊程序 PID `39412` 是本 repo `scripts/run-local.mjs` 的父程序後停止，並以相同 port 重啟。目前 app 為 `3032`、helper 為 `4332`；目前 `/status` 回報 `provider=gemini`、`model=gemini-3.5-flash-lite`、`configured=true`，CORS preflight 通過。client bundle 含 `source_version`、`analysis_snapshot_mismatch` 與 evidence canonicalisation 修正。
- 重啟後沒有再發模型請求，因本輪限制最多一次 live call。因此「目前 helper 的真實 Gemini 回應套用、瀏覽器 reload 後保存，以及仍為 needs_review／not_approved／not_verified」尚未完成端到端實際點擊驗收；目前只確認 runtime、status、bundle 與既有程式／測試契約。未輸出 key、環境值、完整 provider response 或私人素材。
- 另有本 repo 遺留 helper 監聽 `4331` 與 `43931`，目前 app 未指向它們，本輪沒有停止；下次使用 `npm run dev:local` 前應清理已確認屬於本 repo 的遺留 helper，或選擇未占用 port，避免再次連到舊 runtime。

## v0.7 Source watchlist and manual RSS／Atom sync（2026-09-19）

- 新增 browser-safe `lib/source-feed.ts` contract、server-only `lib/source-feed-parser.ts` 與 `lib/source-feed-storage.ts`；使用 `fast-xml-parser@5.11.1`，RSS 2.0／Atom 解析不使用 regex XML parser。
- parser 使用 `processEntities=false`，拒絕 DTD／ENTITY，限制 feed response 1 MB、每來源最多 20 筆；支援 namespace、CDATA、Atom link、相對 article URL，正規化 URL 只移除明確 tracking parameters。
- `SourceRecord` 保持 v2，新增可選 `collection` provenance extension（feed URL、關注來源 ID、item ID、content kind、discovered time、feed update time）；daily JSON schema 沒有新增欄位。
- 新增 `components/SourceSubscriptions.tsx`：在既有來源工作台管理關注來源；穩定 ID 由 feed URL 產生，可新增、編輯、停用、確認移除；移除不刪除已收集 feed item。
- IndexedDB 升級至 version 2，保留原 `workbench` store，新增 `subscriptions` 與 `feed-items` stores；來源／feed items 有獨立 version 1 JSON export/import，舊 workbench backup contract 未改。
- helper 新增受限 `POST /feed`，沿用既有 public DNS resolution、redirect revalidation、timeout、response size、content type 與本機 Origin/CORS；支援 ETag／Last-Modified 與 304。helper 未啟動時 UI 仍保留來源清單及既有素材，sync 失敗不會呼叫 AI。
- 同 feed 以 GUID／item ID 去重，跨 feed 以正規化文章 URL 去重；新增 `source_refs` 保存「亦由其他來源發現」資訊，不覆寫既有素材或人工編輯。feed summary／metadata 只建立待補正文卡片，feed content 才進入正文，兩者不冒充完整文章。
- 同步上限為 12 個啟用來源、並行最多 2 個、每來源最多 20 筆；同步本身不分析、不 review、不 approve、不發布，仍沿用既有 SourceRecord → AI draft → evidence → candidate gate。
- 實際公開 feed 驗證（只輸出脫敏摘要）：`https://hnrss.org/frontpage` HTTP 200，解析 20 筆；`https://feeds.bbci.co.uk/news/technology/rss.xml` HTTP 200，解析 20 筆；HN RSS 第二次帶 validator 返回 `not_modified=true`。未以 fixtures 冒充 live 成功。
- 尚未完成：本機沒有可用 browser／Chrome DevTools 工具，因此尚未做「新增來源 → 瀏覽器按同步 → 第二次去重 → reload → 開啟素材 → 取得正文」的實際點擊驗收；`npm test`、TypeScript 與 helper live feed 檢查不等同於 browser E2E。

## v0.6.6 Evidence 修正目前 runtime 驗收（2026-09-20）

- 目前可連線的 app 為 `http://localhost:3000/source-inbox/`，helper 為 `http://127.0.0.1:4310/`。`GET /status` 在正確 `Origin: http://localhost:3000` 下回報 `provider=gemini`、`model=gemini-3.5-flash-lite`、`configured=true`；CORS preflight 回 `204` 並只允許該本機 origin。未輸出 process environment 或 key。`npm run dev:local` 嘗試重複啟動時偵測到 4310 已被使用，因此沒有刪 lock 或終止未確認程序。
- app 的 `/source-inbox/` shell 可正常讀取；目前載入的 JavaScript chunks 含 `source_version` evidence snapshot marker，與本輪 SourceRecord snapshot contract 一致。歷史 `gemini-2.5-flash-lite` 404 不代表本次 runtime 狀態。
- 依本輪最多一次 live 呼叫限制，使用短篇合成英文素材執行一次 `POST /analyze`。結果：HTTP 200、`provider=gemini`、`model=gemini-3.5-flash-lite`、`stage=completed`、`finish_reason=STOP`、1 candidate、1 text part；usage 為 input 281／output 787／total 1068。模型回傳的英文 evidence 可逐字定位到英文正文，source ID／version echo 也一致；未記錄完整 provider response 到文件。
- 既有 `applyAIAnalysisDraft`／evidence／snapshot regression tests 確認：英文 evidence 保留原文、只接受 whitespace／換行差異、正文或素材 ID 改變時不套用；AI draft 仍為 `review_status=needs_review`、`approval_status=not_approved`，不會自動成為 `verified`。本次 live `/analyze` 本身只回傳 draft，不直接寫入正式 daily data。
- 驗證已完成：`npm test` 48/48、TypeScript check、`npm run build`、正式 `data/daily` validators、`fixtures/candidates` validators；build 為 Next 16.2.9，保留 `/source-inbox/` 靜態路由。沒有 browser／Chrome DevTools 工具，因此尚未驗證實際瀏覽器貼入、按鈕套用、IndexedDB reload 與 candidate download；helper live 驗證不等於瀏覽器 E2E。

## v0.6.7 Evidence 修正 live 驗收（2026-09-20）

- 本次先確認 3000／3001 與 4310／4311 沒有舊 listener，再以專案 `npm run dev:local` 啟動同一組 app/helper；沒有停止其他專案程序。頁面為 `http://localhost:3000/source-inbox/`，配對 helper 為 `http://127.0.0.1:4310/`。helper `/status` 實際回報 `provider=gemini`、`model=gemini-3.5-flash-lite`、`configured=true`；此值只表示設定存在，不代表 quota。未讀取或輸出 key／環境檔內容。
- 本次啟動的 helper 載入當前工作樹程式；瀏覽器實際按下 AI 整理並得到草稿，表示當前 app → helper → Gemini → evidence 驗證 → SourceRecord 表單路徑已載入，不是沿用上一輪舊服務。修正中的 source snapshot／evidence canonicalisation 通過本次回應路徑。
- 唯一一次 live 呼叫使用 232 字元合成英文素材，Gemini 回應成功並套入可編輯草稿；usage 回報 input 313、output 900、total 1213 tokens。模型摘要實際為英文，故「繁中摘要」驗收未通過；來源語言欄位當時仍是預設 `zh-Hant`，不應把這次輸出描述為已驗證的繁中分析。
- Evidence `The classifier correctly grouped 18 tickets` 與原文逐字一致，套入 SourceRecord；但同一短引文被重用於多個 claims，字串可定位不表示語意支持全部主張，仍需人工逐項核對。沒有放寬 evidence gate。
- 重新載入後 IndexedDB 草稿仍存在，SourceRecord 預覽為 `analysis.status=draft`、`review_status=needs_review`、`approval_status=not_approved`、`evidence_grade=ungraded`；candidate 下載仍被 gate 阻擋，沒有轉成 reviewed／approved／verified，正式 `data/daily/` 未變更。預覽中的 `analysis.analyzed_at` 仍為 `null`，雖然草稿已套用；這次只記錄為待查的 mapping 差異，未擴大修改。瀏覽器頁面保留在本次驗收結果供查看；DevTools console 未獨立檢查。
- 歷史狀態與本次分開：v0.6.3／v0.6.6 記錄的 `gemini-2.5-flash-lite` HTTP 404 或其他先前 runtime 診斷，不是本次呼叫結果。本次 helper 選中的 model 是 `gemini-3.5-flash-lite`，live 分析成功；沒有切換 provider/model，也沒有重試。

## v0.8 每日研究簡報 v0.1（2026-09-20，本機驗收完成）

- 新增 `lib/research-runtime.ts`、`scripts/research-runtime.mjs`、`scripts/research-runner.mjs` 與 opt-in `scripts/research-schedule.mjs`。本機 runtime schema v3 可遷移 v1／v2；`SourceRecord` 維持 v2，daily schema 不變。
- runner 有明確來源選取、逐筆正文擷取、獨立收集／AI 開關、lock／中斷恢復、每日用量限制、失敗重試、最多 5 份每日簡報與歷史統計；一筆失敗不阻擋其他素材，相似報導只降序而不刪除。
- `/research/` 顯示來源 scope／日期／逐 claim evidence、AI 推論、usage、review 狀態、專案建議與人工 feedback；提供 JSON／Markdown／完整備份下載及具版本／fingerprint 的 Source Inbox handoff。完整 runtime backup 尚無匯入／還原功能。
- macOS LaunchAgent 預設關閉；排程採香港時間每日 08:00 後 5 分鐘喚醒檢查，不補跑錯過日期。已在隔離 HOME 完成 enable → status → disable → remove，使用者實際排程未啟用。
- 一次真實 Gemini runner 使用合成繁中素材完成分析；摘要為繁中，三項 evidence 與方法片段均是原文逐字片段，usage 有供應商回報，草稿仍為 `needs_review`／`not_approved`／`ungraded`。
- 只有可定位的方法片段加上明確相符專案卡才產生一項 30 分鐘限時實驗；不相關專案不產生 action，也不會自動加入 active build。
- 瀏覽器已確認 feedback 儲存／reload、完整 backup download、本地人工修改保留、背景更新衝突選擇、套用後 approval 失效、每項 claim 的獨立 evidence 與非空 `analysis.analyzed_at`；Console 無 error，1280px 無水平溢出。
- 驗證：`npm test` 72/72、`./node_modules/.bin/tsc --noEmit`、正式與 `fixtures/candidates` 兩組 validators、`npm run build` 均通過。

## v0.6.8 Evidence 修正目前 runtime／瀏覽器驗收（2026-09-20）

- 歷史 `gemini-2.5-flash-lite` 404 是舊模型／舊執行結果，不代表目前服務。本輪在 app `http://localhost:3000/`、helper `http://127.0.0.1:4310/` 確認 `/status` 為 `gemini`、`gemini-3.5-flash-lite`、`configured=true`，app HTTP 200、helper CORS preflight 204。
- 為避免碰觸 `localhost:3000` 上原有 IndexedDB，另以本專案隔離 origin `http://localhost:3001/source-inbox/` 與 helper `127.0.0.1:4311` 完成 UI 驗收，之後停止隔離服務並恢復原本 3000／4310。兩個程序均由本 repo `run-local.mjs` 配對啟動；修改檔案時間早於 helper 啟動，且實際 UI request 走過目前 SourceRecord snapshot／evidence mapping。
- 一次 live 呼叫使用 228 字元合成英文正文，Gemini 成功產生 AI draft 並套入表單；evidence `It correctly classified 32 tickets, while 8 required human` 是原文的逐字連續子字串，未做翻譯或模糊比對。沒有再次呼叫模型。
- reload 後正文、AI 摘要及 evidence 保存在隔離 origin IndexedDB；SourceRecord 為 `analysis.status=draft`、`review_status=needs_review`、`approval_status=not_approved`、`evidence_grade=ungraded`，candidate 下載仍被 gate 阻擋；未變成 reviewed／approved／verified。正式 `data/daily/` 未改。
- 本次模型摘要與分析實際回傳英文，故「繁中摘要」未通過。工作台把 `language` 當原文語言提示，介面語言不會傳成模型輸出語言要求；本輪不增加功能、不重試。測試未提供公開來源 URL，預覽 evidence source 為 `Unknown`，但 raw text 與 record 關聯仍保留。
- 隔離測試頁 Console error 為空。SourceRecord 預覽另顯示 `analysis.analyzed_at=null`，雖已套入 draft；列為待查 mapping 差異，沒有在本次 evidence 驗收中修改。
- 收尾狀態：本機 `3000`／`4310` pair 仍由本 repo 程序運行，最後 `/status` 仍為 Gemini／`gemini-3.5-flash-lite`／configured，來源頁 HTTP 200。嘗試以第二個 Next dev instance 開啟 `3001` 清除驗收資料時，Next 因同 repo dev lock 拒絕第二個 instance；沒有刪除 lock、停止既有程序或觸碰 `3000` 資料。合成驗收草稿因此仍保留在隔離 origin `localhost:3001` 的 IndexedDB；該 helper `4311` 已停止。

## v0.6.9 Evidence 修正再次驗收（2026-09-20）

- 目前 repo 程序重新確認：`run-local` PID `75580`、helper PID `75592`、Next dev PID `75613`；app `http://localhost:3000/source-inbox/` 回 HTTP 200，配對 helper 為 `http://127.0.0.1:4310/`。helper `/status` 在允許的 localhost Origin 下回 HTTP 200，回報 `provider=gemini`、`model=gemini-3.5-flash-lite`、`configured=true`；`127.0.0.1:3000` Origin 的 CORS preflight 回 204。configured 只代表必要設定存在。
- 執行中程序自 11:34 啟動；`scripts/source-fetch-helper.mjs`、`lib/ai-analysis.ts`、`components/SourceInboxWorkbench.tsx` 的修改時間分別為 10:58、10:14、11:12，因此程序啟動時已包含目前工作樹的 evidence snapshot、原文定位及前端回應核對程式。未讀取 process environment、`.env.local` 或 key。
- 舊 `gemini-2.5-flash-lite` 404 僅屬歷史紀錄（見 v0.6.3）；本次 live status 使用 `gemini-3.5-flash-lite`，不可把歷史 404 當成本次結果。
- 本輪唯一一次合成英文 `/analyze` 請求經本機 helper 送出；前置 sandbox 連線嘗試遭拒且未送達。實際請求執行後，本地回應擷取器錯誤解析 `curl` 附加的 HTTP 狀態尾碼，輸出 `http_status=null`／`response_json parse_failed`，而完整回應未保留。無法確認 helper/provider 的 HTTP 結果、繁中摘要或英文 evidence；依「最多一次」限制沒有重試，也不宣稱 live 分析通過。
- Codex 內建瀏覽器可以載入 app shell，但其頁面執行環境 `indexedDB` 為 undefined，工作台停在 hydration／輸入 disabled；因此本輪沒有透過 UI 套用該 live 結果，也沒有驗證此筆草稿 reload 保存。既有 `localhost:3000` 草稿未修改；正式 `data/daily/2026-07-02.json` 保持原先 dirty 狀態，沒有被本輪操作寫入。
- 非 live 驗證：`npm test` 60/60 通過；`./node_modules/.bin/tsc --noEmit` 通過。回歸測試仍確認原文逐字／空白正規化 evidence、翻譯引文拒絕、snapshot 變更阻擋及未自動批准。這些結果不替代本輪未完成的瀏覽器／live 驗收。

## v0.8.1 每日研究簡報最終本機驗收（2026-09-20；取代上述待驗證狀態）

- 以隔離 runtime 執行一次真實 `npm run research:run`，run ID `research_79071d25-710d-45b1-aeb2-9507604d8c8f`；Gemini `gemini-3.5-flash-lite` 完成一筆合成繁中素材分析，usage 為 input 397／output 1397／total 1794。沒有第二次模型呼叫。
- 繁中摘要成功生成；三項 claims 各自保存不同且可在同一正文 snapshot 逐字定位的 evidence。來源方法片段「先由兩名人員各自標記40筆查詢，再比較AI分類與人工標記，最後記錄每一筆差異。」亦逐字可定位；review=`needs_review`、approval=`not_approved`、evidence grade=`ungraded`，`analysis.analyzed_at` 非空。
- `/research/` 瀏覽器驗收已保存 feedback 與 `timeboxed_experiment` 採用決定，reload 後仍存在；完整 backup 實際下載並解析為 runtime v3、一筆素材及對應 feedback。Console 無 error。
- Source Inbox 已驗證本地人工修改 reload 後保留、較新背景結果觸發明確衝突、套用背景結果後 review／approval 失效；SourceRecord 預覽的三項 claims 均保留各自 evidence，candidate 按鈕仍 disabled。1280px 視窗沒有水平溢出。
- macOS 排程在隔離 HOME 完成 enable → loaded status → disable → remove；沒有發出來源或模型請求。使用者實際 HOME 的最終狀態是 schedule disabled、LaunchAgent unloaded、runner inactive。
- 完整驗證為 72/72 tests、TypeScript、正式 daily validators、fixture candidate validators 及 production build 全部通過。舊 `gemini-2.5-flash-lite` 404、v0.6.9 的擷取器失敗與 `analyzed_at=null` 都是歷史狀態，不代表本次 v0.8 驗收。
- 收尾恢復一般 runtime：app `http://localhost:3000/`、helper `http://127.0.0.1:4310/` 正在本 repo 服務；`/status` 為 Gemini／`gemini-3.5-flash-lite`／configured。一般 runtime 保持收集開啟、AI 分析關閉、排程關閉；正式 `data/daily/` 未由本輪修改。

## 建議未來 AI agent 使用的 prompts
- 「請根據 `data/templates/daily.template.json` 與 `prompts/daily_json_generator.md` 生成今日 JSON 草稿。」
- 「請審查 `data/daily/YYYY-MM-DD.json`，依 `docs/CONTENT_WORKFLOW.md` 檢查 hallucination、來源品質與 overclaiming。」
- 「請在不改 build config 的前提下，為此專案補上最小 schema validation 或內容檢查腳本。」
- 「請把目前專案狀態同步更新到 `docs/CONTEXT_SUMMARY.md` 與 `docs/TASK_LOG.md`。」

## v0.9 手機遠端存取準備（2026-09-21；初始準備紀錄，已由下方部署驗收更新）

> 以下內容是部署前狀態快照；其中「尚未建立」僅描述當時狀態，現況以 v0.9.1 為準。

- 新增受保護的 static production origin：只服務 `out/`，loopback 綁定；所有靜態頁面與 `/api/*` 先驗 Cloudflare Access JWT 簽章、issuer、AUD、期限與精確 email。API 僅允許既有 helper 路由；未知 API 回 JSON 404，未授權在讀資料／呼叫 helper 前拒絕。
- Production 前端 build 使用同源 `/api`；本機 dev 保留 loopback helper。公開文章擷取與 Gemini key 仍留在 server-side companion，不進瀏覽器；helper 原有 SSRF／DNS pinning 等限制保留。
- 加入 `build:mobile`、`start:mobile`、`tunnel:mobile`、`health:mobile`。Tunnel 使用 repo 外、權限 `600` 的 token file；不把 token 放在 command argument、repo 或 logs。`npm run dev:local` 現在明確將 Next 綁定 `127.0.0.1`。
- Production static CSP 依每頁實際 inline hydration script 計算 SHA-256 allowlist；不以 `unsafe-inline` 開放 script。回歸測試檢查正確 hash 且拒絕 unsafe-inline。
- 本輪 `npm test` 85/85、`npm run typecheck`、`npm run validate:data`、`npm run validate:daily`、兩個 validators 對 `fixtures/candidates`、`npm run build` 與 `npm run build:mobile` 均通過。`out/.radar-mobile-build.json` 標記 same-origin `/api` build；bundle 含 `/api` 路由且不含 loopback helper URL。
- Local dev 曾啟動於 `http://127.0.0.1:3000/`、helper `http://127.0.0.1:4310/`；helper 回報 Gemini／`gemini-3.5-flash-lite`／configured=true（僅代表設定存在）。已由本輪 launcher Ctrl-C 停止兩項服務。
- Browser 可從首頁進入 Source Inbox，但 Codex IAB 的素材頁停在 IndexedDB 保存初始化，輸入項 disabled；Chrome UI 連線逾時。沒有完成 Research Brief→素材保存/reload→review→candidate 實際下載的 browser flow；360／390／768 px viewport、Access login、外部 HTTPS、真機與行動網路均未驗證。
- Cloudflare Dashboard 後續登入成功並完成唯讀核對：`lamlab.cc` zone 的 DNS 清單只有 `capture`，未見 `radar`；唯一 tunnel 為 `telegram-ai-capture`，含 `capture.lamlab.cc` published route 與 root private hostname，不重用。Zone-level Workers routes 為空；既有 `ai-pm-radar` Worker 的 workers.dev 停用且無 custom domain/route，未修改。Access applications 頁未見 Radar app。Cloudflare CLI 缺帳戶 `cert.pem`，標準 API-token 變數 presence check 為 absent；`.env.local` 缺 `AI_PM_RADAR_PUBLIC_ORIGIN`，production startup／health check fail closed。尚未建立 Radar Access app/policy、專用 tunnel 或 DNS route。後續需確認唯一 allowed email，Tunnel route 啟用 Protect with Access 並使用相同 team name／AUD 驗 JWT。
- 未修改正式 daily data；其工作樹原本已有 unrelated dirty changes，保留不動。完整部署指引與限制見 `docs/DEPLOYMENT.md`。

## v0.9.1 私人手機遠端部署（2026-09-21）

- 已部署 [https://radar.lamlab.cc](https://radar.lamlab.cc/)：Cloudflare Access hostname-wide app 僅允許使用者明確確認的一個 email identity；Radar 專用 Tunnel route 啟用 Protect with Access，Mac origin 再驗 JWT 簽章、issuer、AUD、期限與精確 email。未登入 API 請求在 Access 層被導向登入；origin health check 確認無 JWT 時 fail closed。
- Production static origin 只服務 `out/`，綁 `127.0.0.1:4320`；companion helper 綁 `127.0.0.1:4310`。同源 API 經 Radar Tunnel 轉送。token 留在 repo 外權限 `600` 檔案；非秘密部署設定在被忽略的 `.env.local`。沒有新增 billing，`capture.lamlab.cc` 與既有服務未改動。
- 登入後瀏覽器完成首頁 → Research Brief → Source Inbox → 合成素材輸入 → 一次 Gemini 真實分析 → IndexedDB reload → review → 明確 approve → candidate 與 SourceRecord 下載。Candidate JSON 解析成功；實際下載檔通過 `validate:daily`，`validate:data` 無資料錯誤但對 candidate 檔名提出既有命名警告；相同 JSON 使用 schema 預期日期檔名時兩者均無警告／錯誤。正式 `data/daily/` 未寫入。人工 approve 未把分析升為 verified，analysis 仍為 draft。
- `npm run health:mobile` 通過；helper 顯示 Gemini／`gemini-3.5-flash-lite`／configured=true（僅代表必要設定存在）。`npm run build:mobile` 本次重新通過；本次部署前既有 85 tests、TypeScript、正式與候選 validators、`npm run build` 及 `npm run build:mobile` 均通過。
- 遠端 IndexedDB 為獨立 origin，手機與桌面以及 localhost 草稿不會自動同步。Research runtime 仍在此 Mac；關機、睡眠或斷網會令服務不可用。沒有啟用研究排程／Runner AI 或增加 quota。
- 使用者於 2026-09-21 回報手機遠端存取測試通過；此為使用者驗收，設備、網路型態與 viewport 未記錄，故未宣稱為獨立觀測結果。
- 尚未獨立驗證：360／390／768px 響應尺寸與手機瀏覽器 Console；缺少可用 viewport/DevTools 工具。外部 HTTPS、登入後 IAB 互動及使用者真機回報分開記錄。
- 部署細節、登入操作、啟停與回滾見 `docs/DEPLOYMENT.md`；內容流程與 origin-local 草稿提醒見 `docs/CONTENT_WORKFLOW.md`。

## v0.9.2 快速收集與同頁核對（2026-09-28）

- `components/SourceInboxWorkbench.tsx` 將快速入口收斂為貼連結／貼正文、單一主要輸入、整理成草稿與次要上傳；RSS／runner、backup/import 等細節移入可展開進階工具。單一 URL 與每行最多五個 URL 會自動選擇連結模式；混合文字不會被清除。
- 素材卡改為依取得／分析狀態只突出一個下一步；失敗保留 URL 並可回到同筆素材貼正文。逐 claim evidence 在同頁可展開，仍使用既有 SourceRecord evidence 與 provenance，不改 evidence、review、approval 或 verified gate。
- `components/HomeContent.tsx` 新增首頁直接進入來源工作台的入口；`lib/i18n.ts` 補齊首頁 CTA、素材卡下一步、claim evidence 與進階工具的繁中／中英對照。原始文章、使用者輸入、JSON keys 與 enum 不翻譯。
- `app/globals.css` 補上工作台進階區、claim evidence 與窄 viewport 的 min-width／換行限制，避免 360／390／768px 水平溢出。`lib/source-inbox.ts` 與測試新增輸入模式判定，未建立第二套 schema。
- 本機隔離瀏覽器驗收使用 `http://localhost:3001/source-inbox/` 與配對 helper `http://127.0.0.1:4311/`：合成英文短文完成一次真實 Gemini 分析，草稿顯示逐項英文原文 evidence；人工修改標題後 reload 保留。一次呼叫回報 input 330／output 754／total 1084 tokens。分析結果仍為 `draft`、`needs_review`、`not_approved`，candidate 按鈕因缺 review／approval／必要 metadata 而維持阻擋。
- 瀏覽器觀察到首頁 CTA、繁中／中英切換、Research Brief 的 `research_material` handoff、同頁 evidence 展開與 candidate gate。390、360、768px 皆測得 document/body 寬度等於 viewport；Console 沒有 app error，開發模式另有一次 Fast Refresh full reload warning。
- 本輪未重新發出公開文章 URL 擷取或第二次模型呼叫；URL adapter、SSRF、IndexedDB、daily schema 與正式 `data/daily/` 未改。部署後的公開 HTTPS／Access／手機真機狀態須與本機隔離瀏覽器驗收分開看待。

## Reliable SourceRecord & Reuse v1（2026-10-04）

- 新增 `lib/source-library.ts` 與 `lib/source-library-storage.ts`：本地 Library 只接受正文／逐字稿、可定位原文 evidence、至少一項帶 evidence 的主張，且 SourceRecord 已人工 reviewed 並明確批准重用。Library 保存經批准的 SourceRecord 快照、fingerprint 與 Research Brief handoff；不把來源標成 `verified`，也不替代 daily candidate approval。
- 工作台保留原始 URL、擷取後 URL、擷取方式及既有 `SourceRecord`；URL 擷取失敗後貼入正文會更新同一筆素材，不另建重複卡片。Research Brief 從已批准快照直接建立，不重新擷取／抽取來源，並在來源與簡報間保存關聯。
- 為避免同一 IndexedDB 被版本 2 的來源訂閱面板與版本 3 的工作台互相阻擋，兩處統一使用資料庫版本 3、建立相同 object stores，並在版本變更及交易完成後關閉連線。來源訂閱與研究頁仍使用既有同 origin 本機儲存，沒有跨裝置同步。
- **Completed:** SourceRecord Library、明確 reuse approval、同筆 URL failure→manual fallback、Research Brief handoff 及 IndexedDB 保存沿用既有架構；未擴增平台或 daily schema。
- **Verified (本輪本機 browser E2E):** Scenario A 使用 W3C 公開文章 URL `https://www.w3.org/WAI/standards-guidelines/wcag/glance/` 完成 fetch、Gemini draft、claim evidence、人工改標題、review、reuse approval、Research Brief 建立及 reload。Research Brief reload 後仍顯示相同 SourceRecord ID、evidence、來源 facts 與 handoff 關聯，無重新 fetch。一次較長 W3C 頁面的分析曾被既有 evidence validator 拒絕；沒有放寬 gate，之後使用較短公開 W3C 頁面完成成功路徑。
- **Verified (本輪本機 browser E2E):** Scenario B 的 `.invalid` URL 明確失敗；在同一張素材卡改貼合成正文後，SourceRecord 保留原始／最終 URL，`access_method=manual_fallback`。一筆合成正文完成一次 Gemini 分析、逐字 evidence 核對、人工改標題、review、reuse approval 與 reload。AI usage 回報 input 367／output 714／total 1081 tokens；模型 draft 仍是 draft，SourceRecord `review_status=reviewed`，但 daily `approval_status=not_approved`。daily candidate 仍為空，因 creator、evidence grade、daily candidate approval 等要求保持阻擋；未修改正式 daily。
- **Verified:** 第一情境的 Research Brief 在重新載入後可由同一已批准快照讀取；第二情境的 SourceRecord 備份預覽保留 URL、正文、逐 claim evidence、`manual_fallback`、review 與分析資料。兩個流程均未把 `verified` 設為 true；未批准 daily candidate 沒有匯出。
- **Verified (本輪 browser QA):** Research Brief 與 Source Inbox 在 360／390／768px 的 `documentElement.scrollWidth` 及 `body.scrollWidth` 均等於 viewport。fresh browser session 的 Console `errors` 為空；只有 React DevTools／HMR info，沒有 runtime error。390px synthetic flow 完成貼正文、保留 URL、精確選取原文 evidence、手動分清來源事實與推論、review、明確批准重用、建立 Research Brief 及 reload；reload 後 Library／Brief 關聯仍存在。daily candidate 缺發布欄位而 disabled，符合 gate。
- **修正:** browser QA 發現 Research Brief 未處理素材卡的長 URL 造成 390px 文件寬度擴到 874px。`app/globals.css` 對 Research card 內容加 `min-width: 0`／`overflow-wrap: anywhere`，修後各目標尺寸均無溢出。`app/layout.tsx` 加 Next.js 建議的 `data-scroll-behavior="smooth"`；fresh session 無該 warning／runtime error。
- **Not verified:** 本輪沒有重新驗收外部 HTTPS、Cloudflare Access 登入後的 production 流程或實體手機行動網路。使用者另回報手機測試通過，作為使用者驗收獨立記錄；不取代真機與 production 觀測。既有使用者草稿資料仍屬 origin-local IndexedDB。
- **Known limitations:** Research Brief runtime／SourceRecord Library 仍是目前 browser origin 的 IndexedDB，不跨桌面、手機或 origin 同步；正式 daily data 維持獨立。瀏覽器原生清除草稿確認框未被接受，沒有刪除第一情境的測試草稿。
- **Validation (本輪 fresh run):** `npm test` 90/90、`npm run typecheck`、`npm run validate:data`、`npm run validate:daily`、兩個 validators 對 `fixtures/candidates/`、`npm run build`、`npm run build:mobile` 及 `npm run health:mobile` 均通過。health 檢查時 production origin fail-closed；本機 companion helper 回報 Gemini／`gemini-3.5-flash-lite`／configured=true（只代表設定存在）。正式 `data/daily/2026-07-02.json` 原有 dirty change 保留，未由本輪修改。
- **Milestone status:** Reliable SourceRecord & Reuse v1 的本機 Definition of Done 已完成；production／真機驗收是部署層後續檢查，不影響本機 reuse slice 的完成判定。
- **Next recommended vertical slice:** 以使用者手機在行動網路登入 `https://radar.lamlab.cc/`，實測一筆已批准來源的 Research Brief reuse；確認完畢才記錄真機驗收，不要自動同步 localhost 草稿。

## Downstream Handoff Contracts v1／Radar v0.2.0（2026-10-05）

- 新增共用、版本化的下游交接：`content_candidate`、`learning_pack`、`creative_reference`、`case_reference`。四種交接均引用已批准 SourceRecord 的 ID／fingerprint、原文 facts、逐 claim evidence 與 provenance；下游分析／人工備註與來源事實分離。
- 每份 handoff 獨立編輯、review、明確 approve 後才可下載 JSON／Markdown；修改使舊批准失效。handoff approval 不代表 `verified`、daily approval 或發布。
- SourceLibrary entry v1→v2 遷移保留舊 Research Brief 關聯；IndexedDB database/store 版本不變。版本化 backup 驗證格式並按 source ID／fingerprint 合併，避免覆蓋既有本機編輯。
- 本機 browser synthetic flow 已建立同一來源的四類交接、逐一編輯／review／approve，reload 後確認狀態與來源 evidence 保留。使用者另回報「目前已測試，通過」，但未指定裝置、頁面或測試案例，僅記錄為未細分範圍的使用者驗收回報。
- 本輪不接下游產品 API、不改 daily schema／正式 daily data、不新增 database 或跨裝置同步。SourceLibrary backup 仍需手動管理。
- **本輪驗證（2026-10-05）：** `npm test` 98/98、`npm run typecheck`、正式 `npm run validate:data` 與 `npm run validate:daily`、兩個 validators 對 `fixtures/candidates/`、`npm run build`、`npm run build:mobile`、`npm run health:mobile` 均通過；candidate validators 實際檢查 1 個檔案、2 篇文章。health 確認 production origin 未帶 Access JWT 時 fail-closed，helper 回報 Gemini／`gemini-3.5-flash-lite`／configured=true（只代表必要設定存在）。
- **Browser acceptance：** 同一合成 SourceRecord 有 Research Brief 與四種獨立已批准 handoff；Case 的 Assumptions／Unknowns、Creative 的 factual anchors／uncertainty、Learning 的 objectives／misconceptions 分欄可見。修改已批准 Content Candidate 後狀態退回 draft 並鎖定下載，重新 review／approve 才恢復。瀏覽器實際下載 Content Candidate JSON／Markdown 後讀回，核對 type、schema version、source ID、approval、evidence、provenance 與 derived/source 分隔；SourceLibrary backup 匯入及 reload 後保留 Research Brief、四類 handoff、來源 ID 及 approval。
- **Mobile QA：** 360／390／768／1280px 的 `documentElement.scrollWidth` 與 `body.scrollWidth` 均等於 viewport；390px 畫面確認長 URL 換行、交接內容及 JSON／Markdown 操作按鈕直向可見。此為隔離本機 Chromium viewport 驗收；不取代實體手機／行動網路驗收。使用者另回報測試通過，但未提供設備與案例細節。
- **Version:** Definition of Done 完成後由 0.1.0 升至 0.2.0；package 與 lockfile version metadata 一致。
- 本輪未修改正式 `data/daily/`；該檔案原有 dirty change 保留。全域 `git diff --check` 曾只報告 `tools/deal-radar-storage/` 的既有 trailing whitespace，本輪未修改該無關檔案。

## Intelligence Delivery & Consumer Compatibility v1（2026-10-07；Radar v0.3.0 released）

- Source Library schema 由 v2 擴至 v3，增加版本化 `delivery_packages`，並保留 v1／v2 migration。舊 handoff v1 沒有批准 fingerprint；遷移時保留內容及關聯、降為 `needs_review`，須重新批准。
- 已批准 handoff 才能建立不可變 package snapshot。Package 保存 source/handoff ID、內容摘要 fingerprint、來源 facts、evidence、provenance 與衍生分析；不包含整篇 raw source，也不輸出內部可能含原文的 SourceRecord fingerprint。Fingerprint 僅供變更偵測，不是簽章或防偽認證。
- 四個 consumer profile：Content Ops／`content_candidate`、Cyber Kuma／`learning_pack`、Storyworld／`creative_reference`、Diagnostic／`case_reference`。目前只有 Content Ops 有依其既有 `content-ops-handoff` v1 file-import contract 的轉換器；匯入仍由接收端人工確認，Radar 的 `exported` 不代表接收成功，`import_confirmed` 是人工記錄。
- Package lifecycle 分開記錄 `packaged`、`exported`、`import_confirmed`；`outdated` 依目前 source/handoff fingerprint 推導。舊 package 不覆寫；內容變更使批准失效，重新審核批准後可建立新 revision。Source Library backup 包含 package snapshots／state，import 驗證格式並合併，不覆蓋現存本機編輯。
- `npm test`：105/105 通過；`npm run typecheck`、`npm run build`、`npm run build:mobile`、正式 `validate:data`／`validate:daily`、兩個 validators 對 `fixtures/candidates/` 及 `health:mobile` 均通過。Fixture validators 實際檢查 1 個檔案／2 篇文章。health 顯示 origin 對無 JWT 請求 fail-closed；helper 為 Gemini／`gemini-3.5-flash-lite`／configured=true（只代表必要設定存在）。
- **Browser acceptance:** 使用隔離 Chromium，`typeof indexedDB === "object"`；來源寫入、reload readback 成功。Flow A 通過：Content Candidate review/approve、建立相容 package、JSON／Markdown／Content Ops intake 實際下載讀回，SourceRecord／handoff identity、fingerprint、evidence、provenance 保留。Content Ops receiver import 不在本 repo 驗收範圍。
- **Flow B/C:** 編輯已批准 handoff 後舊 package 保持原 ID/fingerprint 並標示 outdated；重新 review/approve 後建立新 package revision。Learning Pack、Creative Reference、Case Reference 均通過獨立 review/approval、compatibility 與 package creation。
- **Flow D:** Source Library backup 匯入全新 browser context 並 reload；1 SourceRecord、4 handoffs、5 packages（1 outdated、4 current）及 IDs/fingerprints/evidence 關聯均保留。
- **Responsive/runtime:** 360／390／768／1280px 的 document width 等於 viewport，Outbox/package/evidence/fingerprint 節點無水平溢出；target、compatibility 與 stale 狀態可見。最終 browser console error 0；首次載入曾觀察到非阻塞 favicon 404。Content Ops receiver runtime import：`NOT VERIFIED`。
- **Verification:** `npm test` 105/105、`npm run typecheck`、正式 `validate:data`／`validate:daily`、兩個 validators 對 `fixtures/candidates/`（1 file／2 articles）、`npm run build`、`npm run build:mobile`、`npm run health:mobile` 均通過。Health 確認 origin 無 Access JWT 時回 401 fail-closed；helper status 為 Gemini／`gemini-3.5-flash-lite`／configured=true（只代表設定存在）。
- `git diff --check` 唯一錯誤來自既存 dirty `tools/deal-radar-storage/` CSV／文件尾空白；未改動。正式 `data/daily/` 的既存 dirty change 保留，未由本輪寫入。無關 Node module typeless warnings 保留。
- **版本狀態：** Release gate 全項完成，版本由 `0.2.0` 升至 `0.3.0`。Fingerprint 是 deterministic change detection，不是 cryptographic signature；其他三個 consumer 仍沒有 receiver importer。

### Release-gate fresh recheck（2026-10-08）

- 隔離 Chromium 確認 IndexedDB 可用；以合成資料完成 Flow A–D，包含 package exports/readback、immutability/stale revision、四 consumer targets，以及在空白 browser session 匯入 backup 後 reload。共保留 1 SourceRecord、4 approved handoffs、5 packages（1 outdated、4 current），IDs、fingerprints、approval 與 evidence references 均讀回。
- 360／390／768／1280px document/body width 等於 viewport。初次載入 helper 未啟動時兩個 automation endpoints connection refused；啟動本機 helper 後 reload，API 回 200 且 Console errors/warnings 為 0。無模型呼叫。Content Ops receiver import 為 `NOT VERIFIED`。
- `npm test` 111/111、typecheck、正式與 fixture validators、`build`、`build:mobile`、`health:mobile` 通過。health 確認無 Access JWT 時 origin fail-closed。Repo 實際版本已是 `0.3.0`，本輪未改版號；正式 `data/daily/` 未修改。全域 diff check 只報既有 dirty `tools/deal-radar-storage/` 尾空白。

### Release-gate fresh recheck（2026-10-09）

- 本輪 fresh：`npm test` 117/117、typecheck、正式及 `fixtures/candidates/` validators、`build`、`build:mobile` 均通過。啟動本機 production origin/helper 後 `health:mobile` 通過；origin 無 Access JWT 時 fail-closed，helper status 僅報 provider/model/configured。
- 隔離 Playwright Chromium 確認 IndexedDB 可用，合成暫存資料 open/write/reload/readback 後已刪除測試 DB。360／390／768／1280px 在本次開啟的 Research 頁面 document/body width 等於 viewport；此輪沒有重新執行完整 Outbox Flow A–D，完整 Flow A–D 與 Outbox viewport 結果沿用前述 2026-10-09 fresh acceptance 記錄。瀏覽器出現一個既有 `/favicon.ico` 404，未阻擋頁面操作。
- `npm run start:mobile` 與 `npm run dev:local` 均由本輪啟動並已停止。版本原為 `0.3.0`，未修改；正式 daily data 與既存 dirty changes 保留。Content Ops receiver import、公開 HTTPS 與實體手機仍未驗證；全域 `git diff --check` 只報 unrelated `tools/deal-radar-storage/` 既存尾空白。

### Release-gate fresh recheck（2026-10-09）

- 隔離 Playwright Chromium 確認 IndexedDB 可用；使用合成 SourceRecord 完成 Flow A–D。Content Candidate JSON、Delivery Package Markdown、Content Ops intake JSON，以及 Learning Pack／Creative Reference／Case Reference package JSON 均由瀏覽器下載並讀回；四個 target package 均通過 repo `validateDeliveryPackage`，保留同一 SourceRecord、evidence 與 provenance。
- 舊 package ID／fingerprint 保留並標記 outdated；重新 review／approve 後的新 package 使用新 fingerprint。Flow D 在全新 browser context 匯入備份並 reload，讀回 1 SourceRecord、4 approved handoffs、5 packages、1 個 outdated revision，以及 evidence／ID／fingerprint 關聯。
- 360／390／768／1280px document width 均等於 viewport；package、long URL、evidence、fingerprint、manifest／export disclosure 與 stale warning 可見，無水平溢出。Console errors／warnings 為 0。Content Ops receiver import 仍為 `NOT VERIFIED`；沒有模型呼叫、正式 daily 寫入或公開 HTTPS／實體手機測試。
- `npm test` 114/114、typecheck、正式及 fixture candidate validators、`build`、`build:mobile` 通過。啟動本機 production origin/helper 後 `health:mobile` 通過，無 Access JWT 時 origin 回 401 fail-closed；helper 為 Gemini／`gemini-3.5-flash-lite`／configured=true（僅代表必要設定存在）。版本原已是 `0.3.0`，未修改版號；正式 `data/daily/` 的既存 dirty change 保留。全域 `git diff --check` 僅報無關 `tools/deal-radar-storage/` 既存尾空白。

## Intelligence Scoring & Routing Engine v1（v0.4 work in progress；2026-10-08）

- 已確認 v0.3.0 的 browser release gate 在 Roadmap／Context Summary 記為完成；本輪 baseline 為 repo 實際 `package.json` version `0.3.0`。本輪未 bump package version，v0.4 DoD／browser acceptance 尚未完成。
- 新增 `lib/intelligence-routing.ts`：以已批准 SourceRecord 作輸入，建立 `schemaVersion=1` assessment，綁定 source fingerprint，採 `radar-intelligence-rules-v1` 五維解釋性 rules（source quality、Radar relevance、evidence locatability、actionability、reuse potential），不呼叫模型、不修改 SourceRecord，也不把分數當事實或驗證。
- 五個 routes：Research Brief、Learning Pack、Content Candidate、Creative Reference、Case Reference。每項都需人工 accept／reject／override；拒絕及覆寫需原因，覆寫需選其他 route。只有接受／覆寫 route 才能建立對應既有 brief／handoff draft；handoff 保持 `draft`，不自動 review、approve、verified、export 或 publish。
- Source Library entry 升至 v4，`intelligence_assessments[]` 保留 assessment 歷史；v1／v2／v3 migration 將缺少欄位初始化為空，IndexedDB database/store version 與 backup envelope 不變。Backup import／merge 保留 assessment 並按 ID 合併。
- `/research/` 已批准來源卡新增評估／route review panel，使用現有 IndexedDB persistence 及雙語字典；`docs/DATA_SCHEMA.md`、`docs/CONTENT_WORKFLOW.md`、`docs/ROADMAP.md` 已記錄此進行中切片。
- Tests：新增 `tests/intelligence-routing.test.ts`，涵蓋來源批准 gate、fingerprint、multi-route、decision reason、override、草稿建立引用與評估不批准 handoff；Source Library v3→v4／backup round-trip tests 已加入 `npm test`。
- **本輪修正：** `radar-intelligence-rules-v2` 將 relevance 搜尋範圍納入 SourceRecord 正文，並改為完整詞／詞組邊界比對，避免 `ai` 在 `training`、`maintenance` 等字內造成誤加分；validator 保留 v1 assessment snapshot，相容舊評估而不重算。已加入正／負向 regression assertions。
- **後續修正：** `radar-intelligence-rules-v3` 讓 source quality signals 同時顯示作者、日期、URL provenance、取得方式及 evidence grade 的已知／未知狀態；不改分數權重，也不宣稱獨立來源查證。validator 繼續接受 v1／v2 snapshots，不重算舊評估。
- **confidence 語意修正：** assessment confidence 現按五個維度中具可觀察 signals 的比例計算；單有 baseline score 不會提高 confidence。它仍是規則輸入覆蓋提示，不是模型機率、分數準確度或事實可信度；新增 baseline-only regression test。
- **本輪 browser slice（2026-10-09）：** 隔離 `127.0.0.1:3002` IndexedDB 以合成 SourceRecord 完成 paste → review／reuse approve → 五維評分 → route accept／reject／override → 建立 Research Brief 與 Learning Pack drafts；reload 後 assessment、決定、artifact IDs 均保留。Handoffs 仍為 `draft`，沒有 AI 呼叫、daily candidate 或發布。所用 CUA 未提供 browser Console 讀取，因此 Console errors 未驗證。
- **本輪驗證（2026-10-09）：** `npm test` 111/111、`npm run typecheck`、`npm run build`、正式 `npm run validate:data`／`npm run validate:daily` 均通過；兩個 daily validators 亦直接檢查 `fixtures/candidates/`，各檢查 1 檔／2 篇文章並通過。正式 `data/daily/` 未由本輪修改。
- **Confidence follow-up（2026-10-09）：** 修正 assessment confidence 原先以非零 baseline scores 計數且設 0.2 下限的語意落差；現按五維中有可觀察 signals 的比例計算，並加入 baseline-only regression test 及繁中／雙語解釋。新一輪 `npm test` 113/113、`npm run typecheck`、`npm run build`、正式 `validate:data`（2 files／12 articles）、`validate:daily`（2 files／12 articles）及 scoped `git diff --check` 通過；版本保持 `0.3.0`，v0.4 仍 IN PROGRESS。
- **Browser acceptance follow-up（2026-10-09）：** 使用隔離 Playwright profile 完成 paste synthetic text → SourceRecord → evidence／人工欄位 → review → reusable-source approval → Research page assessment → 五條 route recommendations → accept Case Reference → create draft → reload。重載後 accepted decision 與已關聯 draft 可見；草稿仍待獨立 review／approval。browser flow Console errors=0；桌面全頁截圖 `/private/tmp/radar-v04-acceptance.png`。沒有 AI 呼叫、daily candidate、正式資料寫入或發布。舊 CUA origin 檢查讀到的既有研究資料未修改。
- **Browser acceptance follow-up（2026-10-09）：** 在同一個隔離 Playwright browser context 以頁面導覽完成 synthetic SourceRecord → reusable-source approval → 五維 assessment → 接受 Case Reference → 建立 draft → handoff 獨立 review／approve → reload。IndexedDB 讀回確認 assessment decision 指向同一 SourceRecord 的 Case Reference handoff，handoff 狀態為 `approved`；SourceRecord 與 daily candidate 狀態沒有被該批准改寫。360／390／768／1280px 的 document/body width 等於 viewport。此輪未呼叫 AI、未下載／發布 candidate、未改正式 daily data。頁面有一個既有 `/favicon.ico` 404 Console error，需獨立處理；沒有其他已觀察的應用錯誤。
- **繁中／雙語介面 follow-up（2026-10-09）：** Research assessment explanation、dimension explanation、signal 與 route recommendation 依介面語言顯示；隔離 browser 已確認 zh-Hant 與 bilingual 兩種模式有差異，原始 focus term 保留。`npm test` 119/119、`npm run typecheck`、正式與 `fixtures/candidates/` 的 `validate:data`／`validate:daily`、`npm run build`、`npm run build:mobile` 均通過。保留既有非阻斷 `/favicon.ico` 404；版本維持 `0.3.0`，完整 v0.4 規格仍待補。
- **尚未驗證：** 完整 v0.4 acceptance 仍需收到被截斷的規格後半與 Definition of Done；目前不據部分規格宣稱 milestone 完成。
- **已知範圍限制：** relevance profile 目前是文件化的固定關鍵詞基線，沒有個人化設定；ruleset 只量欄位／keyword signals，不是可信度、成效或主張支持判定。任務提供的規格文字在 relevance 維度描述中途截斷，完整其餘維度／路由細節需後續規格補充。
- **Route-artifact integrity follow-up（2026-10-09）：** `SourceLibraryEntry` validation 現要求 assessment 的 `createdArtifactId` 指向同一 SourceRecord 下、route 類型相符的 Research Brief／Handoff；補 regression 覆蓋五種 route、孤兒 ID 與錯 route ID。entry schema、IndexedDB version、backup envelope 及 handoff approval gate 不變。完整 v0.4 spec／DoD 仍待補齊。
- **Scoring ruleset v4（2026-10-09）：** 實作現用 `radar-intelligence-rules-v4`，validator 保留 v1／v2／v3 snapshots；relevance 支援繁中／英文 focus-term 群組、每個群組只取一個匹配詞；reuse 無任何可觀察 signals 時為 0；source quality signals 明示 SourceRecord 已過人工 review／reuse approval workflow。新增繁中 relevance、同義詞不重複計分、baseline-only reuse、NaN confidence、route signal 型別及重複 assessment ID regressions。定向測試 31/31、完整 `npm test` 118/118、typecheck、正式／candidate validators、`build` 及 `build:mobile` 通過。docs 已對齊 v4；個人化 relevance 與剩餘 v0.4 contract 仍無法確認，因收到的 task 在 Relevance 敘述中截斷；版本保持 `0.3.0`。

## Intelligence Delivery & Consumer Compatibility v1 — release acceptance（2026-10-11）

- Fresh isolated browser completed Flow A–D with synthetic material. Flow A downloaded and read back handoff JSON/Markdown, delivery package JSON/Markdown, and Content Ops intake JSON; Flow B preserved immutable package A as outdated and created package B with a distinct fingerprint; Flow C exported packages for all four consumer profiles; Flow D imported the Source Library backup into an empty browser context, reloaded, and recovered 1 SourceRecord, 4 approved handoffs, and 5 packages with IDs, evidence links, fingerprints, and stale/current states intact.
- Actual Content Ops receiver import was separately completed and verified in its own application; this supersedes earlier `NOT VERIFIED` status entries for the receiver. Radar does not infer receipt from its own export status.
- Outbox was checked at 360／390／768／1280px, including long URL/evidence text in the visible preview; document width matched viewport at each size. Synthetic-only browser runtime showed no application console errors; the isolated restore session had a non-blocking favicon 404.
- Package version was already `0.3.0`; no version, product code, dependency, formal daily data, deployment, or publishing change was made. Final local verification: `npm test`, typecheck, formal and candidate validators, `build`, `build:mobile`, and `health:mobile` passed. The existing unrelated dirty daily JSON and other worktree changes were preserved. Global `git diff --check` reports only pre-existing trailing whitespace under `tools/deal-radar-storage/`.

## Receiver-verified handoff / acceptance refresh（2026-10-11）

- Content Ops Studio v0.9.5 UI 匯入合成 A/B 交接包：A 再匯入顯示 1 個 possible duplicate，預設略過；B 作為新 package revision 匯入。reload 後兩筆均在明確指定的 Synthetic Radar Receiver Alpha，`needs_review`，共用 Radar SourceRecord／handoff ID，但 package ID／fingerprint 及 handoff fingerprint 各自保留；evidence reference 保留。Beta Inbox 為 0；Content Items／strategy versions 未增加，無發布。
- Content Ops `npm test` 168/168、typecheck、build 通過；Radar `npm test` 119/119、typecheck、正式 daily data／JSON validators、build 通過。PSPO I Learning Pack 的 SourceRecord validator 回傳零 issues；handoff、delivery package 與 `cyber_kuma` consumer compatibility 均有效，四個 evidence IDs 與來源／handoff identity 相符。
- v0.4 仍 IN PROGRESS：既有 rule／migration regression 與先前隔離 browser vertical slice 有證據，但本次新 session 的 Console 出現 favicon 404 與 companion automation status connection-refused；未把此 session 記作完整 route browser sign-off。完整 v0.4 scoring specification 仍待提供。

## Delivery / v0.4 / PSPO acceptance completion（2026-10-11）

- 根據本次提供的完整驗收清單完成補充驗收；先前「規格缺失」記錄只代表早前收到的內容被截斷，不代表目前仍缺少本次驗收範圍。v0.4 acceptance checklist 本輪通過；package version 仍為 `0.3.0`，未自行升版，等待 owner/release gate。
- Content Ops receiver E2E：隔離應用以合成 A/B revisions 完成明確匯入確認、duplicate 預設略過、reload 持久性、brand isolation 與 review-state readback。A/B 保留各自 package/handoff fingerprints 及共享 source/handoff identity；receiver 以兩筆 `needs_review` sources 顯示，沒有自動發布。限制：receiver 未標示 A 為 superseded/outdated，只能依 provenance identity 關聯 revisions。
- v0.4 browser acceptance：合成 SourceRecord 上完成繁中 relevance、group synonym 僅計一次、routing signal/coverage 顯示、accept/reject/override reasons、route artifacts、reload，以及 assessment/source/artifact association。Research Brief／Learning Pack artifacts 保持 draft，routing acceptance 沒有批准 handoff。360／390／768／1280px 無水平溢出。隔離 backup 在空 browser 匯入、reload 後保留 SourceRecord、assessment、route decisions 與 Research Brief link。Source Library 備份匯出早於 Learning Pack draft 建立，因此該備份不包含後建 draft。
- PSPO I fixture：官方 Scrum Guide 選段及 CC BY-SA attribution/sharing note；SourceRecord、Learning Pack handoff、delivery package validators 及 Cyber Kuma consumer compatibility 通過。handoff/package JSON fixtures 可解析；`handoffToMarkdown` 與 `deliveryPackageToMarkdown` 實際產出含來源／evidence/provenance/learning sections 的 Markdown。未用考題庫資料；人類 approval 及 source/handoff provenance 均明示。此為 fixture/export proof，不代表 Cyber Kuma importer E2E 或完整 PSPO I syllabus。
- 驗證：本輪定向 `intelligence-routing` + `source-library` tests 31/31 通過；PSPO Markdown exporter read-only assertion 通過。較早同一任務鏈已重新執行 Radar 119/119、Content Ops 168/168、兩邊 typecheck/build、Radar formal/candidate validators；該結果屬本任務鏈已取得的 fresh run，不是本次追加測試重跑。Research companion automation status 的兩個請求在 browser console 為 `ERR_CONNECTION_REFUSED`；未阻擋路由驗收，但不可宣稱 companion automation service 可用。未執行外網、實體手機、production、live model 或發布驗收。
- 僅更新文件；未改 application code、正式 daily data、receiver repo 或 fixture。這是本機驗收，不是 production／手機網路驗收。
- **追加驗收證據（2026-10-11）：** 本輪 fresh run 重跑 Radar `npm test` 119/119、typecheck、正式及 daily JSON validators、build；Content Ops `npm test` 168/168、typecheck、build 均通過。現行隔離瀏覽器重讀 receiver 與 routing backup，390／768／1280px 的 document 寬度均等於 viewport。PSPO SourceRecord validator 為零 issues；approved handoff、delivery package、Cyber Kuma consumer compatibility 及兩種 Markdown exporter 通過。非阻斷 Console 訊息為 favicon 404 與未啟動的本機 companion automation 連線拒絕。未驗證 production、外部 HTTPS、真機、live model；版本仍 0.3.0。
- 附件原始 release gate 的基線寫 `0.2.0`，但本倉庫本輪開始時 `package.json` 已是 `0.3.0`；因此沒有再次升版或回退。fresh `npm run build:mobile` 與 `npm run health:mobile` 通過；health 確認 origin 無 Access JWT 時 fail-closed (401)、helper 回報 Gemini model/configured 狀態。full `git diff --check` 僅在既存 `tools/deal-radar-storage/` dirty files 報 trailing whitespace；本輪文件變更的 scoped diff check 通過。release acceptance 不代表外部部署。
- **Version decision:** `0.3.0 — RELEASED` for the local Intelligence Delivery & Consumer Compatibility v1 acceptance gate, based on recorded Flow A–D browser evidence plus this round's fresh full test/build/health and IndexedDB verification. This is not a production deployment. v0.4 routing remains a separate work-in-progress scope; no next milestone was started.

### Receiver contract and evidence ledger（synthetic only）

- Contract match：Radar emits the Content Ops v1 envelope (`content-ops-handoff`, version 1, sourceSystem `ai_pm_radar`) with accepted item fields `externalId`, `kind`, `title`, `url`, `text`, `createdAt`, and provenance-only `metadata.radarDelivery`. Content Ops accepts these fields; no blocker or missing required field was found. The `externalId` is the immutable package ID; Radar source/handoff/package IDs and fingerprints plus provenance/evidence references remain in metadata.
- Receiver-side browser evidence：Package A re-import preview showed one possible duplicate; default skip left one Inbox source. Package B imported as a second Inbox source. After reload both appeared as separate `Needs review` items in Synthetic Radar Beta; Synthetic Radar Alpha had zero. Neither item was auto-approved; no Content Item, publication, Strategy, or Brand Memory change occurred.
- Traceability: SourceRecord `src_0a1f427a`; handoff `handoff_content_candidate_33b1e13f`; A package `delivery_content_candidate_a9f48cb23f7d4861` / package fp `0848e95e5d14803c` / handoff fp `059c8c260f7e80fd`; B package `delivery_content_candidate_2587cd39438f0eef` / package fp `2eae723eb4dc7c82` / handoff fp `f92403867ff31e9d`; evidence `src_0a1f427a:e0`. A and B share source/handoff identity but retain different immutable package and handoff fingerprints. Limitation: receiver stores both revisions but does not label A visually as superseded.

### v0.4 Definition of Done — acceptance checklist

- [x] Traditional Chinese relevance; semantic synonym group counts once; unrelated substring does not count.
- [x] Confidence describes observed-signal coverage, not scoring accuracy or truth.
- [x] Accept route; reject requires a reason; override requires a reason and alternate route.
- [x] Route acceptance does not approve a handoff; created artifact ID resolves to the same SourceRecord and correct route type.
- [x] Reload and backup/import; v1, v2, and v3 legacy migration regressions pass.
- [x] 390/768/1280 routing and 360/390/768/1280 Outbox widths have no horizontal overflow; long URL/evidence and stale/current states remain readable per browser evidence.
- [x] No blocking Console error in tested flows. Non-blocking local companion-automation connection refusals and favicon 404 were recorded, not hidden or treated as product success/failure.
- [x] Current tests, typecheck, validators, build and local mobile health pass; source/handoff approvals and formal daily gate remain distinct.
- v0.4 acceptance scope is closed. On 2026-10-11 the owner explicitly authorized the release bump; package metadata was updated from `0.3.0` to `0.4.0`. This is a local release decision only and does not imply deployment, production/live-model acceptance, external HTTPS acceptance, or physical-device acceptance.

## Source Inbox evidence recovery + quick-save mobile hotfix（2026-10-11）
- Owner reported `evidence_not_found` on phone. The existing server-side exact-source-span validator correctly rejects unverifiable model citations; no specific failing source/model response was retained for independent root-cause reconstruction, so a complete upstream fix is NOT VERIFIED.
- The analysis prompt now requests short, literal, contiguous excerpts and instructs the model to omit unsupported claims. No extra/retry AI call is added; no validation gate is relaxed.
- Source Inbox displays sanitized locations (claim/citation or method indices) from existing server diagnostics when present, explains manual source-evidence selection, and keeps failed model output unapplied. A new regression test confirms untrusted diagnostic paths/text are not surfaced.
- Existing 250 ms IndexedDB draft autosave retained; writes now enqueue in order to protect newer edits. A visible Save now button, last-saved time, and one-click JSON draft backup sit above Advanced Tools. Backup download uses a temporarily attached anchor and delayed object URL revocation for mobile browser compatibility.
- Fresh validation: Radar 120/120 tests, typecheck, both daily validators, build:mobile and health:mobile PASS. The current v0.4.0 static app was rebuilt and protected origin/helper/tunnel restarted; external unauthenticated /source-inbox returned Cloudflare Access 302. This is an in-place hotfix under v0.4.0, not a new semver release.
- NOT VERIFIED: real failing article re-analysis, authenticated physical iPhone download/restore, cross-device sync or any AI provider quota/quality improvement. No production daily file, Access policy, automation schedule, secrets, or repo Git housekeeping changed.

## iPhone Source Inbox defect triage & reliability hotfix (2026-10-11)
- Physical iPhone screenshots show AI analysis structural JSON failure, a long sticky mobile header, and a repeated `Saving sources` subscription state; the reviewed/unapproved state is an intentional separate human approval gate.
- Running helper diagnostics on the authorized Mac twice recorded Gemini HTTP 400 `FAILED_PRECONDITION` with `User location is not supported for the API use.` for `gemini-3.5-flash-lite`. This is a distinct observed failure from screenshot schema/evidence failures, and no live API request was made in this hotfix. A region-specific error classification/message was added without changing provider configuration, geographic settings or billing. `provider_region_unsupported` mock regression passes; region eligibility remains BLOCKED until the owner selects a legally supported provider / manual alternative.
- Subscription persistence fix: runtime-status read had been keyed on `storage === saved`, resulting in status merge -> IndexedDB write -> status read cycles. Runtime status is now loaded only once post-hydration; subscriptions/feed-items use debounced serialized writes and latest-write status. Feed parse failures explain RSS/Atom versus a regular article URL. This is a code-level fix; physical-iPhone follow-up is still REQUIRED.
- Mobile usability: non-sticky compact header at <=640px, Source Inbox moved to the second nav slot, horizontal nav scrolling rather than wrapping and one compact language control. Existing quick save / backup remains in Source Inbox; no change to SourceRecord/handoff approval gates.
- Fresh pre-deploy checks: Radar `npm test` 121/121 PASS, typecheck PASS, validate:data PASS, validate:daily PASS, build:mobile PASS and health:mobile PASS before final nav-only changes; re-run final build/health afterward. Did not change formal daily data, Access policies, credentials, automatic schedules, source data or paid providers. Physical device verified analysis, RSS persistence and scroll/download are NOT VERIFIED pending owner test.

## Phase 1.9 Stable Operations & Verified Content Delivery（2026-10-17）

- Origin 421 root cause bounded: `127.0.0.1` Host is intentionally rejected by the strict public-host guard. The host-safe probe (`Host: radar.lamlab.cc`, forwarded HTTPS) returns expected unauthenticated 401; `npm run health:mobile` passes. Cloudflare edge paths `/`, `/archive`, `/api/status` return unauthenticated 302, but that does not prove post-login origin connectivity.
- Current `npm run start:mobile` Origin/Helper are healthy on loopback 4320/4310. No local `cloudflared` process or matching Tunnel LaunchAgent was observed; authenticated external route remains NOT VERIFIED. No Tunnel, Production, or service configuration was changed.
- Archive/Dispatch Phase 1.8 runtime is in separate candidate checkout `feature/radar-unified-contentops-phase17` (`5c06509`), not the current Radar `main` (`e9c14c5`). Exact `/archive` returns local 200; `/archive/` is 404; LAN `/archive` without credentials returns 401.
- Fresh isolated synthetic HMAC → SQLite receipt → `personal-ai-consultant` pending parse → Content Ops draft mapping → ack/replay E2E passed. Security rejects unsigned, tampered, expired, wrong-brand, and changed-source deliveries. This did not write to live Content Ops or use real source material; receiver UI/browser import remains NOT VERIFIED.
- Content Ops Receiver binds `0.0.0.0:4496`; a LAN request with a spoofed allowed Origin receives HTTP 200 from the pending endpoint (body discarded). Existing Phase 1.8 contract explicitly limits this bridge to a trusted private LAN; CORS/Origin is not authentication. Never expose port 4496 to the Internet.
- Fresh checks: Radar 202/202 tests, typecheck, mobile health PASS; Content Ops receiver/UI contract 9/9; Phase 1.8 sender tests 3/3; isolated synthetic E2E 1/1. Real Owner-approved dispatch and authenticated post-Access flow remain HOLD. Details: `docs/qa/PHASE_1_9_OPERATIONS_AND_HANDOFF_2026-10-17.md`.

## Phase 2.0A mobile cloud preflight + synthetic E2E（2026-10-18）

- Fresh `npm run health:mobile` PASS: protected Radar origin is on `127.0.0.1:4320`, helper on `127.0.0.1:4310`; helper status reports Gemini / `gemini-3.5-flash-lite` / configured=true (presence only). Current process snapshot also shows Radar Tunnel connector running. No process was started/stopped in this audit.
- Production remains static `out/` + Access + Mac Tunnel/origin/helper. Source Inbox persists to browser IndexedDB; no verified current production API persists arbitrary SourceRecord drafts to D1. The synthetic capability contract remains fail-closed; `lib/cloud-sync-capability-gate.ts` rejects the existing `synthetic_only=true` API for real-source writes.
- `experiments/cloudflare-sync-spike/` is an earlier local prototype, not the integration target. Reusable bounded path is Phase 1.5 synthetic-only Worker/D1: Access-context Owner binding, fixed allowlisted `.invalid` records, owner-scoped D1, SHA/CAS revision checks, immutable history, 80 KB / 5 records / 8 revisions / 7-day limits; real-source flags remain false. It is not a low-friction general capture backend.
- Local Phase 1.5 source sync tests passed 12/12. Fresh two-context Chromium E2E passed create → independent context readback → update → stale-write 409 → refresh/history → explicit synthetic cleanup; local Worker + in-memory SQLite + simulated Access only. 390/768/1280 widths had no overflow. This is not remote D1 or iPhone acceptance.
- Unauthenticated navigation to the documented synthetic Worker preview reached the Cloudflare Access sign-in challenge. No credentials were entered. Authenticated Worker invocation, deployed Worker version/current D1 state, remote D1 persistence, physical iPhone/cellular, Mac-off readback, and cloud DB restore remain Unknown/Blocked pending Owner browser session and device verification.
- Fresh `npm test` 202/202, typecheck, `validate:data` (2 files/12 articles, no warning/error), and `validate:daily` passed. No build was run because current production origin serves `out/` while Tunnel is active; replacing served assets without a deployment request was avoided. No formal daily data, Access policy, Worker, D1, Tunnel, secret, or production setting was changed.
- Evidence and next decision: `docs/qa/phase20-mobile-cloud/`. Current decision: **HOLD** for remote D1 and real-device gates; bounded next GO is one existing Access-protected fixed-synthetic D1 round-trip after Owner authenticates, with no deployment/policy change or real source.
- Follow-up revalidation: local `health:mobile` still passes. Owner authorized one fixed-synthetic preview acceptance. The preview remained at Cloudflare Access sign-in; following the Cloudflare sign-in link landed at Dashboard `/login`, so no authenticated identity was established. No credentials were entered and no remote list/create/readback/cleanup or D1 mutation occurred. A browser tab inventory had emitted one-time OAuth callback parameters; they were not reused or recorded, and must not be reused. The exact synthetic remote test is **Blocked pending Owner sign-in**.
- The isolated local two-browser synthetic E2E was rerun after that block and passed again (local Worker + memory SQLite only); this adds no evidence of remote D1 persistence or physical-device acceptance.
- Configuration audit found two Wrangler JSONC files with the same Worker name but different state: the `next-pilot-preview` config disables multi-source sync and omits `SYNC_DB`, while `phase15b-synthetic-protected` enables the synthetic-only API and binds a separate D1. Without an authenticated deployed-capabilities read, current Worker version/config/binding and remote D1 state are Unknown; never infer deployment from a local config. Preflight now requires a read-only capability check before any authorized synthetic write.
- Owner later reported signed in; the Cloudflare Dashboard home loaded, but read-only browser requests to the protected Worker capabilities endpoint and multi-source pilot page both rendered `{"code":"unauthenticated"}`. Worker source maps this response to HTTP 401 when verified Access identity is missing or owner-hash binding fails; exact cause and deployed version/config remain unknown. No fixture/list read or remote D1 mutation was attempted. Remote synthetic E2E remains **BLOCKED** until the exact pilot URL renders its fixed synthetic-only workspace; see `docs/qa/phase20-mobile-cloud/preflight.md`.

## Collector → Research Brief visibility bridge（2026-10-18）

- Root cause: the public-feed Collector writes `.runtime/daily-radar-inbox.json`; Research Brief reads `.runtime/research/state.json`. There was no read bridge, so fresh Collector candidates could not appear in the Research Brief view. The observed local inbox had 55 items, all `needs_review` (discovered 2026-10-17); the separate runner state had 12 pending analyses and was last updated 2026-10-11. This is a visibility bridge only, not ingestion into runner analysis or approval.
- Added a protected, read-only helper route `/automation/collector-inbox` and same-origin allowlisted proxy `/api/automation/collector-inbox`. It validates version 1, caps file size/items, returns only bounded display metadata, forces the displayed state to `needs_review`, and never returns unapproved extra fields/raw HTML. Missing inbox is an empty-state condition; read errors do not hide usable Research Brief data.
- Research Brief now includes selected-day Collector candidates, newest first, and a 5/10/20/all display control; the same control removes the old hard-coded five-brief truncation. Candidate metadata is explicitly not represented as captured full text, completed analysis, or approval. No runner state, formal daily data, schedule, Access policy, remote Worker/D1, or deployment was changed.
- Verification for this bridge: full `npm test` passed 204/204; final focused helper/proxy/i18n tests passed 33/33; `npm run typecheck`, `validate:data` (2 files / 12 articles, no warnings), and `validate:daily` passed. The helper HTTP route was exercised once with the current local inbox: 200, 55 items, all `needs_review`, and no raw HTML/extra properties exposed. Project `npm run build:mobile` passed in an isolated copy, so the active repo `out/` was not overwritten. Authoritative mobile candidate: `docs/qa/phase20-mobile-cloud/artifacts/ai-pm-radar-phase20a-mobile-candidate-r3-2026-10-18.tar.gz`, SHA-256 `25ae8521b50988f6379521a21c90949bd2e915bc5a6619c4ee4d3906cfb2bf6f`; it contains static `out/` plus the mobile marker, no runtime or environment files. Local synthetic browser view showed 13 candidates, default 5 and All 13; source/date/review labels rendered, long URL wrapped at 390px, and cards remained readable at 768px. Browser console inspection was unavailable (Chrome DevTools MCP is not configured); no errors were reported by the accessibility snapshot, but console cleanliness and exact overflow metrics remain unverified. `npm run health:mobile` currently fails because the protected origin is not listening on 127.0.0.1:4320; the test helper and synthetic preview were stopped. No production deployment or real Cloudflare/D1 sync was attempted.
- Follow-up Source Inbox browser check used a fixed local `/api/fetch` response, not an external fetch or AI request. Synthetic URL → populated draft rendered in 11,983 ms including UI automation overhead; title/body/source were populated, IndexedDB auto-save was reported, and reload restored the draft. Review remained unreviewed/unapproved, AI remained unrequested, and candidate download stayed disabled. Temporary preview servers were stopped. This is local synthetic UI/state evidence only; it does not change the current health:mobile failure or prove production/mobile network behavior.
- Fresh revalidation: `npm test` 204/204, typecheck, `validate:data` (2 files / 12 articles, no warnings/errors), and `validate:daily` passed. Source Sync service tests passed 12/12 with in-memory SQLite. The independent two-context browser E2E initially hit loopback EPERM, then passed after narrowly approved binding to `127.0.0.1:8853`: synthetic create/readback, owner isolation, Revision 2, stale-write 409, history, cleanup, 390/768/1280 widths, same-origin requests, and no JS exceptions. This remains local simulation, not Cloudflare D1.
- Candidate r3 archive hash rechecked (`25ae8521b50988f6379521a21c90949bd2e915bc5a6619c4ee4d3906cfb2bf6f`); archive contains static output/build marker and no `.env*` or `.runtime`. No fresh build was run in this follow-up. `npm run health:mobile` freshly fails with `ECONNREFUSED 127.0.0.1:4320`; no origin/helper was started. A synthetic Source Inbox manual-text draft auto-saved and rendered, but the In-app Browser did not expose a download receipt or native file picker, so browser-level backup export/import/restore remains NOT VERIFIED despite unit-level versioned backup parser coverage. Local static preview was closed; no production/cloud mutation or AI request occurred. Full evidence: `docs/qa/phase20-mobile-cloud/preflight.md`.
- Fresh Collector/runtime status: `.runtime/daily-radar-inbox.json` has 55 `needs_review` candidates discovered 2026-10-17 and updated 2026-10-17T17:55:29Z; no 2026-10-18 snapshot is present. Research runtime has 29 feed items, 19 materials and 4 runs but was last saved 2026-10-11; last run partial (10 body attempts, 5 capture failures). `research:schedule status` confirms schedule disabled / LaunchAgent unloaded, collection enabled, AI analysis disabled. No schedule setting was changed; a daily run is not verified.

## Phase 2.0A Access follow-up (2026-10-26 HKT)

- Fresh browser navigation to `https://radar.lamlab.cc` displayed the Cloudflare Access page “Log in to AI PM Radar” with a Cloudflare sign-in option. The new flow was not activated because the browser navigation initiated it; Dashboard login does not establish a Radar Access session. No credentials or one-time URL parameters were recorded.
- No protected API call, remote D1 read/write, Access policy/Worker/Tunnel change, or deployment occurred. Owner must initiate and finish the Access sign-in before the already-authorized fixed-synthetic remote acceptance can resume.
- Source Inbox reports local IndexedDB save separately from cloud state; the normal panel says cloud is not connected. Synthetic cloud panels are test-only. Local save is not a cloud receipt. Remote D1, second-device persistence, and physical iPhone/cellular acceptance remain **HOLD / NOT VERIFIED**.

## Phase 2.0A synthetic save receipt (2026-10-26 HKT)

- Fixed a synthetic preview false-positive: `Cloud Saved` now requires a successful exact-record GET after POST and matching Source ID, revision and fingerprint. A failed readback stays `Failed`; retry checks for the exact already-written record and avoids duplicate POST; revision mismatch shows `Conflict`. Explicit state labels are limited to the test-scoped synthetic panel; ordinary Source Inbox remains local-only.
- Fresh local validation: React + Wrangler 4.149.0 local D1 integration PASS (failure injection, retry/idempotency, exact readback, manual approval invalidation, stale Revision conflict, two browser contexts, 390/768/1280 widths, no JS errors); `npm test` 204/204; typecheck and daily validators PASS. Isolated Next 16.2.9 mobile build generated 22/22 pages.
- New static candidate r5 is in `docs/qa/phase20-mobile-cloud/artifacts/` (SHA-256 `fe068db6698175c4a312ba0ead4df7fb6a880ab7f11037218598143c6f45d7ef`); not deployed. Details: `docs/qa/phase20-mobile-cloud/preflight.md`.
- Current Radar Access login page is visible, but the fresh sign-in was not continued. Remote D1/Server Receipt, cross-device production readback, physical iPhone/cellular capture and production deployment remain **HOLD / NOT VERIFIED**. No Access/Worker/D1/Tunnel, formal daily data, AI or schedule state was changed.

## Phase 2.0A Collector freshness follow-up (2026-10-26 HKT)

- Research Brief now consumes the Collector inbox `updatedAt` and labels the snapshot saved time, unknown time, or stale (>24 hours); it explicitly does not equate file timestamp with successful feed collection. Invalid or implausibly future timestamps are unknown.
- Current local inbox has 55 `needs_review` items from 2026-10-17 and `updatedAt=2026-10-17T17:55:29.313Z`; research runtime last saved 2026-10-11. Schedule is disabled, LaunchAgent unloaded, runner inactive, collection enabled, AI analysis disabled. No collection or AI run was triggered.
- Verification: `npm test` 205/205, `npm run typecheck`, `npm run validate:data` (2 files / 12 articles, no warnings/errors), `npm run validate:daily`, and isolated mobile export (Next.js 16.2.9, TypeScript, 22/22 pages) passed. `npm run health:mobile` fails `ECONNREFUSED 127.0.0.1:4320`; no services were started.
- Candidate r6: `docs/qa/phase20-mobile-cloud/artifacts/ai-pm-radar-phase20a-mobile-candidate-r6-2026-10-26.tar.gz`, SHA-256 `384b0ac2aa6c8bfa37bf3c4b0a1b2a1f5737904ba39354dfc8ab321cef57897b`; static-only, not deployed, repository `out/` preserved. Radar Access login page is visible but unauthenticated; remote D1, second-device and physical iPhone/cellular gates remain **HOLD / NOT VERIFIED**.

## Phase 2.0A Quick Capture mobile verification (2026-10-26 HKT)

- Moved the existing URL/text/file import panel above save, sync and advanced-tool sections to make mobile capture the first action after the intro. No ingestion, storage, AI or approval behavior was changed.
- Chromium 390×844 local run with synthetic text: created draft, autosave showed saved, reload restored the same body; AI remained not requested and no review/approval was issued. `documentElement.scrollWidth` and body width both measured 390px. This is local viewport simulation, not physical iPhone Safari/cellular acceptance.
- Local `npm run dev:local` used ports 45678/45679 and was stopped after testing. No external fetch, Gemini call, Cloudflare API, D1 or production endpoint was used.
- `npm test` 205/205; typecheck and isolated Next.js 16.2.9 mobile build (22/22 static pages) passed. Candidate r7 supersedes r6: `docs/qa/phase20-mobile-cloud/artifacts/ai-pm-radar-phase20a-mobile-candidate-r7-2026-10-26.tar.gz`, SHA-256 `d4ab49acaf2b17e7814b50128380afc59e5f41605f64029024b9f27327108244`; static-only and not deployed. Remote Access/D1, second device and physical phone remain **HOLD / NOT VERIFIED**.

## Phase 2.0A Access/origin retry — 2026-10-26 HKT

- Reopened `https://radar.lamlab.cc` in the in-app browser. It initially displayed Cloudflare Access `Log in to AI PM Radar`. The displayed Google sign-in account matched the Owner-provided identity; continuing the sign-in reached a Cloudflare error page for the Radar hostname with **HTTP 502 / Host Error**. This is evidence of an origin/route availability failure after the Access prompt, but is not proof that an Access identity assertion reached the origin.
- Fresh `npm run health:mobile` fails with `ECONNREFUSED 127.0.0.1:4320`; no Radar origin/helper listener is present on 4320/4310. No app/helper/Tunnel process was started or stopped, and no production deployment or Cloudflare configuration was changed.
- Fresh local synthetic Source Sync API run: `node --experimental-strip-types --test experiments/phase15-source-sync/test-service-local.mjs` passed **12/12** against in-memory SQLite. It covers capability-off, owner isolation, revisions/CAS conflicts, idempotency/duplicate IDs, retention, immutable history, and unauthenticated identity rejection. This is local simulation only; it does not establish remote Cloudflare D1 state or a Server Receipt.
- No protected API capability/list/create/readback call or remote D1 write was made. Keep `cloud_write_authorized=false`. The exact Cloudflare edge-to-origin/Tunnel fault remains undiagnosed; remote sync, second-device readback, and physical iPhone/cellular acceptance remain **HOLD / NOT VERIFIED**. Existing r7 remains an undeployed static candidate.

## Recovery R1 local capture follow-up (2026-10-29 HKT)

- Added a homepage Quick Capture entry for pasted URLs/text and TXT/Markdown/SRT/VTT files. It hands off one versioned, temporary `sessionStorage` payload to the existing Source Inbox parsers; existing IndexedDB materials are appended rather than replaced. It does not call AI, persist a second data model, or alter approval/evidence gates.
- Browser verification used only synthetic text at `http://localhost:47888/`: Home → Source Inbox created a new draft while preserving the prior synthetic card; auto-save reported success and reload restored both records and the entered body. No AI request, external fetch, review, approval, candidate export, or remote write occurred. Browser console errors: 0; desktop viewport 1280px had no horizontal overflow. Mobile viewport/physical phone not tested in this run.
- Corrected homepage copy that incorrectly claimed no backend/API key and labeled the latest data as “today”; the home labels now identify the latest available edition. Footer privacy copy now accurately says drafts stay in this browser and text is sent to the configured analysis service only after explicit AI analysis.
- Home Quick Capture reads a count-only summary from the existing Source Inbox IndexedDB and links back to the saved materials; it does not read/display source bodies. Browser readback on the isolated local origin showed 2 saved materials, 2 with body text, 0 missing body. This is not a server receipt or cross-device sync. At this checkpoint, per-item review state had not yet been added, so the summary did not invent a review count.
- Verification: `npm test` 207/207; `npm run typecheck`; `npm run validate:data` (2 files / 12 articles, no warnings/errors); `npm run validate:daily`; isolated `next build --webpack` generated all 22 static pages. The default Turbopack build in the isolated copy rejected the external `node_modules` symlink; the Webpack build passed. Repository `out/` and `.next/` were not overwritten.
- Local Dark Worker Access fallback regression re-run: `node --test experiments/phase13-one-article/test-worker-local.mjs` passed 15/15, including RS256 signature, issuer, audience, lifetime and exact Owner email-hash checks. This proves only the local Worker code path; no deployed Access JWT, D1, or external identity assertion was tested.
- The local app/helper started for the browser test was stopped. Desktop screenshot/DOM verification used the local app at 1280px; the browser controller cannot set a 390/768px viewport, and physical phone testing was not performed. No production deployment, Cloudflare policy/Worker/Tunnel change, D1 write, or formal daily-data edit was performed. Cloud persistence, cross-device readback, Content Ops receipt, authenticated production flow and physical mobile acceptance remain **HOLD / NOT VERIFIED**.
- Port override is via `AI_PM_RADAR_APP_PORT` and `AI_PM_RADAR_FETCH_PORT`; passing `--app-port` / `--fetch-port` is ignored by the current `run-local.mjs`. A port-conflict check caught the attempted default 3000 startup; only the current test session was stopped, and the unrelated existing 3000 listener was left untouched.

## Recovery R1 per-material review state follow-up (2026-10-29 HKT)

- Added optional review/approval fingerprints and rejection state to each existing Source Inbox material card. The legacy workbench-level state remains supported and is migrated to the active card only; old records without per-card fields remain unreviewed rather than inheriting another card's approval. Exact fingerprint comparison still makes edited content stale, and candidate gate logic was not relaxed.
- The Home count-only summary now reports saved materials, body availability, needs-review, reviewed-but-not-approved, approved and rejected counts. Explicit `null` on the active legacy fields supersedes stale per-card values. Labels distinguish reviewed-but-not-approved from not-yet-reviewed.
- Local synthetic browser E2E at `http://localhost:48888/`: created card A, explicitly marked it reviewed (not approved), created card B and left it unreviewed, returned Home and reloaded Source Inbox. Both cards and their separate states survived IndexedDB reload; Home showed 2 materials / 2 with body / 1 needs review / 1 reviewed-but-not-approved / 0 approved / 0 rejected. Candidate download remained disabled for missing required daily fields. No AI request, real source material, remote write or approval was used.
- Verification after the UI label correction: `npm test` **207/207**, `npm run typecheck`, `npm run validate:data` (2 files / 12 articles, no warnings/errors), `npm run validate:daily`, and scoped `git diff --check` passed. The immediately preceding isolated Webpack build after per-card changes generated 22/22 static pages; this follow-up only changed the displayed count label and its test expectation, so no new build was run. Repository `out/` and `.next/` remain untouched.
- The exact local app/helper session used for browser testing was stopped with Ctrl-C; ports 48888/48889 no longer have listeners. Other project processes were not stopped. Desktop viewport was 1280px; browser tooling did not provide 390/768px viewport control and no physical phone test occurred.
- Cloudflare Access identity assertion, production origin/Tunnel, remote D1 persistence, cross-device readback, Content Ops receiver receipt, 390/768px and physical iPhone/cellular acceptance remain **HOLD / NOT VERIFIED**. No deployment, policy/config change, D1 write or formal daily-data modification occurred.

## Recovery R1 operational preflight follow-up (2026-10-29 HKT)

- Initial local runtime check: canonical checkout remains `main` at `e9c14c5`; Origin/helper were absent and the sandbox health request returned `EPERM`. After the mobile build was regenerated, `npm run start:mobile` restored loopback Origin/helper at `127.0.0.1:4320` and `127.0.0.1:4310`; `npm run health:mobile` now passes. Unauthenticated `https://radar.lamlab.cc` displayed Cloudflare Access login, which does not establish post-Access Origin health. Tunnel process status is Unknown because process enumeration was denied and no matching LaunchAgent appeared.
- Origin `421` is confirmed as expected Host enforcement: focused server tests passed 5/5; fresh requests returned 421 for loopback Host and 401 for correct public Host/HTTPS forwarding without Access JWT. Health reports Gemini / `gemini-3.5-flash-lite` / configured=true (presence only). No key validity or live analysis was tested.
- Archive belongs to the separate Phase 1.6 candidate checkout. Current loopback `/archive` returns 200; the listener is bound to stale LAN address `192.168.0.221`, while Wi-Fi is now `192.168.0.198`; current LAN URL fails to connect. No process restart or bind change was made.
- Content Ops Receiver remains active on `*:4496`. Status-only CORS preflight confirmed old Origin `http://192.168.0.221:4350` → 204 and current `http://192.168.0.198:4350` → 403. No pending GET/body or live DB was read. CORS is not authentication; the Receiver is a private-LAN-only bridge, not a cellular endpoint.
- Synthetic HMAC integration passed using the actual candidate sender and Content Ops Receiver handler with temporary SQLite files and synthetic 0600 secret: exact `personal-ai-consultant` receipt → pending parser → in-memory unapproved draft → deduplicated import → ack → safe replay. It did not touch the running receiver, browser localStorage, D1 or real data. Content Ops receiver/UI contract tests 9/9 and Radar receiver-dispatch tests 3/3 passed; no actual Inbox receipt was observed, so `import_confirmed` remains unset.
- Current decision: **GO** for local Origin/helper health and isolated synthetic contract; **HOLD** for authenticated public Origin, Archive LAN, actual browser Receiver import, cellular delivery and real-source dispatch. Detailed evidence: `docs/qa/RECOVERY_R1_OPERATIONAL_PREFLIGHT_2026-10-29.md`. No production, Cloudflare policy, Tunnel, D1, formal daily data or live Receiver database was modified.
- Local build/start recovery used existing `npm run build:mobile` and `npm run start:mobile`; Build ID `MLDs_0T8EdmQO2zJywsWJ` regenerated ignored `.next/` and `out/`, and the app/helper are currently running on loopback only. Fresh full suite **207/207**, typecheck and both daily validators pass. No public Tunnel, Access login, live receiver import or production deployment was activated.
- Local browser smoke at 360×800, 390×844 and 768×1024 CSS viewports found and fixed the text-import submit handler passing its click event into `createTextDraft` (`value.trim is not a function`). The callback now invokes `createTextDraft()` without the event. Synthetic text → draft card → reload restore passed at 390px; state remained captured, unreviewed and unapproved. Document width matched viewport at all three sizes; no horizontal overflow or post-fix console errors. No AI/helper request occurred. `npm test` **207/207**, `npm run typecheck`, and scoped `git diff --check` passed. The isolated dev app/helper on `127.0.0.1:49782` / `:49783` were stopped. This does not verify the production Origin, physical phone, or Content Ops receipt.
- Worker Access diagnostic: the local JWT verifier already validates RS256 signature, issuer, audience, `iat`/`nbf`/`exp`, and exact normalized Owner email hash; the synthetic valid-token test passes. All four checked Wrangler variants omit `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD`; the JWT fallback returns unauthenticated if either is absent. Whether production Dashboard vars are present and whether the assertion header reaches the deployed Worker remain unknown (not read). Added a regression proving either missing binding fails closed. No Worker auth code, Wrangler config, Cloudflare policy, D1, or deployment was changed. See Cloudflare's [JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) and [Workers Access context limitations](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).

## Recovery R1 mobile copy and navigation follow-up (2026-10-29 HKT)

- Simplified key Source Inbox, homepage quick-capture and footer privacy copy: drafts remain in the current browser, are not auto-synced, and only the explicitly selected material is sent after the user requests AI analysis. Interface-language guidance now says language switching does not alter or translate source text. The cloud-sync disclosure uses localized copy instead of a phase/internal label.
- Fixed narrow-screen bilingual navigation clipping: the 5-link navigation now wraps rather than requiring horizontal scrolling. In-app browser checks at CSS viewports 360×800, 390×844 and 768×1024 confirmed all links fit within the viewport and document width equals viewport. The 390px bilingual screen showed distinct Chinese/English labels; console error list was empty. This is viewport simulation, not physical-device or cellular acceptance.
- `npm test` **207/207** and `npm run typecheck` passed. Temporary local `npm run dev:local` on `127.0.0.1:49782` / `:49783` was stopped with Ctrl-C. No production deployment, cloud/API write, AI request, or formal daily-data change occurred.
- Files touched in this follow-up: `app/globals.css`, `components/CloudSyncOptInPanel.tsx`, `lib/i18n.ts`, `tests/i18n.test.ts`, and this context summary. Release remains **HOLD** for authenticated production access, cross-device sync, Content Ops receipt, and physical iPhone/cellular verification.

## Recovery R1 authenticated-sync recheck (2026-10-29 HKT)

- Fresh local `npm run health:mobile` with approved read-only loopback access passed: protected Origin `127.0.0.1:4320` is listening and fail-closed; helper reports Gemini / `gemini-3.5-flash-lite` / `configured=true` (configuration presence only). No AI request was made.
- Opened the documented fixed-synthetic multi-source pilot URL. Cloudflare returned its Access sign-in page; no signed-in Access session was present in the available browser. The page was closed without sign-in, capabilities/list requests, or D1 operations. Owner must finish the Access flow themselves before the already-authorized one-time remote synthetic test can resume.
- Current Cloudflare docs confirm the Static Assets internal router does not pass `ctx.access` to the user Worker, while Access still protects assets and Worker execution: [Worker Script](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) and [Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/). This repo's Worker has an RS256 `Cf-Access-Jwt-Assertion` fallback; issuer/audience bindings in the deployed environment and the live assertion path remain **UNKNOWN**. Do not infer that local Wrangler vars are deployed.
- Fresh local security/sync checks: `node --test experiments/phase13-one-article/test-worker-local.mjs` **16/16**; `node --experimental-strip-types --test experiments/phase15-source-sync/test-service-local.mjs` **12/12**; and `node experiments/phase15-source-sync/test-cross-device-browser-local.mjs` passed the complete two-browser workflow (fixed fixtures, create/readback, revision 2, stale write 409, immutable history, one-fixture cleanup, 390/768/1280 widths, same-origin requests, zero JS exceptions). The cross-device test uses a local Worker and **in-memory SQLite only**; it is not Cloudflare D1 evidence.
- No Cloudflare policy/config/Worker/D1/Tunnel or formal daily data was changed. Actual remote D1 readback, production build identity, Content Ops Inbox receipt, authenticated dispatch and physical iPhone/cellular acceptance remain **HOLD / NOT VERIFIED**. A receiver-side receipt is still required before `import_confirmed`.

## Recovery R1 Access/JWKS diagnostic recheck (2026-10-30 HKT)

- Preserved the existing dirty worktree. Loopback listeners: this repo's Origin/helper are bound at `127.0.0.1:4320` / `:4310`; `npm run health:mobile` passed with Origin fail-closed and helper reporting Gemini / `gemini-3.5-flash-lite` / configured=true (presence only). Ports 3000, 4482 and 4496 belong to other project services and were not changed.
- Fresh host-routing probe: configured public Host + HTTPS forwarding to `/api/status` without an Access JWT returned **401**; intentionally wrong Host returned **421**. The earlier 421 is strict Host enforcement, not the current allowed-host route failing.
- Owner-authorized diagnostic-only deployment was limited to `radar-phase13-one-article-dark` (current deployed Worker version `2ffaa86e-b30c-480d-9d21-fd92aa4fadc9`). The authenticated browser request to `/api/source-sync/v1/capabilities?auth_diagnostic=1` reaches the JWT verifier and returns enum `access_jwks_unavailable`. A read-only browser visit confirmed the configured Cloudflare Access public JWKS endpoint serves a key set; this does not prove the Worker-side fetch succeeds. No token, identity, key, or provider response was recorded. No Access policy, D1, Tunnel, production Radar, formal daily JSON, or Content Ops data was changed.
- Local verifier diagnostics now distinguish JWKS HTTP status class, request failure, oversized/missing/malformed response, and a missing signing `kid`; synthetic tests cover each path while asserting no D1 access. `node --test experiments/phase13-one-article/test-worker-local.mjs`: **18/18 PASS**; `node --experimental-strip-types --test experiments/phase15-source-sync/test-service-local.mjs`: **12/12 PASS**. Full `npm test` **207/207**, typecheck and both daily validators also pass. Wrangler dry-run passed (34 static assets); a sandbox log-file `EPERM` warning was emitted but the dry-run exited 0. These finer diagnostics are local only and are not in deployed version `2ffaa86e…`.
- Current block: identify whether the Worker-side JWKS request receives a non-2xx response or a transport/parse failure, then make the minimal fail-closed correction and separately authorize its deployment. Content Ops receiver-side receipt, `import_confirmed`, remote D1 round-trip and physical iPhone/cellular acceptance remain **NOT VERIFIED / HOLD**.

## Recovery R1 Access/JWKS diagnostic follow-up (2026-10-30 HKT)

- The user authorized one additional diagnostic-only deployment to the fixed synthetic Worker `radar-phase13-one-article-dark`; deployed version is `74971c01-25e8-4aed-b85f-3cd98960a371`. An authenticated browser request to `/api/source-sync/v1/capabilities?auth_diagnostic=1` now returns the fixed enum `access_jwks_request_failed`. This distinguishes a Worker-side request/transport exception from an HTTP non-2xx, invalid payload/size, or a signing-key ID mismatch. No assertion or identity values were logged.
- A direct read-only browser visit to the configured public Access JWKS URL returned JSON with a key set. A separate host-side Node fetch failed DNS resolution (`ENOTFOUND`); this is evidence about that host probe only, not proof of the Cloudflare Worker resolver's exact underlying cause. Current confirmed failure stage is outbound JWKS fetch from the Worker. Access authentication remains **NOT FIXED**; no further deployment or policy change was authorized.
- Fixed Worker diagnostic response remains limited to a single GET capability route and enum values. No D1 operation, Access policy change, production Radar change, Content Ops write, or formal daily-data change occurred.
- Added homepage `今日待審核` count, based on captured-at date in `Asia/Hong_Kong` and only materials whose current fingerprint still needs review. It is a local IndexedDB count, not cloud sync. Focused i18n/summary tests **6/6**, Worker tests **18/18**, and `npm run typecheck` passed. Build not rerun because the active served `out/` was intentionally left untouched.
- Fresh `npm run health:mobile` now returns `ECONNREFUSED 127.0.0.1:4320`; `lsof` found no listener on Radar ports 4320/4310. No service was started/stopped except an isolated static preview, which was stopped after visual inspection. An isolated `npm run build -- --webpack` passed and generated all 22 static pages; default Turbopack rejected an external `node_modules` symlink in the temp copy, so the successful build used Webpack. Repository `out/` remained untouched.
- A controlled local startup check then ran `npm run start:mobile`: Origin and helper both started on their expected loopback ports; `npm run health:mobile` passed with public-Origin Host guard and unauthenticated 401, helper status `gemini` / `gemini-3.5-flash-lite` / `configured=true` (presence only). The exact parent process was stopped with Ctrl-C after verification. The existing Cloudflare route/Tunnel was not tested by this local check.
- Next safe path: use Cloudflare's documented Worker Access identity context (`ctx.access`) only if the existing Worker Access protection is confirmed/configured for this exact synthetic Worker; otherwise inspect/repair Worker outbound access to the public JWKS endpoint. Any Access-policy/config change or another deployment needs separate authorization. Remote D1 round-trip, Content Ops receipt/`import_confirmed`, and physical iPhone/cellular acceptance remain **HOLD / NOT VERIFIED**.

## Recovery R1 JWKS root-cause fix (2026-10-30 HKT)

- Confirmed root cause from current Cloudflare Workers Request API docs: Workers do not implement Fetch redirect mode `error`; supplying `redirect: "error"` throws `TypeError` during Request construction, before any JWKS network request is sent. Therefore the deployed `access_jwks_request_failed` was caused by unsupported redirect mode, not evidence of DNS failure or signing-key mismatch. The separate host Node `ENOTFOUND` was not the Worker cause.
- Local fix: use `redirect: "manual"`; explicitly reject 3xx as `access_jwks_redirect_rejected` without following Location; remove the temporary public response of internal auth diagnostics while retaining local verifier callback tests. Exact RS256, issuer, audience, time-claim, Owner-hash, and fail-closed checks remain unchanged.
- Regression evidence: test first failed in both the expected places (redirect classification and valid JWT fallback) with the old `redirect: "error"`; after the fix Worker tests passed **18/18**, full `npm test` **207/207**, and `npm run typecheck` passed. No D1 query/write occurred.
- The currently deployed synthetic Worker remains version `74971c01-25e8-4aed-b85f-3cd98960a371` and still contains the previous diagnostic code. The local fix has **not** been deployed. No additional diagnostic deployment is needed; deploy of the actual fix/removal of diagnostics requires explicit authorization. Do not claim Access login works until the fix is deployed and the browser verifies it.
- Local mobile Origin/helper were started for health verification and then stopped. Remote D1 round-trip, Content Ops receipt/`import_confirmed`, production Radar, and physical iPhone/cellular acceptance remain **HOLD / NOT VERIFIED**.

## Recovery R1 synthetic Worker fix deployment (2026-10-30 HKT)

- Owner authorized deployment only to the fixed synthetic Worker `radar-phase13-one-article-dark`, with diagnostic output removed and no D1 operations. Deployed version: `203c5fb9-32d4-4f50-81ed-cddc84db3836`.
- The already Access-authenticated browser loaded `/api/source-sync/v1/capabilities` and received the expected read-only capabilities document (`enabled=true`, `synthetic_only=true`, `real_sources_allowed=false`, `access_required=true`). This verifies the deployed JWT/JWKS fix and authenticated capabilities path; it is not a D1 read/write or import receipt.
- The Worker rejects JWKS redirects manually and returns only generic unauthenticated errors; internal diagnostic codes are not exposed. No Access policy, production Radar, Tunnel, or D1 data was changed.
- Local regression: Worker tests **18/18 PASS**; `npm run typecheck` passed. Remote D1 round-trip, Content Ops receiver receipt/`import_confirmed`, physical phone/cellular acceptance and production deployment remain **HOLD / NOT VERIFIED**.

## Recovery R1 Playwright persistence evidence (2026-10-29 HKT)

- Fresh `npm run health:mobile` passed before the browser check. The protected production Origin still rejects a loopback-IP request with the wrong Host (421); no Access header was fabricated. Local UI verification used a temporary loopback Next development server on port 55231 in Webpack mode.
- Headless Chrome completed synthetic Paste Text → draft → IndexedDB save → reload restore. The exact body survived reload. No review/approval action, candidate export, AI analysis, or remote write was triggered. Page/console errors: 0; no horizontal overflow at CSS viewports 390/768/1280. The only companion request was a read-only loopback `GET /automation/status`; no external origin or `/analyze` request occurred.
- Screenshots: `docs/qa/recovery-r1-mobile-2026-10-29/` (Source Inbox import and reloaded draft at 390/768/1280). An initial Turbopack attempt emitted `ChunkLoadError` and was discarded; the Webpack-mode rerun passed. Temporary dev servers were stopped with Ctrl-C; production Origin/helper were left running.
- Remote Access-authenticated D1 acceptance remains pending the Owner's confirmation that the fixed `SYNTHETIC ONLY` pilot workspace is visible. No remote capability/list call or D1 action has been made. Physical iPhone/cellular, Mac-off readback, Content Ops receiver receipt, and production deployment remain **HOLD / NOT VERIFIED**.
- Fresh verification after the browser run: `npm test` **207/207**, `npm run typecheck`, `npm run validate:data` (2 files / 12 articles, no warnings/errors), `npm run validate:daily`, and isolated `next build --webpack` all passed; the isolated build generated 22/22 pages without touching the served `out/` or `.next/`. Repo-wide `git diff --check` only surfaced trailing whitespace in unrelated, already-dirty Deal Radar files; scoped Context Summary whitespace check passed.
- Prepared a separate static mobile candidate with the existing `npm run build:mobile` in a clean `/tmp` source copy (no `.env*`, runtime, Wrangler state, or unrelated Deal Radar files; dependencies copied locally). Candidate Build ID: `g4j-6B8TJ6WUW_PqWQtUt`; archive: `docs/qa/recovery-r1-mobile-2026-10-29/artifacts/ai-pm-radar-recovery-r1-mobile-static-candidate-2026-10-29.tar.gz`; SHA-256: `32639b14372e5431facd48d49dab34fbb11f3a98817ecb1dd2a6b24dad42de14`. Archive inspection found 237 entries, includes the mobile marker and Source Inbox page, and excludes `.env*`, `.runtime`, `.next`, `.git`, Wrangler config/state, and SQLite files. This is a **local undeployed candidate**, not production release evidence; existing production `out/`, Origin, Cloudflare configuration, and formal daily data were not changed.

## Recovery R1 post-deploy local preview check (2026-10-30 HKT)

- Confirmed the previous browser URL `127.0.0.1:43932/source-inbox/` had no listener. Rebuilt the current checkout with `npm run build:mobile`; Next static export completed and generated 22/22 routes. Started the protected local Origin/helper with `npm run start:mobile`: Origin `127.0.0.1:4320`, helper `127.0.0.1:4310`; `npm run health:mobile` passed. Helper status reports Gemini / `gemini-3.5-flash-lite` / configured=true (configuration presence only).
- Direct browser navigation to `127.0.0.1:4320` displays `Misdirected request` because the production Origin requires the configured `radar.lamlab.cc` Host and HTTPS forwarding; this is the intended Host guard, not a reason to weaken it. The browser was restored to the fresh static UI-only preview at `127.0.0.1:43932/source-inbox/`; screenshot/DOM showed the current Source Inbox workflow and zero browser console errors. Static preview does not provide authenticated API or remote functions.
- The synthetic Worker deployment and authenticated capabilities response recorded above remain the only remote deployment evidence. No D1 read/write occurred in this follow-up; interrupted file-selection flow is not treated as an acceptance result. No receiver evidence exists, so `import_confirmed` remains unset. Remote synthetic D1 create/readback/retry/CAS/delete, Content Ops receipt, external HTTPS, physical phone/cellular and production deployment remain **HOLD / NOT VERIFIED**.
- At that checkpoint, local Origin/helper and static preview were running. The subsequent verification below stopped only the Origin/helper because two `cloudflared` processes were present and their tunnel destinations could not be established without inspecting their arguments; no tunnel process was changed. The static preview remains loopback-only.

## Recovery R1 local synthetic save/reload verification (2026-10-30 HKT)

- Reused the loopback static build at `127.0.0.1:43932/source-inbox/`; entered one synthetic `.invalid` source, created a draft, and verified `captured / needs_review / not_approved`. After reload, the text and status remained in IndexedDB. Candidate export stayed disabled with explicit missing-field reasons; no review, approval, AI request, or remote API call was made.
- Responsive browser checks measured CSS widths 390 and 768; both had no horizontal overflow. Browser console errors: 0. Desktop/mobile screenshots are saved under `docs/qa/phase20-mobile-cloud/screenshots/` at CSS widths 390, 768 and 1280. A synthetic draft was cleared and a subsequent reload confirmed it was absent.
- Reverification on the current dirty worktree: `npm test` **207/207 PASS**; Phase 1.3 Worker tests **18/18 PASS**; `npm run typecheck`, `npm run validate:data` (2 files / 12 articles, no warnings/errors), `npm run validate:daily`, and `npm run build:mobile` passed. `npm run health:mobile` passed while Origin/helper were running, then correctly failed with `ECONNREFUSED` after this run stopped only its own Origin/helper to avoid possible routing through an existing unknown Cloudflare Tunnel. Static preview remains at `127.0.0.1:43932`; it is UI-only. No data/daily file changed.
- Current static build identity (manifest hash over sorted relative file paths and each file's SHA-256): `f570b7b15c5a8ae9cf5ca39532d8fd7aa7b9f12a163aa16e3f091e7de125d9be`. This is a local build fingerprint only, not a deployed Commit SHA or release ID.
- Current verified boundary: fixed synthetic Worker auth/capabilities path is deployed and previously verified; real cross-device D1 save/readback, external protected Origin through the active Tunnel, Owner cellular test, and Content Ops receiver confirmation remain **HOLD / NOT VERIFIED**. `import_confirmed` remains unset. No D1 was read or written.

## Recovery R1 Archive listener check (2026-10-30 HKT)

- Read-only inspection found two Archive listeners on port 4482 in the separate `ai-pm-radar-phase-1.5e-rc3/compliance-remediation/unified-library-phase16-candidate` checkout: one bound to `127.0.0.1`, one to the current `en0` address `192.168.0.221`. Neither process was changed.
- With no Access credential and the expected public Host/HTTPS forwarding headers, `/archive/` returned HTTP **403** on both loopback and LAN listeners (content types differed). A probe using the raw IP Host returned 404; the browser's private-network guard also blocked its LAN navigation before an origin response. Thus unauthorized access is denied, but the requested exact HTTP 401 behavior and authenticated Archive HTTP 200 were **not verified**. A direct shell probe without elevated network permission was blocked by `EPERM`; the authorized one-shot read-only check observed only status/content type.
- `:4496` Receiver is listening on `*:4496`; no request was sent. The actual Archive/Receiver launch configuration, owner-authenticated Archive read, LAN interface outside this Mac, and receiver import receipt remain **UNKNOWN / NOT VERIFIED**. Do not expose either service or infer `import_confirmed`.

## Recovery R1 synthetic E2E and local connection-message correction (2026-10-30 HKT)

- Confirmed the fixed synthetic Worker deployment is version `203c5fb9-32d4-4f50-81ed-cddc84db3836`; its authenticated capabilities response was previously verified. This run made no D1 or Receiver request and did not redeploy.
- Re-ran `experiments/phase15-source-sync/test-cross-device-browser-local.mjs` with isolated in-memory SQLite and two independent Chromium contexts. PASS: Access rejection, fixed synthetic fixtures, two create/read flows, revision 2, stale revision conflict (409), immutable history, backup verification, fixture deletion, 390/768/1280 widths, same-origin calls, and zero browser JS exceptions. This is local simulation, not remote D1 evidence.
- Re-ran `experiments/phase13-one-article/test-worker-local.mjs` (**18/18**) and `experiments/phase15-source-sync/test-service-local.mjs` (**12/12**). No remote D1 was read or written.
- On the loopback static preview at `127.0.0.1:43932`, Home Quick Capture at CSS 390×844 places its primary action within the first viewport (button bottom 795px). A synthetic text was handed into Source Inbox, saved to this browser's IndexedDB, and restored after reload. It remained `needs_review` / `not_approved`; the candidate gate stayed disabled with explicit blockers. No AI/API call occurred. The synthetic local draft remains in this browser; drafts do not sync to another device.
- The preview exposed a misleading connection message: ordinary static HTML fallback for a missing API was classified as an expired Cloudflare Access session because every `text/html` response was treated as a login page. `lib/companion-api.ts` now classifies Access expiry only from 401/403, a followed redirect, or a final `*.cloudflareaccess.com` URL; generic HTML is `companion_invalid_response`. Added regression tests for Access HTML and ordinary static fallback.
- Verification: `npm test` **208/208**, `npm run typecheck`, `npm run validate:data` (2 files / 12 articles; no warnings/errors), `npm run validate:daily`, and scoped `git diff --check` passed. An isolated `npm run build:mobile` completed TypeScript and all 22 static routes. Its output was copied into local `out/` after saving the prior output to `/private/tmp/radar-out-before-local-fix-20261030.tar.gz`; the existing loopback preview now serves the corrected UI. Reload confirmed the synthetic IndexedDB draft remains, the false expired-login message is absent, and candidate approval/export remains disabled. The preview still has no helper/API connection. The fixed synthetic Worker and production static site were not redeployed.
- Archive unauthenticated response remains verified as 403 only; authenticated Archive 200 is unknown. Receiver `:4496` was not contacted and there is no receipt, so `import_confirmed` remains unset. Remote D1, external HTTPS/Tunnel, Content Ops Inbox receipt, and physical phone/cellular acceptance remain **HOLD / NOT VERIFIED**.

## Recovery R1 data freshness root cause and Home disclosure (2026-10-30 HKT)

- Root cause: the Home Top 5 reads the checked-in static daily edition, while Collector inbox, Research Runner state, Source Inbox IndexedDB, and protected D1 are separate stores. The latest checked-in edition is `2026-07-02`; it is **120 calendar days old** on `2026-10-30`. The local Collector inbox has 55 candidates saved `2026-10-17`, but the Research Runner config currently has zero subscriptions. Schedule is disabled, collection is configured enabled, AI analysis disabled, and LaunchAgent is not loaded. The last run was `2026-10-11`, partial; feed sync was skipped, 0 feeds attempted, 10 body attempts and 5 failures. No new approved daily edition exists to publish.
- No Collector, AI, schedule or formal daily-data update was triggered. This preserves the data and billing/automation gates while distinguishing the static Home edition from local inbox candidates.
- Home now computes age from the current Asia/Hong_Kong calendar date and labels editions older than seven days. An in-browser check at `127.0.0.1:43932/` showed `2026-07-02`, `120 日`, and the stale-edition badge; Quick Capture remained visible and the locally saved synthetic draft count was labelled as current-browser-only. This date badge is a freshness warning, not a feed-success claim.
- Regression coverage checks Hong Kong midnight conversion, calendar age, invalid dates, future dates, and bilingual copy. `npm test` **209/209**, typecheck, `validate:data` (2 files/12 articles), `validate:daily`, isolated `npm run build:mobile` (22/22 routes), and scoped diff check passed. The generated local `out/` was updated after a `/private/tmp` rollback archive; no Cloudflare deployment or formal daily JSON was changed.
- Overall Recovery remains **HOLD**: existing sources need Owner curation/configuration before collection can resume; remote D1 cross-device persistence, current protected Origin/Tunnel, authenticated Archive, Receiver receipt, and physical iPhone/cellular use remain unverified. Do not set `import_confirmed` without Receiver evidence.

## Recovery R1 production reachability recheck (2026-10-30 HKT)

- Read-only browser request to `https://radar.lamlab.cc/` returned Cloudflare **502 Bad Gateway** with Browser/Cloudflare working and Host error. DNS resolves through Cloudflare. No Access login or Radar page loaded, so authenticated app behavior was not tested.
- Local `npm run health:mobile` fails `ECONNREFUSED 127.0.0.1:4320`; neither Radar Origin `:4320` nor helper `:4310` is listening. Two `cloudflared` processes exist, but no launch-agent label identifies a Radar mobile tunnel. Their command arguments/targets were not inspected; neither process was changed. Starting the Origin while their route is unknown could expose it through an existing Tunnel, so it remains stopped.
- Other listeners remain untouched: Archive `:4482` on loopback and LAN; Content Ops Receiver `*:4496`. No request was sent to either. Prior unauthenticated Archive result remains 403; authenticated 200 remains unknown.
- Confirmed production blocker is current edge-to-origin availability, not the local HTML-versus-Access message classification. No Tunnel, DNS, Access policy, production deployment, helper, D1, Receiver or daily data changed. Release remains **HOLD** until the exact Radar Tunnel route/target is identified and Owner-authorized Origin startup can be validated safely.

## Recovery R1 synthetic Worker Access repair deployment (2026-10-30 HKT)

- Under Owner authorization limited to the fixed synthetic Worker, deployed the existing fail-closed JWT verifier and removed any response diagnostics from `radar-phase13-one-article-dark`. Deployed Worker version: `cf2fc668-165a-4c79-92c4-eafd607d082f`. No Access policy, production Radar, Tunnel, Archive, Receiver or formal daily data was changed.
- Verification separated the two paths: an unauthenticated read-only capabilities request returned **HTTP 302** to the Cloudflare Access login host; the already-authenticated browser loaded `/api/source-sync/v1/capabilities` and received the expected synthetic-only capability JSON. That endpoint checks capabilities before any D1 binding access. Local `node --test experiments/phase13-one-article/test-worker-local.mjs`: **18/18 PASS**, including Owner JWT validation, unauthenticated denial and no D1 access in those tests. Wrangler dry-run succeeded (34 assets); deployment succeeded.
- Operational boundary incident: during an earlier browser check in this same task, opening `/multi-source-pilot/` automatically called the in-code fixture endpoint and `GET /records`; the latter performs one D1-backed list read. No create/update/delete was performed, but this exceeded the subsequently stated no-D1 boundary. Interaction stopped after discovery; no further data routes were called. The later capabilities verification did not query D1.
- The selected Wrangler configuration retains the existing hourly purge trigger (`PURGE_JOB_ENABLED=true`); deployment output confirmed triggers were deployed. This is existing automated behavior and can delete expired pilot rows. Do not describe the environment as having zero D1 writes. No direct D1 query or mutation was run by the deployment command.
- Synthetic Worker Access is now verified in the available browser session. This does not resolve the separate production `radar.lamlab.cc` 502 / stopped local Origin-helper diagnosis. Receiver-side Content Ops receipt, `import_confirmed`, remote persistence lifecycle and physical phone/cellular acceptance remain **NOT VERIFIED**; overall Recovery R1 remains **HOLD**.

## Recovery R1 production Origin restart and protected-page recheck (2026-10-30 HKT)

- Identified one active Cloudflare connector as launched by this repo's `scripts/run-radar-tunnel.mjs` (repo cwd); a second `cloudflared` process is parented by an interactive shell from `/Users/mattgor` and remains untouched. Started only the existing Radar `npm run start:mobile` launcher. Origin PID 10892 listens on `127.0.0.1:4320`; helper PID 10893 listens on `127.0.0.1:4310`. `npm run health:mobile` passes; helper reports Gemini / `gemini-3.5-flash-lite` / `configured=true` (configuration presence only).
- Current unauthenticated `https://radar.lamlab.cc/` returns **302** to Cloudflare Access. In the authenticated browser session, `/`, `/research/`, and `/source-inbox/` all rendered successfully; this resolves the present edge-to-origin outage for the protected app, but is not physical-phone or cellular acceptance.
- Home showed zero browser-local drafts and the static daily edition dated `2026-07-02`, **120 days old**, with its stale-data warning. Research Brief loaded 55 local Collector candidates from a `2026-10-18 01:55 HKT` snapshot (over 24 hours old); the selected `2026-10-18` runner day was not run and had no usable brief. The page notes that candidates are metadata/snippets and not approved sources. No feed run, AI analysis, content write, D1 request or Receiver request was made in this follow-up.
- Served static output tree: 226 files, deterministic tree SHA-256 `3f012619674606c7856ddce4b2e9a903a3f266e26fa088711c4877c58ba09d9a`. `.radar-mobile-build.json` identifies format/version/API base but has no semantic build ID; use the tree fingerprint as this output's identifier. No build or production asset deployment was run while `out/` is serving traffic.
- `npm test` **209/209**, `npm run typecheck`, `npm run validate:data` (2 files / 12 articles, no warnings/errors), `npm run validate:daily` all pass. Owner physical iPhone 360/390/768 acceptance, second-device persistence, Mac-off behavior, authenticated Archive read, Receiver receipt and real approved dispatch remain **NOT VERIFIED**. `import_confirmed` remains unset; overall Recovery R1 remains **HOLD**. The Radar Origin/helper are intentionally left running on loopback behind the already configured protected route.

## Recovery R1 Source Inbox status-label correction — 2026-10-30 HKT

- In the authenticated production browser, a newly captured synthetic text draft (not sent to AI) restored after reload and stayed `未審核 / 未批准`; candidate download remained disabled. The card showed `AI 草稿，待人工核對` despite `analysisStatus=not_requested`, which incorrectly implied AI had run.
- Local source now selects separate labels for AI draft, processing, failure, and rule-organized/not-requested states. Added Traditional Chinese and bilingual dictionary coverage. An isolated Webpack production build generated all **22/22** routes and its bundle contains the corrected labels. The currently served production static tree was not replaced or deployed, so the live page can still show the old label.
- Focused `node --test tests/i18n.test.ts`: **7/7 PASS**. Fresh `npm test`: **209/209 PASS**; `npm run typecheck`, `npm run validate:data` (2 files / 12 articles, no warnings/errors), `npm run validate:daily`, and scoped `git diff --check` passed. The first isolated Turbopack build attempt stopped on an external `node_modules` symlink restriction; isolated `next build --webpack` passed without touching `out/`.
- Attempted to clear only the synthetic test draft; the browser raised its native delete confirmation, then browser control became unavailable before the confirmation state could be verified. Deletion is therefore **UNKNOWN**; no second deletion attempt was made. No AI, fetch, cloud sync, D1, Receiver, or formal daily write occurred in this test.
- Prepared a separate public-source Owner review candidate from the Google Cloud AIHelp case page: `docs/qa/recovery-r1-owner-uat/aihelp-source-record-needs-review.json` plus `owner-review-brief.md`. It stores three exact short excerpts linked to the source URL; publication date is unknown (`null`). Local validator passed; AI remains `not_requested`, review is `needs_review`, approval is `not_approved`, and the existing reuse gate blocks it. Analyst notes are manual and explicitly caveated as vendor-reported results. No handoff/package or dispatch was created.
- Added `tests/recovery-r1-owner-uat.test.mjs` to the standard test command to guard exact excerpt provenance and the not-reviewed/not-approved gate. An isolated production Webpack build using same-origin `/api` generated 22/22 routes and emitted the corrected labels; build output stayed under `/private/tmp`, not the served `out/`.
- Current authenticated browser read of the fixed synthetic Worker's capabilities route returned the expected `synthetic_only=true`, `real_sources_allowed=false`, `access_required=true`, `human_review_required=true` contract. This route is read-only and precedes D1. Current terminal unauthenticated probe could not resolve the Worker hostname (HTTP 000, local DNS failure); dashboard version view redirected this browser to Cloudflare login, so the exact live Worker version was not independently re-read this turn.
- Static search of the canonical app found Content Ops v1 file-intake export support but no HMAC sender/Receiver dispatch implementation under `app/`, `components/`, `lib/`, or `scripts/`. Read-only inspection of the separate Content Ops checkout confirms its signed POST uses a server-only 0600 secret and Bearer HMAC; browser pending/ack routes rely on exact-Origin CORS and are documented for trusted LAN only. The Receiver docs explicitly forbid Internet exposure. The isolated Phase 1.8 synthetic Receiver E2E in the dated QA record is prior contract evidence, not proof the current mobile app is connected to that Receiver.
- Production static asset deployment remains **NOT DONE** in this follow-up. Overall Recovery R1 remains **HOLD** for physical-device/cellular proof, second-device persistence, Archive, receiver receipt, and owner-approved dispatch; `import_confirmed` remains unset.

## Recovery R1 synthetic Worker clean redeployment (2026-10-30 HKT)

- Under explicit Owner authorization limited to `radar-phase13-one-article-dark`, deployed the existing fail-closed Access JWT verifier with no diagnostic response path. Cloudflare version: `24ae7e77-f008-46a0-bf73-bfe06f2318ba`; URL: `https://radar-phase13-one-article-dark.lamms280.workers.dev`.
- Local `node --experimental-strip-types --test experiments/phase13-one-article/test-worker-local.mjs`: **18/18 PASS**. Wrangler 4.156.0 dry-run read 34 assets and bundled 166.56 KiB; deployment and version status succeeded.
- Unauthenticated external GET to `/api/source-sync/v1/capabilities` received Cloudflare Access **302** to sign-in before reaching the Worker. The browser session was not Access-authenticated, so the deployed post-login JWT verification remains **NOT VERIFIED**. No diagnostic response was observed or returned by the Worker.
- No D1 API or Receiver request was made by this redeployment or the post-deployment probe. The current Wrangler config still carries existing D1 bindings and hourly `0 * * * *` cleanup trigger (`PURGE_JOB_ENABLED=true`); these were preserved and not changed. The scheduled cleanup remains pre-existing behavior and may delete expired pilot rows.
- No Access policy, other Worker, production Radar app, Tunnel, Archive, Receiver, formal daily data or `import_confirmed` state changed. Overall Recovery remains **HOLD** pending authenticated post-deploy browser verification, remote D1 lifecycle, Archive read, Receiver receipt, Owner-approved dispatch and physical phone/cellular acceptance.

## Recovery R1 operations and controlled dispatch implementation (2026-10-30 HKT)

- Fresh local diagnostics: `npm run health:mobile` passed for loopback Origin `127.0.0.1:4320` and helper `127.0.0.1:4310`; Gemini/model status reports configuration presence only. Origin with incorrect Host returned **421** by design; expected `radar.lamlab.cc` Host plus forwarded HTTPS returned **401** without Access JWT; expected Host without forwarded HTTPS returned **400**. External `https://radar.lamlab.cc/` returned Access **302**. These verify guard behavior, not an authenticated end-to-end session.
- Archive exact path `/archive`: loopback `127.0.0.1:4482/archive` returned **200 HTML shell**; LAN `192.168.0.221:4482/archive` returned **401** without configured credentials. Both listeners belong to a separate phase-1.5e candidate checkout and were untouched. Receiver `*:4496` belongs to another checkout; no request was sent.
- Added a server-only HMAC sender to fixed loopback `127.0.0.1:4496/api/intake/radar`, Access-protected same-origin `/api/content-ops/*` routes, and explicit UI Brand choice from a server-side exact allowlist. It validates sealed/current package, three evidence-backed facts, source ID/SHA, approval age and exact Brand before dispatch. A versioned receipt is saved separately; it does not alter package state or set `import_confirmed`.
- Added an authenticated server-side Receiver status readback. Only a matching draft ID, Brand, SourceRecord ID, SHA-256, title, URL and three takeaways with Receiver status `imported` permits `import_confirmed`; pending, missing or mismatched responses leave state unchanged. The UI no longer offers manual Content Ops confirmation without this readback.
- Setup requires `AI_PM_RADAR_CONTENT_OPS_BRAND_IDS` and repo-external `AI_PM_RADAR_CONTENT_OPS_SECRET_FILE` (mode 0600). No real secret was read/configured, no real Brand ID was assumed, and there was no live Receiver call, D1 operation, or deployment. `personal-ai-consultant` remains unconfirmed against live Receiver configuration.
- Isolated synthetic E2E used the actual Content Ops Receiver module and temporary SQLite with `demo-brand-ai-pm`: signed POST, pending readback, ack and the new server-side import status readback all passed; temp DB/secret were removed. It did not contact live `:4496`, D1, or the browser import UI. Real Brand Inbox evidence remains **NOT VERIFIED**. Overall Recovery remains **HOLD** pending live Brand configuration, authenticated Archive read, browser import verification, and Owner-approved real-source UAT.
- Verification this run: `npm test` **216/216 PASS**, `npm run typecheck` PASS, `npm run validate:data` PASS (2 files / 12 articles), `npm run validate:daily` PASS, and isolated `next build --webpack` generated all **22/22** static routes. A temporary helper process on loopback returned `configured:false` when the exact Brand allowlist was empty, then was stopped. No active production Origin/helper was restarted and no `out/` build was replaced.
- Follow-up verification after adding Receiver import readback and collapsing technical details: `npm test` **217/217 PASS**, typecheck and both daily validators PASS, isolated Webpack static build **22/22 routes**. A temporary helper with empty Brand configuration returned fail-closed JSON for `/content-ops/status` and `/content-ops/import-status`; it was stopped without calling the Receiver. Protected production Origin/helper and `out/` remain untouched.
- Content Ops cross-repo regression: targeted `radarReceiver.test.ts` and `api/intake/radar.test.js` **10/10 PASS** with cache under `/private/tmp`; these cover import mapping, `needs_review`, Brand isolation, Receiver idempotency and ack. No Content Ops source files were changed. The browser UI import path remains NOT VERIFIED.
- The isolated static build was opened in the in-app browser at `127.0.0.1:43992/source-inbox/`; Traditional Chinese navigation and the source-capture flow rendered. The temporary server was stopped. Static preview has no helper/API; this tool session could not verify a precise 390px viewport or browser Console, so phone layout and actual form/dispatch interaction remain NOT VERIFIED. Existing protected Origin PID 10892/helper PID 10893 remain running the prior build; no restart or replacement of `out/` was performed.

## Recovery R1 synthetic Worker post-fix authenticated read check (2026-10-30 HKT)

- The current in-app browser opened the fixed synthetic Worker capabilities endpoint with the existing Access session. It returned HTTP 200 and the expected read-only contract: `enabled=true`, `synthetic_only=true`, `real_sources_allowed=false`, `access_required=true`, `owner_scoped=true`, and `human_review_required=true`; no diagnostic fields were present. This confirms the post-fix authenticated capabilities path currently works.
- The repository's latest deployment record identifies Worker version `24ae7e77-f008-46a0-bf73-bfe06f2318ba`; Cloudflare Dashboard redirected the available browser to sign-in, so the exact active version was not independently read in this check. No additional deployment was made because the fixed behavior is already live. No D1 route was opened or called.
- Local `node --test experiments/phase13-one-article/test-worker-local.mjs`: **18/18 PASS**. The prior diagnosis remains: Workers Fetch does not support `redirect: "error"`; it threw before the JWKS request. The deployed code uses `redirect: "manual"`, rejects redirects explicitly, and keeps generic fail-closed responses.
- This verifies authentication and the read-only capabilities route only. D1 lifecycle, cross-device persistence, authenticated Archive, actual Content Ops Receiver receipt, physical iPhone/cellular use and production dispatch remain **HOLD / NOT VERIFIED**. `import_confirmed` remains unset.

## Recovery R1 live Content Ops route version mismatch (2026-10-30 HKT)

- `npm run health:mobile` passed for protected Origin `127.0.0.1:4320` and helper `127.0.0.1:4310`; helper reports Gemini / `gemini-3.5-flash-lite` / `configured=true` (presence only).
- With the existing Access browser session, read-only `https://radar.lamlab.cc/api/content-ops/status` returned `{"code":"api_route_not_found","error":"Unknown API route."}`. A same-origin local helper request to `/content-ops/status` returned HTTP 404. Current checked-in working-tree sources do contain both proxy and helper routes, and an isolated Webpack build compiled and generated 22/22 routes. This is direct evidence that the running Origin/helper pair has not loaded the current route implementation.
- Process inspection identifies the active processes as this repository's `scripts/run-mobile.mjs` launcher (PID 10891), protected Origin (10892), and helper (10893), all started 2026-10-30 12:49 HKT with canonical Radar cwd. They are an active service pair. No restart or static-output replacement was made because this phase explicitly prohibits Production deployment; restarting the launcher would stop both Origin and helper.
- Prepared an isolated static mobile candidate at `/private/tmp/ai-pm-radar-r1-mobile-candidate-2026-10-30.tar.gz`. Build ID `CPl_G-9Wax5rHnH_gfQOD`; 215 static files; deterministic output tree SHA-256 `98b643fad36fd5d540bd4f26fac64513b9723365bda8d3d41e1386e15c56ac6d`; archive SHA-256 `f168f4de56711df856e95336be236de7c986b0873287883913a450f659c82802`. App/components/lib/scripts/data/public/fixtures and build config matched the canonical worktree used for this build; one unused temp-only `components/i18n.ts` file was absent from the build graph. The archive contains only static `out/` output, no environment, database, or log files. It is not deployed; repository `out/` was not replaced.
- The Owner UAT SourceRecord fixture currently validates with zero errors and has three evidence-backed claims, but remains `needs_review`, `not_approved`, and `analysis.status=not_requested`. It has not been packaged or dispatched. Real Receiver Brand configuration and the repo-external signing secret are not established; no receiver request was made.
- Current disposition: Access authentication on the synthetic Worker is **PASS**; current production Radar route activation is **FAIL / stale runtime**; actual Brand Inbox receipt and `import_confirmed` remain **NOT VERIFIED**. Next release step requires explicit authorization to activate the prepared mobile build/runtime, Owner review and approval of the candidate, and verified exact Receiver Brand configuration. No D1 or formal daily data was accessed or modified in this check.

## Recovery R1 synthetic Worker deployment and capture-summary fix (2026-10-30 HKT)

- Deployed only the explicitly authorized fixed synthetic Worker `radar-phase13-one-article-dark`, version `fe183d8f-7548-42cc-83bf-5a06e804c5dc`, preserving its existing variables and Access policy. The deployed source has the generic fail-closed auth response; temporary diagnostic output is absent. An authenticated in-app browser read of `/api/source-sync/v1/capabilities` returned the expected synthetic-only, Access-required capability fields. This is not production Radar deployment.
- The bilingual Home Quick Capture summary used single-occurrence string replacements, leaving repeated English placeholders unresolved. Added a small shared renderer that substitutes every occurrence and a regression assertion. The isolated static preview rendered both language variants with values; browser Console status was not independently captured.
- Synthetic D1 pilot used only the built-in fixture `src_f1500000000000000000000000000002` (“SYNTHETIC 雲朵盆栽教室”). Revision 1 was read from a second tab, updated to Revision 2 with approval invalidated, and the stale Revision 1 update was rejected with HTTP 409 `revision_conflict`; duplicate creation was rejected with HTTP 409 `article_already_exists`. Revision 1 and 2 hashes were visible in immutable history. These were two tabs in the same in-app browser profile, not independent browsers.
- Owner accepted up to seven days of active synthetic retention and the possibility of residual D1 Time Travel copies. Deletion of the fixture rows is awaiting a separate action-time confirmation; until then Revision 2 remains in the synthetic pilot D1 and expires at `2026-11-06T08:12:15.231Z`. Do not claim cleanup complete or that Time Travel copies are erased.
- Checks for the capture-summary change: focused i18n test 7/7, Worker tests 18/18, `npm test` 217/217, `npm run typecheck`, `npm run validate:data`, `npm run validate:daily`, scoped diff check, and isolated Webpack static build with 22/22 routes all passed. The local static preview was stopped after visual inspection. No formal `data/daily/` file changed.
- Real Content Ops Inbox receipt is still absent; no Receiver request was sent and `import_confirmed` remains unset. Production `radar.lamlab.cc` runtime remains stale for the new Content Ops routes; no production restart or deployment occurred. Overall Phase 1.9 remains **PARTIAL / HOLD** pending production route activation authorization, true independent-client readback, fixture cleanup confirmation, Owner review of any real item, and a matching Receiver receipt. Physical phone/cellular acceptance remains unverified.

## Recovery R1 fresh mobile preview and Owner retention decision (2026-10-30 HKT)

- Fresh `npm run health:mobile` check: protected Origin is listening/fail-closed on `127.0.0.1:4320`; helper reports Gemini `gemini-3.5-flash-lite`, `configured=true` (configuration presence only). No key value was inspected.
- A fresh Access-authenticated browser read of `https://radar.lamlab.cc/api/content-ops/status` still returns `{"code":"api_route_not_found","error":"Unknown API route."}`. This confirms the known active-runtime/source mismatch; no restart or production deployment was made.
- Isolated static preview at loopback port 43996 was inspected at CSS viewport 390x844 in zh-Hant and bilingual. On this origin, a synthetic pasted-text SourceRecord was created, the page reloaded, and the item remained saved in IndexedDB as captured / needs review / not approved. The review screen kept candidate download disabled and listed missing review, approval, source URL/creator, evidence grade, key claims, daily metadata and enrichment. This is browser-local evidence only; no helper or Gemini call occurred. Static preview requests to unavailable `/api/automation/status` and `favicon.ico` returned 404, so this was not API/console or production verification. The preview server was stopped and the browser viewport override reset; the synthetic local-origin IndexedDB item may remain if that origin is reopened.
- Owner chose to retain the synthetic D1 fixture until its seven-day expiry. The row remains in the fixed synthetic pilot D1 as Revision 2 through `2026-11-06T08:12:15.231Z`; no delete was attempted. D1 Time Travel copies may outlive row deletion/expiry.
- The Google Cloud AIHelp public-source Owner UAT record remains valid but `needs_review`, `not_approved`, and `analysis.status=not_requested`; `tests/recovery-r1-owner-uat.test.mjs` passes 2/2. No real source dispatch was made. No Receiver receipt exists and `import_confirmed` remains unset.
- Current disposition remains **PARTIAL / HOLD**: local capture/reload and candidate gate are verified; remote production route activation, independent second-browser/device readback, AI live analysis, Owner approval, Content Ops receipt, and physical phone/cellular use are not verified. The only Worker deployment remains the authorized fixed synthetic Worker; no production app or daily JSON was changed.

## Recovery R1 one-shot Gemini synthetic analysis check (2026-10-30 HKT)

- After checking that the active local helper reports configured Gemini, made exactly one live call to the existing local `/analyze` route using one short synthetic English sentence only. The helper used provider `gemini`, model `gemini-3.5-flash-lite`; HTTP **200**, returned the same synthetic source ID/version, diagnostics stage `completed`, and usage `799` input / `1,182` output / `1,981` total tokens. Existing `validateAIAnalysisDraft` returned `valid: true`, including exact evidence matching.
- This directly verifies the helper/provider/schema/evidence path only. The response was not applied to a SourceRecord or browser draft, and no review/approval/verified status changed. No other saved material was sent; no retry, billing configuration, provider selection, or production state changed. Account billing tier was not verified, so do not claim zero charge from this request.
- Overall Recovery remains **PARTIAL / HOLD**: browser UI → helper result mapping and persistence after AI analysis, independent device readback, production route activation, Owner approval, Receiver-side receipt, fixture deletion (Owner chose retain to expiry), and physical phone/cellular use are still outstanding.

## Recovery R1 Origin stale-route root cause and rollback point (2026-10-30 HKT)

- Fresh read-only listener inspection confirms Radar launcher PID `10891`, Origin PID `10892`, helper PID `10893`; all are this repo's process pair started `12:49:37 HKT` and remain running. No process was stopped.
- `scripts/mobile-production-server.mjs` was modified `14:22:21 HKT` to add `/api/content-ops/status`, `/dispatch`, and `/import-status`; the active Node Origin started earlier and retains the prior in-memory route map. `out/.radar-mobile-build.json` is from `12:30:51 HKT`. The still-live Access-authenticated `/api/content-ops/status` response is `api_route_not_found`. This confirms a stale Origin process plus stale static output, not an Access login failure. 421 remains the intentional Host guard.
- Detailed evidence and gated activation/rollback procedure: `docs/qa/recovery-r1-mobile-runtime-2026-10-30.md`. Preserved current static `out/` at `/private/tmp/radar-live-out-rollback-2026-10-30.tar.gz` (SHA-256 `1a286cc5f358dc8bbdbb9f197a3c1e2f9e75f028ac69951c6d004b741cd1dadf`). The isolated candidate archive is unchanged and not deployed. No production restart/deploy occurred.
- Overall status remains **PARTIAL / HOLD** pending explicit Production activation approval, browser-to-helper analysis apply/persistence, true second-device readback, separate reuse/candidate approval, matching Content Ops Receiver receipt, and physical iPhone/cellular UAT. The synthetic pilot D1 fixture remains through its approved expiry; `import_confirmed` remains unset.

## Recovery R1 Owner UAT source recheck (2026-10-30 HKT)

- Re-opened the public Google Cloud AIHelp case page. The three exact excerpts still appear: 70% less multilingual model development time, 5–10% user satisfaction increase, and 30% higher case-handling efficiency. The page gives no publication date or measurement baseline, sample size, period, or method for those outcomes. They remain vendor-reported, not independently verified.
- Added the recheck result to `docs/qa/recovery-r1-owner-uat/owner-review-brief.md`. Owner retained the three vendor-reported claims at evidence grade **B** and approved their use only in an editable Content Candidate draft. The SourceRecord fixture now records `review_status: reviewed`, `approval_status: approved` for this scoped reuse, and `analysis.status: not_requested`; `published_at` remains null. It contains only short exact excerpts (not the full article). The handoff itself remains `draft`, not reviewed or approved; no daily candidate or dispatch is approved.
- A versioned Source Library backup with the Content Candidate draft is included for local import/editing. The daily converter still blocks this SourceRecord when no daily metadata is supplied. No DeliveryPackage, dispatch, D1 write, Receiver receipt, or formal daily-data change occurred. Target Brand configuration must be revalidated before dispatch; `import_confirmed` remains unset.
- Imported that backup into the existing local browser at `127.0.0.1:43932/research/`; the SourceRecord and editable Content Candidate handoff remained in IndexedDB after reload. The page showed handoff status `draft`, review/approval actions incomplete, disabled explicit approval, and empty Delivery Outbox. This origin is local-only; no helper/AI route or cross-device sync was available. No UI edit was made after import.
- Captured 390px mobile and 1280px desktop editor screenshots under `docs/qa/recovery-r1-owner-uat/`; the browser Console error list was empty. Temporary viewport override was reset.

## Recovery R1 synthetic pilot read-only capability recheck (2026-10-30 HKT)

- In the authenticated browser, read the fixed synthetic pilot's `/api/pilot/capabilities`. It reports Access required, isolated database, owner-scoped access, synthetic-only operation, maximum seven-day retention, `real_upload_enabled=false`, `cloud_write_enabled=false`, and `controlled_commit_enabled=false`. This is capability evidence only; it does not establish that a record can be read from another browser/device.
- No pilot record/history route, D1 read or write, dispatch, or Receiver request was made in this recheck. The previously retained fixture remains subject to its approved expiry; no deletion was attempted. `import_confirmed` remains unset.
- Production activation remains pending explicit Owner authorization. The existing production runtime/content-route mismatch has not been rechecked or changed in this step. Overall Recovery R1 remains **PARTIAL / HOLD** pending production route activation, independent-client persistence evidence, and a matching Content Ops Receiver receipt before any `import_confirmed` claim.

## Recovery R1 fresh runtime and verification audit (2026-10-30 HKT)

- Fresh authenticated-browser GET of `https://radar.lamlab.cc/api/content-ops/status` still returns `api_route_not_found`. Direct loopback navigation to `http://127.0.0.1:4320/api/content-ops/status` returns “Misdirected request” (the expected wrong-Host guard, HTTP 421). No Origin policy was relaxed.
- Loopback Archive `/archive` rendered the private Archive shell. A browser navigation to LAN `192.168.0.221:4482/archive` failed with `ERR_INVALID_AUTH_CREDENTIALS`; this is not a successful authenticated LAN read. Existing listener inspection shows Origin PID 10892 and helper PID 10893 are Node processes with cwd equal to this repo; no process was stopped.
- `npm run health:mobile` could not connect from the restricted shell and returned `EPERM` for `127.0.0.1:4320`, despite the listeners being present. Treat this as an environment-limited probe, not proof that the service is stopped.
- Fresh local verification: `npm test` **218/218 PASS**; `npm run typecheck` PASS; `npm run validate:data` PASS (2 files / 12 articles, no warnings/errors); `npm run validate:daily` PASS (2 files / 12 articles). No build, production restart, D1 operation, Receiver request, or dispatch was performed.
- Disposition remains **PARTIAL / HOLD**. Production route activation still requires explicit Owner GO; independent-device persistence and Content Ops Receiver-side receipt remain unverified. `import_confirmed` remains unset.

## Recovery R1 stale Research date label fix (2026-10-30 HKT)

- Fresh authenticated production Research page showed the selected/latest runner date as `2026-10-18`, 55 Collector candidates with a snapshot at `2026-10-18 01:55 HKT` marked older than 24 hours, and the run state `尚未執行`. The same page mislabeled `2026-10-11` as `今天` while its current HKT clock showed `2026-10-30`.
- Root cause: `ResearchBriefs` used `date === state.daily.date` to render the `今天` label. `state.daily.date` is the latest runner date, and can be stale; it is not the current calendar date. Added `isResearchDateToday()` using the existing Hong Kong date function and changed the option label to compare against the actual HKT date. This changes display only; it does not run or alter the research runner.
- Regression test first failed because the new helper was absent, then `node --experimental-strip-types --test tests/research-runtime.test.mjs` passed **17/17**. Full `npm test` passed **219/219**; typecheck and both daily validators passed. Isolated Next.js 16.2.9 Webpack static build succeeded, **22/22 routes**, Build ID `jZ438EaxBpLDGHG-s3gB3perl`, 214 output files under `/private/tmp/radar-r1-build.w0zFD1/out`. The served repository `out/` and active production services were not changed.
- Production UI still serves the prior build and has not received this label fix. Its Collector snapshot remains stale and the latest runner state remains not-run; no feed refresh or AI analysis was triggered. Production activation awaits explicit Owner GO. Overall Recovery remains **PARTIAL / HOLD**.
- The same authenticated read-only page check showed Home's static daily edition dated `2026-07-02` with a 120-day stale warning. Home reported one browser-local material; Source Inbox showed one `#1` material card and cross-device sync disabled. The accessibility tree's `Value: 2` on the “素材清單” heading is its H2 level, not a count. There is no confirmed Home/Inbox count mismatch.

## Recovery R1 mobile review UI and isolated persistence check (2026-10-30 HKT)

- Removed the expandable raw candidate/SourceRecord JSON inspector from the human review page and removed its technical labels. The human-readable review state, blocker links, candidate download gate, and explicit SourceRecord backup download remain.
- Isolated static build after the date-label and JSON-inspector changes succeeded with **22/22 routes** (214 output files), Build ID `VTkwiQtJ1OpzYnA_TCZt`; output is under `/private/tmp/radar-r1-ui-build.8MWdPW/out`, not the served repo `out/`.
- In a local browser preview at `127.0.0.1:43981`, entered one synthetic Paste Text item, advanced to Review, and reloaded. The item persisted in IndexedDB, stayed unreviewed/unapproved, and candidate download stayed disabled. The review page no longer exposed a JSON inspector; SourceRecord backup download remained available. Browser error log had zero errors. No helper/API, AI, D1, production data, or Receiver call occurred. The temporary static server was stopped; the synthetic IndexedDB row may remain scoped to the preview origin.
- Post-change checks: `npm test` **219/219**, typecheck, `validate:data`, `validate:daily`, and scoped diff checks passed. This is local UI/persistence evidence only; it does not prove production deployment, cloud persistence, or a physical phone flow.

## Recovery R1 authorized mobile production activation (2026-10-30 HKT)

- Owner authorized one activation of the prepared mobile build at `radar.lamlab.cc`, limited to restarting this repo's production launcher/Origin/helper. Activated Build ID `dQ3HcT4SOpg2T6388yCL6`, 209 files, output-tree SHA-256 `a4dc5b5f4f338ec16852c05a578bef109700d13246675e5b611f5750ac52845b`. Build was isolated from dirty worktree daily-data edits and used `HEAD` for the existing 2026-07-02 edition.
- Pre-activation rollback archive: `/private/tmp/radar-r1-out-preactivation-20261030.tar.gz`, SHA-256 `627b4688b4fe542384f1ada4ae8f02d726d9e9803c56f59b0574d8b4dcae6312`; directory copy `/private/tmp/radar-r1-out-directory-preactivation-20261030`. Production launcher remains active. `npm run health:mobile` passes for Origin `127.0.0.1:4320` and helper `127.0.0.1:4310`; helper reports Gemini `gemini-3.5-flash-lite`, configured presence only.
- Access-authenticated browser loaded Home, Research Brief and Source Inbox at `https://radar.lamlab.cc/`; unauthenticated HTTPS returned Access 302. `/api/status` reports expected provider/model status. `/api/content-ops/status` reaches the implemented route but remains fail-closed with `content_ops_brand_allowlist_missing`; no dispatch or Receiver call was made. Unknown API path returned JSON 404. Console errors: 0 on Inbox and Research Brief; viewport widths 360/390/768 had no horizontal overflow.
- UI smoke in isolated static preview confirmed a synthetic text can be captured and saved to that preview origin's IndexedDB. Production Source Inbox showed an existing browser-local synthetic draft, still unreviewed/unapproved with candidate download disabled; it was not edited. No cross-device persistence was tested. Research snapshot remains stale at 2026-10-18 (55 candidates); static daily edition remains 2026-07-02. No runner, live Gemini call, formal daily write, Worker deployment, Access/Tunnel change, or D1/Receiver operation occurred.
- Local verification: `npm test` **219/219**, `npm run typecheck`, `npm run validate:data`, `npm run validate:daily`, isolated `npm run build:mobile` (22/22 routes), and post-start `npm run health:mobile` passed. Build warning: pre-existing Node module-type warning for `source-feed-parser.ts`.
- Disposition: production static UI/runtime activation **PASS**; end-to-end Content Ops delivery **HOLD** because the exact Brand allowlist is not configured and no receiver-side receipt exists. `import_confirmed` remains unset. Physical iPhone/cellular and independent second-device tests remain NOT VERIFIED. Rollback steps and hashes are in `docs/DEPLOYMENT.md`.

## Recovery R1 post-activation readback and delivery gate (2026-10-30 HKT)

- Fresh Access-authenticated production navigation to `/archive/` rendered the Archive UI and 12 articles from the 2026-07-02 static edition. This confirms the page is served, not that its content is current. `/api/content-ops/status` returned `configured=false`, `brand_ids=[]`, `content_ops_brand_allowlist_missing`, `receiver=loopback_only`.
- Production Source Inbox showed one browser-local synthetic capture. It remained `needs_review` / `not_approved`, listed missing evidence/daily fields, and kept candidate download disabled. No browser storage was changed. This confirms no accidental approval or daily-candidate bypass.
- The Owner AIHelp backup currently contains a SourceRecord approved for scoped source reuse, but its `content_candidate` handoff has `status=draft`, `reviewed_at=null`, `approved_at=null`; `delivery_packages=[]`. It is not eligible for dispatch. The Owner confirmed the exact live Brand ID is **未確認**; do not use `personal-ai-consultant`, which was only used in an isolated contract test. The prior Owner decision approved an editable draft only.
- Focused tests: Owner UAT + Content Ops dispatch + secure handoff **13/13 PASS**. `mobile-production-server.test.mjs` first could not bind a local socket under restricted permissions (`listen EPERM`); the same test was rerun with loopback permission and passed **6/6**, including unauthenticated fail-closed, wrong Host **421**, and exact-Origin dispatch proxy guard. The existing Node module-type warnings remain non-blocking.
- Next gates require Owner review/approval of the exact handoff for the exact verified Receiver Brand, then explicit authorization to dispatch. After dispatch, only matching Receiver-side import readback can establish `import_confirmed`. No Receiver request or D1 operation has occurred.

## Recovery R1 cloud persistence capability audit (2026-10-30 HKT)

- Read-only authenticated production GET `/api/cloud/capabilities` returned JSON `api_route_not_found`. `CloudSyncOptInPanel` only creates/restores a local Cloud ID mapping and explicitly makes no remote request; Source Inbox drafts remain in browser IndexedDB.
- Read-only authenticated fixed synthetic Worker GET `/api/pilot/capabilities` returned `isolated_database=true`, `one_article_only=true`, `max_retention_days=7`, `real_upload_enabled=false`, `cloud_write_enabled=false`, and `controlled_commit_enabled=false`. It is a bounded synthetic pilot, not a general SourceRecord gateway.
- Cloud persistence root cause is now specific: production has no same-origin cloud capability route and the only existing Worker is deliberately synthetic-only. No cloud sync was represented as enabled, no actual material was uploaded, and D1 was not read or written in this audit.
- Updated Phase 2.0A goal and QA preflight, architecture decision, device UAT and evidence index with current-build evidence. Cloud Save/cross-device acceptance stays **HOLD** pending a separately approved secure gateway scope, Owner source consent/backup gates, independent-device readback and Mac-off test.
- 2026-10-30 local gateway implementation (not deployed): added `experiments/phase20-cloud-source/service.mjs` and routed `/api/cloud/capabilities`, list/read/history/create/update through the existing Access-verified Phase 1.3 Worker. It uses a dedicated `CLOUD_SOURCE_DB`, never `DB` or synthetic `SYNC_DB`; all real-source writes require explicit flags, a dedicated binding, purge-job enablement and an operator attestation that the purge schedule is configured; they are disabled by default. Requests are Owner-scoped; writes require same-origin headers, a valid captured SourceRecord, exact evidence references when present, explicit per-source backup/rights/retention attestations, immutable revisions and expected-revision/fingerprint CAS. New/edited records start `needs_review` / `not_approved`; no delete endpoint or daily write exists.
- `lib/cloud-sync-capability-gate.ts` now includes backup, rights, seven-day retention and D1 Time Travel residual acknowledgements in its explicit write plan, matching the Worker contract. Tests use synthetic data and in-memory SQLite. Full `npm test` passed 227/227; `npm run typecheck`, both daily validators and scoped `git diff --check` passed. Static build was not run because `next.config.ts` exports directly to `out/`, the currently activated production static tree; a build here could replace served files and exceed local-only implementation scope.
- This is not a deployment: no Wrangler config, live D1, Access policy, production route, tunnel, formal daily data or existing process was changed. The local schema test reuses the Phase 1.5 simulation SQL only in in-memory SQLite; do not apply it to a live database. `radar.lamlab.cc` remains without `/api/cloud/capabilities`; Source Inbox remains IndexedDB-only. Remote cloud save, second-device readback, real authenticated browser and real D1 are NOT VERIFIED. Deployment/live save requires separate approval and dedicated D1 schema review.

## Recovery R1 current delivery evidence and GO/HOLD (2026-10-30 HKT)

- Runtime diagnosis: a request to the protected Origin using its loopback IP as Host returns **421** by design; expected public Host + forwarded HTTPS without Access identity returns **401**, fail-closed. The Access-authenticated browser loaded `https://radar.lamlab.cc/` and read the helper status (`gemini`, `gemini-3.5-flash-lite`, `configured=true`; presence only). This establishes current external page reachability, not cloud draft persistence.
- Authenticated `/api/content-ops/status` returns `configured=false`, `brand_ids=[]`, `content_ops_brand_allowlist_missing`; no dispatch is eligible. `/api/cloud/capabilities` returns `api_route_not_found`, confirming the local Phase 2.0 cloud gateway has not been deployed. No D1 operation occurred in this check.
- Archive: loopback `:4482/archive` returns **200**. The LAN listener belongs to a separate Phase 1.6 candidate checkout and remains bound to `192.168.0.221`; this Mac's current interface is `172.20.10.3`, so the old LAN address timed out. The stale listener was not stopped/rebound. The earlier LAN 401 is not current evidence.
- Synthetic HMAC E2E **PASS, isolated only**: the real Radar sender and Content Ops Receiver handler were exercised with a disposable SQLite database and generated test-only signing secret. Signed POST → receipt → draft readback → exact-origin import acknowledgement → imported readback → identical retry returned the same draft; one synthetic row existed. The temporary DB/secret were removed. This did not contact the live `:4496` Receiver, its persistent database, a real Brand Inbox, or D1.
- Owner-reviewed AIHelp material is approved only for an editable Content Candidate draft. The exact production Brand ID remains **unconfirmed**; `personal-ai-consultant` was used only in isolated contract testing and must not be inferred as the target. No real dispatch or Receiver receipt exists; `import_confirmed` remains unset.
- Added `docs/qa/recovery-r1-owner-uat/content-opportunity-brief.md` as separate editorial guidance with source-reported facts, analyst interpretation, uncertainties, a content angle and optional CTA idea. It does not change or approve the handoff. Corrected the Owner brief to state the Brand ID is unconfirmed and the isolated test Brand is not a production target. Owner UAT + dispatch tests remain 8/8 PASS; no package or dispatch was created.
- Fresh verification: `npm test` **227/227 PASS**; `npm run typecheck`, `npm run validate:data` (2 files / 12 articles; no warnings/errors), and `npm run validate:daily` passed. Existing Node module-type warnings remain non-blocking. Build was not run to avoid replacing the active static output. Detailed evidence: `docs/qa/RECOVERY_R1_FINAL_EVIDENCE_2026-10-30.md`.
- Decision: **GO** for local synthetic contract/E2E and authenticated production page access. **HOLD** for real Content Ops dispatch/import, cross-device cloud persistence, Archive LAN read, and physical mobile/cellular acceptance. No production deployment, D1 write, service restart, port exposure, formal daily-data change, or `import_confirmed` update was made.

## 2026-10-30 — protected cloud save UI integration (local only)

- Replaced the Source Inbox informational-only cloud panel with an explicit protected same-origin capability check, per-record backup/rights/retention consent, create/update plan, expected-revision gate, and server readback verification. A user must explicitly press the save action; nothing uploads automatically.
- The client uses the existing capability gate, consent planner, expected-revision comparison, and dedicated IndexedDB mapping. Remote records are rendered read-only; content is never silently applied to the local SourceRecord. A save is reported only after matching server readback. Cloud copies remain needs_review / not_approved.
- Local acknowledgement metadata updates through IndexedDB compare-and-swap; it cannot change identity, clear an acknowledgement, or roll back a revision. Network calls are same-origin only, use same-origin credentials, and time out after 20 seconds.
- A regression showed JSON transport drops undefined optional fields, so object-string comparison falsely rejected an otherwise exact readback. The client now compares the server's canonical content fingerprint and revision; the Worker independently validates the SourceRecord and evidence.
- Added a synthetic browser-plan → authenticated Worker → in-memory D1 → readback test. Full npm test **230/230 PASS**; typecheck, data validator and daily validator passed. Final isolated Next static export passed all **22/22** pages in /private/tmp/radar-cloud-ui-build.zIUKNf, Build ID `Rd3_bozGUUUeq2-0VOfB1`; active out/ was not replaced.
- Local static-browser verification confirmed a missing same-origin cloud route displays that the service is unavailable and the draft stays in this browser. Console errors: 0. Only a local static 404 was requested; no SourceRecord text was sent.
- Production /api/cloud/capabilities still returns api_route_not_found; the UI and gateway are not deployed. No live D1 access/write, Worker deployment, service restart, production output change, Access/Tunnel change, formal daily-data edit, or Receiver request occurred. Cross-device persistence remains **NOT DEPLOYED / NOT VERIFIED**; dedicated D1 and Worker activation require separate authorization.

## Recovery R1 — live gate and mobile blocker wording recheck (2026-10-30 HKT)

- Read-only authenticated production checks: `/api/content-ops/status` remains `configured=false`, `brand_ids=[]`, `content_ops_brand_allowlist_missing`; `/api/cloud/capabilities` remains `api_route_not_found`. Exact production Content Ops Brand ID is still unconfirmed. No D1 request, content dispatch, or Receiver import was made.
- Fresh production data check: Home daily edition is `2026-07-02` (120 days old); Research shows 55 Collector candidates from snapshot `2026-10-18 01:55 HKT`, older than 24 hours. `/api/automation/status` reports `schedule.enabled=false`, `collection_enabled=true`, `enabled_source_count=0`, `analysis_enabled=false`, and latest run `2026-10-11` with status `partial`, feed sync skipped, analysis skipped, zero feeds attempted, and five body-capture failures. No schedule, collector, or AI analysis was started.
- `npm run health:mobile` passes: protected Origin is listening and fail-closed on `127.0.0.1:4320`; helper reports `gemini` / `gemini-3.5-flash-lite` / `configured=true` (configuration presence only, not key validity/quota). No process was restarted.
- The protected live Source Inbox loaded through the authenticated in-app browser. It showed browser-local draft behavior and cloud sync unavailable. The displayed candidate blockers exposed schema keys (`question_title`, `ai_pm_implication`); fixed those labels and score-range messages in both locales and stopped exposing unknown raw validator strings.
- Browser verification on an isolated static build used only synthetic text: create local draft → review screen → bilingual toggle → reload. The text remained present; status stayed needs-review/not-approved; candidate download remained disabled. Blockers were readable Chinese/English labels. This did not call AI or use D1. The temporary loopback preview server was stopped; its synthetic browser-local draft may remain under the isolated `127.0.0.1:43953` origin. Existing localhost origins and their data were not cleared.
- Responsive checks at 360/390/768/1280 CSS px showed document/body scroll width equal to viewport width; Console errors: 0. Mobile and desktop screenshots were captured in the QA session but not saved as repository files.
- Verification after the copy fix: focused i18n tests **8/8**, full npm test **230/230**, typecheck, `validate:data` (2 files/12 articles; no warnings/errors), `validate:daily`, scoped diff check, and isolated static export **22/22**. Final local Build ID `Rd3_bozGUUUeq2-0VOfB1`; repository production `out/` was not replaced.
- Current decision: **GO** for local UX and synthetic contract evidence; **HOLD** for protected cloud deployment/write, second-device/Mac-off persistence, physical iPhone/cellular UAT, and Content Ops delivery. No production deploy, D1 operation, Receiver call, daily data edit, or `import_confirmed` update occurred.

## Recovery R1 — fresh production connectivity check (2026-10-30 HKT)

- A newly loaded `https://radar.lamlab.cc/` page returned Cloudflare **502 Bad Gateway** at `2026-10-30 12:44:05 UTC`; the page identified Cloudflare as working and Host as error. Older already-open tabs are not evidence of current availability.
- Local `npm run health:mobile` passes: production Origin listens only on `127.0.0.1:4320` and helper on `127.0.0.1:4310`; helper reports Gemini `gemini-3.5-flash-lite`, `configured=true` (configuration presence only). A direct HTTP guard check returned `421` for the default loopback Host and `401` for `Host: radar.lamlab.cc` with HTTPS forwarding and no JWT, confirming the intended Host is accepted and authentication remains fail-closed.
- The Radar-marked `cloudflared` connector has 4 HA connections and reports 589 total requests / 4 request errors. A separate temporary Quick Tunnel targets `127.0.0.1:8790` and reports zero connections/requests; it is not the Radar production route. Recent local log classification found no matching Origin-connect error messages. These signals do not identify the exact Cloudflare ingress/origin failure.
- Current diagnosis: local helper availability and the Origin Host guard do not explain the fresh edge 502. The production route is not verified healthy; Cloudflare Tunnel/origin delivery remains **HOLD** pending read-only confirmation of the Radar hostname's active route and its origin service. No process was restarted, no Cloudflare policy/route was changed, and no Worker was deployed.
- Production `/api/cloud/capabilities` remains `api_route_not_found`; production Content Ops allowlist remains unconfigured and the exact target Brand ID is unconfirmed. No D1 operation, Receiver call, real dispatch, formal daily-data edit, or `import_confirmed` update occurred. Local cloud gateway implementation/tests and synthetic contract evidence remain separate from production readiness.

## Recovery R1 — Tunnel route read-only check (2026-10-30 HKT)

- Cloudflare Dashboard confirms the proxied `radar.lamlab.cc` DNS record targets the existing Radar Tunnel, whose hostname route points to `http://127.0.0.1:4320/`. Tunnel-side Access JWT protection is enabled with an audience configured; secret/config values are not recorded.
- The Dashboard showed 0/1 replica log connectors live while the site returned 502. A local `cloudflared` process exists, but this session could not safely prove its token-file maps to the Radar Tunnel; process-list inspection was denied. The likely class is a disconnected, stale, or mismatched Tunnel connector, but exact cause is not proven.
- No process or Cloudflare configuration was changed. Production external access and cloud persistence remain **HOLD**; `/api/cloud/capabilities` is still not routed by the production runtime. Continue only after authorization to inspect/restart the confirmed Radar connector. No D1 write, dispatch, Receiver receipt, formal daily-data change, or `import_confirmed` update.

## Recovery R1 — fresh external Tunnel error (2026-10-30 HKT)

- A new browser tab to `https://radar.lamlab.cc/` returned Cloudflare **1033** at `2026-10-30 14:57:59 UTC` (Ray ID `a52b468dcdfd4c58`); the page says the configured Tunnel cannot be resolved and advises checking that `cloudflared` is running and network-connected. This strengthens the disconnected/unavailable Tunnel diagnosis; the exact local connector/token mapping remains unknown.
- Fresh `npm run health:mobile` passes for the fail-closed Origin on `127.0.0.1:4320` and companion helper. Local health does not establish Internet Tunnel connectivity. The fresh local guard probe was blocked with `EPERM` before reaching Origin.
- No restart, deployment, Access/DNS/Tunnel edit, D1 operation, dispatch, or formal data change occurred. External access and cloud persistence remain **HOLD**; `/api/cloud/*` remains unavailable in the production Origin.
- Revalidated `node --test tests/cloud-source-gateway.test.mjs tests/mobile-production-server.test.mjs`: **15/15 PASS** using in-memory gateway fixtures and loopback-only Origin fixtures. A process-name-only listing found two `cloudflared` PIDs but cannot map them to Radar. Automatic approval review rejected checking process arguments against the `.env.local` token-file setting as credential-oriented; no workaround was attempted and no token/config values were read out. Do not restart either process until the Radar connector is identified.

## Recovery R1 — latest live UI and data readback (2026-10-30 HKT)

- After the earlier 1033, the next Dashboard read showed the existing `ai-pm-radar` Tunnel at **1 healthy replica** (displayed uptime 6 minutes); its `radar.lamlab.cc/` hostname route still targets `http://127.0.0.1:4320`. A new authenticated browser tab loaded the production UI. No restart or Cloudflare change was made in this session; the connector recovery cause remains unknown.
- Authenticated same-origin `GET /api/cloud/capabilities` still returns `api_route_not_found`. Source Inbox states drafts are browser-local and cross-device sync is not enabled. No D1 operation was made.
- Research Brief currently serves the 2026-10-18 local snapshot (55 candidates, snapshot >24 hours old; run “尚未執行”). Home shows daily edition 2026-07-02. No runner, AI analysis, schedule, or formal data update was started.
- Current release state: external UI reachability **PARTIAL / currently reachable**; cross-device persistence and Content Ops delivery **HOLD**. Brand ID unconfirmed, no Receiver receipt, and `import_confirmed` unset.
- Fresh read-only check of the existing `radar-phase13-one-article-dark` Worker: `/api/cloud/capabilities` returns `not_found`; `/api/source-sync/v1/capabilities` advertises `synthetic_only=true` and `real_sources_allowed=false` (Access required, owner-scoped). The deployed Worker is not the local Phase 2.0 cloud SourceRecord gateway. Do not route real drafts to it; deploying the new Worker route/binding requires separate authorization.
- Dashboard deployment details show only `ASSETS`, `DB`, `SYNC_DB` bindings; `CLOUD_SOURCE_DB` is absent and the Worker has no custom domain/route. Phase 2.0 intentionally refuses to use `DB` or `SYNC_DB`, so the missing dedicated binding and production route require an explicit infrastructure deployment before cross-device saves can work.
