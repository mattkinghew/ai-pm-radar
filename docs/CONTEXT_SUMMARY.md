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
