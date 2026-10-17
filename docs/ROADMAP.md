# AI PM Radar Roadmap

## v0.1 已完成
- 建立 Next.js + TypeScript 靜態 MVP
- 完成首頁、Archive、About、article detail
- 完成 Top 5 daily section 與 category filter
- 完成靜態 export 與基本部署設定

## v0.2 文件與內容工作流
- 補齊 project brief、context summary、content workflow
- 補齊 QA checklist 與 roadmap
- 建立 daily JSON template
- 建立內容生成與審核 prompts
- 明確化 portfolio 敘事與內容風險控管

## v0.3 自動化
- 增加最小 schema validation
- 增加 build 前內容檢查腳本
- 規劃半自動每日內容產出流程
- 減少人工整理 JSON 的重複工作

## v0.4 P0 Source Intelligence Foundation
- 建立 Universal Source Inbox 與 `SourceRecord` normalised schema
- 統一 manual URL、paste text、paste transcript、Markdown、TXT、SRT、VTT
- 建立 X、Telegram、YouTube、Bilibili adapter capability interface
- X credentials 缺失時 graceful disabled；Telegram 使用 Collector Bot / forwarded content
- Bilibili 保持 Experimental；所有 adapter 失敗都提供 manual fallback
- AI enrichment 只輸出 `needs_review` 草稿，重要 claims 保留 provenance
- 建立 Trend Library、Case Library、Creator Library、Video Reference Library、Content Idea Library 的 logical collection contract；第一版仍用 JSON

## v0.5 Enrichment and Review Operations（本輪完成）
- 建立三組 SourceRecord fixtures 與人工 enrichment / review 範例
- 將已明確批准且有 evidence 的 SourceRecord 安全轉成既有 daily JSON 候選
- 建立 provenance completeness、缺正文阻擋與 review/approval gate
- 讓既有 daily validators 可針對指定候選目錄執行，並實際驗證新候選輸出
- 只在有真實 workflow 需求後再評估半自動 metadata adapters

## v0.5.1 Source Inbox Input Simplification（本輪完成）
- 將來源工作台收斂為「匯入素材 → 核對草稿 → 批准與下載」三階段
- 支援一般公開 HTML 文章 URL 的本機受限擷取；失敗時保留 URL 並回到貼正文 recovery
- 正文段落可直接選取為 evidence；保留原始 URL、最終 URL、擷取時間與 SourceRecord provenance
- 首頁、每日 Radar、文章詳情、導覽與來源工作台使用集中式繁中／中英字典
- 不新增 database、外部 API、LLM、scraper、平台 adapter 或正式 daily data 寫入

## v0.6 Low-friction collection and AI analysis draft（本輪完成最小可實作範圍）
- 將素材取得、AI 分析草稿與 daily candidate gate 分開保存；`SourceRecord` 使用 version 2 analysis state
- 支援最多 5 個 URL 批次、貼正文、TXT／Markdown／SRT／VTT，素材卡片逐筆容錯
- 公開 HTML helper 不再因登入導覽字眼誤判；真正 login／verification block 仍 fallback，teaser／paywall 前言標示 incomplete
- 以本機 companion `/analyze` 接 server-side AI provider；缺設定時保留手動流程
- 用 strict JSON Schema 與正文 evidence 驗證限制 AI 草稿；AI 不自動成為 reviewed、approved 或 verified
- 使用 IndexedDB 保存文字型草稿，提供版本驗證的 JSON 匯出／匯入／刪除；不加入雲端 database
- 已於 2026-09-20 用合成英文素材完成 Gemini live analysis 與瀏覽器 reload 保存驗收；繁中生成語言尚未由目前 prompt 保證，candidate download 不在該次 live 驗收範圍

## v0.6.1 Gemini provider（本輪完成最小接入）
- 明確支援 `AI_PROVIDER=gemini`，範例設定改為 `gemini-3.5-flash-lite`；保留 `AI_PROVIDER=openai`，不自動 fallback
- helper 載入專案根目錄 `.env.local`，process environment 優先；不把 secret 送進瀏覽器或 logs
- 使用 Gemini `generateContent`、JSON schema structured output、usage mapping 與 evidence validation
- 以免費層作測試目標；quota、帳戶、地區及模型可用性仍需 live key 實測

## v0.6.3 Gemini model availability diagnosis（2026-09-19）
- 同一 server-side key 的 `ListModels` 成功列出 `models/gemini-2.5-flash-lite` 且支援 `generateContent`；這不代表新使用者可實際生成或有免費 quota。
- 同一 endpoint 的短篇 `generateContent` 實測回 `404 NOT_FOUND`，Google message 指出 `gemini-2.5-flash-lite` 不再提供給新使用者，並建議 `gemini-3.5-flash-lite`。未自動修改 `.env.local`、未 fallback 或啟用 billing。
- helper 現在區分帳戶級模型不可用、一般 resource not found、permission denied、provider service unavailable，並保留脫敏 provider message／field violations。
- provider HTTP、認證、速率／配額、timeout、模型拒絕、schema 與 evidence 失敗各自回報；維持既有 review／approval／candidate gate

## v0.7 Source watchlist and manual RSS／Atom sync（本輪完成最小範圍）
- 在既有來源工作台加入關注來源清單；來源可新增、編輯、停用及確認移除，移除不刪除已收集素材
- 以本地 IndexedDB 保存來源、feed item、ETag／Last-Modified 與最近 20 次同步摘要，提供獨立版本化 JSON backup／import
- helper 增加受限 `/feed`；支援 RSS 2.0／Atom、相對 URL、CDATA、namespace、304，並沿用 DNS pinning、redirect、SSRF、timeout、大小與 CORS 邊界
- 手動同步最多 12 個啟用來源、並行最多 2 個、每來源最多 20 筆；同步只收集，不自動分析、批准或發布
- 新 feed 項目直接加入既有素材卡片；摘要／metadata 與 feed content 清楚區分，正文仍可重用既有公開 HTML helper
- 同 feed 以 stable item ID 去重，跨 feed 以正規化文章 URL 去重；保留 source refs，不覆寫正文或人工分析
- 本輪不啟用 cron、通知、OPML、全文批次抓取或新平台 scraper；公開 feed 的 live 驗證已用 HN RSS 與 BBC Technology RSS 完成，瀏覽器點擊驗收仍需具備 browser tool

## v0.8 每日研究簡報 v0.1（本機驗收完成）
- 新增版本化本機 JSON research runtime v3，可從 v1／v2 遷移；保留 SourceRecord v2 與既有 daily JSON schema
- 新增有限 runner：來源選取、逐筆正文擷取、可選 AI 分析、簡報草稿、歷史統計、人工 feedback 與用量上限；單筆失敗不阻擋其他素材
- 新增可編輯專案卡與來源日期／範圍／入選原因；摘要素材不冒充全文。AI 方法片段須逐字存在正文，且須有明確相符的專案卡，才可產生一項限時實驗建議；沒有依據或只有不相關專案時不捏造 action
- 新增 `/research/` 本機研究簡報頁、JSON／Markdown／完整備份下載、明確失敗重試與版本化 Source Inbox candidate handoff；本地編輯與較新背景結果衝突時由使用者選擇，不靜默覆寫
- macOS LaunchAgent 排程提供明確 opt-in，預設關閉；不追補錯過日期，不自動發布
- 測試 72/72、TypeScript、正式與 fixture candidate validators、production build 通過；已用合成繁中素材完成一次真實 Gemini runner analysis，三項 evidence 與方法片段均逐字對應原文
- 瀏覽器已確認研究簡報、人工 feedback 儲存／reload、完整備份下載、Source Inbox 人工修改保存、背景衝突處理、逐 claim provenance、`analyzed_at` 與 candidate gate；桌面 1280px 無水平溢出，Console 無 error
- LaunchAgent 已在隔離 HOME 完成 enable → status → disable → remove；使用者實際排程維持關閉且未載入
- 已知限制：runtime 完整 backup 尚無匯入／還原；方法片段的「可定位」不代表方法成效已查證，行動建議仍須人工決定且不會修改 roadmap／active build；本機 helper 與模型 quota 仍是必要條件

## v0.6.8 Evidence live/browser acceptance（2026-09-20）
- 實際 Gemini model 以 helper `/status` 確認為 `gemini-3.5-flash-lite`；舊 `gemini-2.5-flash-lite` 404 保留為歷史，不代表本次 runtime
- 一次合成英文素材的 live 呼叫成功套入 SourceRecord 草稿，英文 evidence 是原文連續子字串；未放寬 whitespace-only canonicalisation 或 evidence gate
- IndexedDB reload 後正文、摘要、evidence 與 draft 保留；review=`needs_review`、approval=`not_approved`、evidence grade=`ungraded`，candidate 仍被阻擋
- 模型摘要回傳英文，繁中摘要驗收未通過；本次不加呼叫、不更換模型、不擴增 prompt 功能

## v0.6 Newsletter / LinkedIn 輸出
- 把每日內容轉成 newsletter 草稿
- 把 Top 3 或 Top 5 轉成 LinkedIn 帖文格式
- 保持來源連結與 disclaimer 一致
- 驗證內容產品是否能跨渠道重用

## v0.9 Private mobile access（部署完成；使用者回報手機實測通過）
- 已實作 production static origin、same-origin API proxy、Cloudflare Access JWT verification、Access expiry handling 與專用 Tunnel launcher
- 已新增 mobile build/start/health scripts、`.env.example` 欄位、deployment runbook 與部署相關 security regression tests
- 保持 IndexedDB origin-local；不增加跨裝置同步，不改正式 daily data 或啟用排程／runner AI
- 已部署 `https://radar.lamlab.cc/`；Access app 僅允許單一明確 email，Tunnel route 啟用 **Protect with Access**，origin 再驗 JWT 與精確 email；既有 `capture` route、其他服務及 Worker 未修改
- Production static origin/helper 綁 loopback，Tunnel token 存於 repo 外權限 `600` 檔案；Research runtime 留在本機，不加入雲端資料庫或跨裝置同步
- 外部 HTTPS、未登入阻擋、登入後 Research Brief/Source Inbox、合成素材 Gemini 分析、保存/reload、review/approval gate 及候選 JSON 下載/validators 已驗收；正式 `data/daily/` 未更動
- 使用者於 2026-09-21 回報手機遠端存取測試通過；裝置／網路／viewport 未記錄，360／390／768px 尺寸及 Console 尚未獨立驗證。Mac 需保持開機、醒著且連網，並不承諾 24/7
- 啟停、health check 與回滾步驟見 `docs/DEPLOYMENT.md`

## Capture & Review Vertical Slice v1 — COMPLETE

已完成低摩擦 capture、AI draft、claim evidence、人工 review、daily approval gate 與 candidate 輸出主流程。手機 viewport 驗收依各輪記錄；不把本機流程完成等同於真機／production 驗收。

## v0.9.2 快速收集與同頁核對（2026-09-28，完成本輪）
- 快速入口改為 URL／正文單一輸入，支援單一 URL、自動辨識最多五行 URL、混合輸入保留內容，以及同筆素材 recovery。
- 素材卡依狀態顯示唯一下一步；進階 metadata、backup/import、RSS／runner 控制收進可展開區。
- AI draft 結果與逐 claim evidence 在同頁核對；人工修改後仍沿用 IndexedDB 保存與 approval 失效規則。
- 首頁加入來源工作台入口；Research Brief handoff 可直接開啟對應素材；繁中／中英兩種模式的本輪標籤均已補齊。
- 本機 390／360／768px smoke 無水平溢出；一次合成素材 Gemini live 分析成功。正式 daily data、外部平台擷取、跨裝置同步與自動發布不在本輪變更。
- 後續只需針對真實手機與公開 HTTPS 做獨立驗收；不要把本機 viewport smoke 或單次合成分析當成 24/7、跨裝置或內容品質保證。

## Reliable SourceRecord & Reuse v1（2026-10-04）
- 已新增本地 approved SourceRecord Library：需人工審核、明確批准重用，且具正文、逐 claim evidence 及可定位主張；approval 不代表 `verified`，不等於 daily candidate approval。
- 擷取失敗後的貼正文 fallback 沿用原素材卡及 URL；Research Brief 可直接使用同一份已批准 SourceRecord 快照，保存 handoff 關聯，不重新擷取來源。
- IndexedDB opener 統一資料庫版本 3 並建立一致 stores，避免工作台與來源訂閱面板造成版本升級／連線阻塞。
- 本機 browser Scenario A 已完成：W3C public URL fetch → Gemini 分析／evidence → 人工修改／review／reuse approval → Research Brief → reload；Research Brief 保留相同 SourceRecord 關聯及 evidence。
- 本機 browser Scenario B 已完成：`.invalid` URL failure → 同一素材卡貼正文 → `manual_fallback` → Gemini 分析／evidence → 人工修改／review／reuse approval → reload。URL、正文與分析均保留；daily candidate 仍被缺少 daily metadata／approval gate 阻擋。
- `npm test` 90/90、TypeScript、正式與 fixture candidate validators、兩種 build、`health:mobile` 通過；正式 `data/daily/` 未修改，既有 dirty changes 保留。
- **狀態：COMPLETE（本機驗收）**。真實公開文章與 URL failure/manual fallback 兩條流程已完成；本機 Research Brief／Source Inbox 在 360／390／768px 均無水平溢出，fresh browser Console 無 error。曾定位 Research Brief 的長 URL 令卡片把頁面撐至 874px，已修正換行及 grid item min-width；同時加上 Next.js 要求的 `data-scroll-behavior`，重新驗收通過。
- 390px 合成素材流程已完成 manual capture → exact evidence → human review → reusable-source approval → Research Brief → reload；來源及 brief 在 IndexedDB reload 後仍存在。Daily candidate 因發布欄位未補齊仍維持 disabled；沒有新增 AI 呼叫或修改 daily data。
- 使用者亦回報手機測試通過；本機 responsive/browser QA 為獨立檢查。外部 HTTPS 與實體手機行動網路未在本輪重測，Mac origin 可用性仍取決於主機運行狀態。
- 不更動 daily schema、正式 daily 資料、雲端資料庫或跨裝置同步。

## v1.0 Public portfolio launch
- 完成可展示的真實內容樣本
- 完成 QA 與內容審核流程
- 補齊 README demo 與 portfolio 敘事
- 完成公開部署與基本更新節奏

## Downstream Handoff Contracts v1（Radar v0.2.0，2026-10-05）— COMPLETE
- **Completed:** 以已批准 SourceRecord 建立 Content Candidate、Learning Pack、Creative Reference、Case Reference；共用版本化契約保留 source facts、逐 claim evidence、provenance，並將下游分析分開保存。
- **Completed:** 每種交接獨立 edit → review → approval → JSON／Markdown export；修改會使批准失效。SourceLibrary v1→v2 保留舊 Research Brief 關聯；IndexedDB schema 不變，backup import 驗證並合併、不覆蓋本機既有編輯。
- **Out of scope:** 不串接產品 API、不寫正式 daily data、不建立雲端同步／資料庫；handoff approval 不等同來源 verified 或 daily approval。
- **Verification:** 合成 browser flow 完成四類交接、修改後批准失效、JSON／Markdown 實際下載讀回、backup import／reload 關聯、360／390／768／1280px 無水平溢出；98 tests、typecheck、validators、`build`、`build:mobile`、`health:mobile` 均通過，細節見 `CONTEXT_SUMMARY.md`。

## Intelligence Delivery & Consumer Compatibility v1（Radar v0.3.0）— COMPLETE
- Source Library v3 保留 v1／v2 migration，加入可追溯且不可變的 delivery package snapshots、package lifecycle 與 backup round-trip；舊 handoff approval 因缺少 fingerprint 而回到 `needs_review`。
- 四種 consumer profile 有明確 contract/version compatibility checks；Content Ops pilot 轉成其既有 handoff v1 file-intake 格式，仍須由 Content Ops 使用者預覽及匯入，接收狀態不由 Radar 推定。
- Package 僅可由有效批准的 handoff 建立；source/handoff 編輯會令舊批准失效，舊 package 保留但標為 outdated。Fingerprint 是內容變更偵測，不是安全簽章。
- **Automated verification complete:** 105 tests、typecheck、兩種 build、正式及 fixture daily validators、mobile health 均通過。`fixtures/candidates/` 的 1 個檔案／2 篇文章實際通過兩個 daily validators。
- **Browser acceptance:** Chromium IndexedDB 可用；Flow A–D 均以 synthetic SourceRecord 完成。JSON、Markdown、Content Ops intake 實際下載並讀回；package immutability、舊 revision outdated、新 revision、四種 consumer、backup import/reload 均通過。360／390／768／1280px 無水平溢出，Outbox target/status/compatibility/stale 資訊保留。
- **Release gate:** `npm test` 105/105、typecheck、正式與 fixture candidate validators、`build`、`build:mobile`、`health:mobile` 通過；origin 無 Access JWT 時 fail-closed。Content Ops receiver runtime import 為 `NOT VERIFIED`，不阻擋 Radar 端 release，也不推定已接收。
- `git diff --check` 仍會報既存 dirty `tools/deal-radar-storage/` CSV／文件尾空白；該無關內容未修改。正式 `data/daily/` 的既存 dirty change 保留，未由本次驗收寫入。
- **Fresh release-gate recheck (2026-10-08):** Chromium with IndexedDB completed Flow A–D using synthetic data, including package exports/readback, stale revision retention, all four consumer targets, and backup import into a separate empty browser session followed by reload. 360/390/768/1280px had no horizontal overflow. `npm test` 111/111, typecheck, formal and fixture validators, both builds, and `health:mobile` passed. Content Ops receiver import remains `NOT VERIFIED`; formal daily data was not changed. The repository was already `0.3.0`, so no version edit was made.
- **Fresh release-gate recheck (2026-10-09):** 隔離 Chromium 完成 Flow A–D；四種 target package compatibility PASS，實際下載並讀回 Content Candidate／其他三種 package JSON、Delivery Package Markdown、Content Ops intake JSON。Backup 在空白 browser context 匯入並 reload，保留 1 SourceRecord、4 approved handoffs、5 packages（1 outdated、4 current）及 evidence／fingerprint 關聯。360／390／768／1280px 無水平溢出；browser Console errors／warnings 為 0。114 tests、typecheck、正式及 fixture validators、兩種 build、`health:mobile` 通過；無 JWT origin fail-closed。Content Ops receiver import、公開 HTTPS 與實體手機仍未驗證；版本已是 `0.3.0`，未改版號。
- **Release-gate recheck (2026-10-09):** fresh `npm test` 117/117, typecheck, formal/candidate validators, both builds, and `health:mobile` pass. Isolated-browser IndexedDB smoke open/write/reload/readback passed and its temporary database was removed. 360/390/768/1280 viewport-width check was on Research page only; Flow A-D and Outbox-specific responsive acceptance rely on the preceding same-day full browser acceptance, not rerun here. Version remains `0.3.0`; formal daily data untouched.
- **Release-gate acceptance (2026-10-11):** fresh isolated-browser Flow A–D and 360／390／768／1280px Outbox checks passed using synthetic data. Actual Content Ops receiver import was verified separately. Local tests, typecheck, formal/candidate validators, both builds, and protected-origin health check passed. Version remains `0.3.0`; no product code or formal daily data changed. This is a local acceptance decision, not a deployment or publication.

## Intelligence Scoring & Routing Engine v1（Radar v0.4.0）— COMPLETE
- 已建立 versioned `IntelligenceAssessment`，附加於 Source Library entry v4；v1／v2／v3 entries 保留既有資料遷移，IndexedDB store 與 backup envelope 不變。
- 已有五維 rule-based、可解釋的 advisory scoring 及五個既有下游 route recommendations；assessment 綁定 SourceRecord fingerprint，保留舊評估歷史。
- Ruleset v2 將 SourceRecord 正文納入 relevance，修正子字串誤判，並保留 v1 assessment snapshot 相容；不會自動重算既有評估。
- Ruleset v3 顯示來源品質的已知／未知 provenance cues，保留 v1／v2 snapshot 可讀性；不改分數權重或聲稱來源可信度已驗證。
- Ruleset v4：relevance 支援繁中／英文語意群組並每組最多計一次；source-quality signal 明示已完成既有人工 review／reuse approval workflow；reuse score 無 signals 時為 0。validator 繼續接受 v1／v2／v3 snapshots，不自動重算舊資料。
- Assessment confidence 按五維中有可觀察 signals 的維度比例計算；baseline score 不會提高 confidence，該值不代表模型機率、分數準確度或事實可信度。
- 2026-10-09 follow-up regression：baseline-only 評估不因維度基線分數增加 confidence；`npm test` 113/113、typecheck、build、正式 data/daily validators 通過；v0.4 仍 IN PROGRESS，package version 未升級。
- 2026-10-09 route-artifact integrity：Source Library validator 現核對 `createdArtifactId` 是否存在於同 entry 且與已接受／覆寫的 route 類型一致；新增五種 route、孤兒及錯 route regression。schema／migration 版本不變。
- 2026-10-09 scoring regressions：繁中 relevance、同義詞群組限計一次、baseline-only reuse、NaN confidence、route signal 型別與 duplicate assessment ID 均納入測試；`npm test` 118/118、typecheck、正式／candidate validators、兩種 build 通過。完整 v0.4 relevance profile／其餘 contract 仍待補齊；版本不升級。
- 2026-10-09 isolated-browser acceptance：Playwright isolated profile 完成 synthetic paste → SourceRecord → evidence／manual enrichment → review → reusable-source approval → assessment → accept Case Reference → create unapproved draft → reload；decision 與 draft association 保留，draft 仍需獨立 review／approval。此流程無 AI 呼叫、daily candidate 或發布；該次 flow Console errors=0。桌面全頁畫面見 `/private/tmp/radar-v04-acceptance.png`。
- 2026-10-09 browser acceptance follow-up：同一隔離 Playwright context 完成 Case Reference draft 的獨立 review／approval；reload 後 IndexedDB 仍保存 route decision、artifact link 與 approved handoff。360／390／768／1280px 無水平溢出。此 flow Console 有一個既有 `/favicon.ico` 404，記為非阻斷但未修正。
- 2026-10-09 language regression follow-up：zh-Hant 與 bilingual 的 assessment explanations／signals／route copy 已在隔離 browser 確認有差異；`npm test` 119/119、typecheck、正式與 candidate validators、`build`、`build:mobile` 通過。版本維持 `0.3.0`；完整 v0.4 specification/DoD 仍待補。
- 完整 specification/DoD 仍未收到：任務 payload 在 Relevance 描述中途截斷；milestone 維持 IN PROGRESS，不能僅依現有 partial contract 宣告完成。
- 每條 route 必須由人接受、拒絕（附原因）或覆寫（附原因及另一個 route）；接受不等於 handoff approval。路由後只可建立既有 Research Brief／handoff draft，後續 approval gate 保持獨立。
- 已補 model tests、Source Library migration/backup tests 與雙語字典；v0.4 的自動測試與主要桌面 browser vertical slice 已驗證，但完整規格核對及 Definition of Done 尚未完成。
- **Specification note:** 目前收到的 v0.4 task payload 在 Relevance 維度句子中途結束；已實作內容依可見 Primary Outcome 及目前 docs 中的 Radar focus 明示為暫定基線，不能當作未收到的完整 scoring contract。
- **Release version: 0.4.0**；v0.4 acceptance gates 已通過，並於 2026-10-11 取得 owner 明確升版授權。這是 local release，不代表 production deployment。
- **2026-10-11 verification refresh:** Radar 119/119 tests, typecheck, formal validators and build pass; Content Ops 168/168 tests, typecheck and build pass. PSPO I learning-pack fixtures validate against current SourceRecord, handoff and delivery-package validators. Subsequent documented acceptance completed the scoped v0.4 DoD and the owner authorized release.
- **2026-10-11 acceptance completion:** The user-provided full acceptance checklist was re-run against the existing v0.4 implementation. Synthetic browser checks cover Traditional Chinese relevance, synonym group counted once, observable-signal confidence, route accept/reject/override reasons, no route-to-approval shortcut, source/route/artifact identity, reload, backup import, and 390/768/1280 widths. Receiver A/B import, duplicate skip, reload, and `needs_review` state were verified; PSPO Learning Pack validators, consumer compatibility, JSON fixtures, and Markdown exporters were verified. The scoped v0.4 acceptance checklist is **PASS**. Owner subsequently authorized `0.4.0`; do not infer production/mobile-device/companion automation availability from this local release. Companion automation status returned connection-refused during browser QA; receiver does not visually label earlier revisions outdated.
- **Fresh verification (2026-10-11):** Re-ran full local test/type/build commands in both Radar and Content Ops, plus Radar formal daily validators. Isolated receiver, routing/backup reload and 390/768/1280 layout checks passed; PSPO fixture contracts/export passed. No production, external HTTPS, live model or physical-device acceptance. Owner later authorized the `0.4.0` release bump.
- `build:mobile` and `health:mobile` also pass; origin returns fail-closed 401 without an Access JWT and helper status reports selected Gemini configuration. The checkout was already `0.3.0` (not the attachment's `0.2.0` baseline), so version files remain untouched. `git diff --check` findings are limited to unrelated pre-existing `tools/deal-radar-storage/` dirty files.
- Historical version decision: `0.3.0 — RELEASED` for Intelligence Delivery & Consumer Compatibility v1. On 2026-10-11 the separate v0.4 routing acceptance subsequently passed and the owner authorized the local `0.4.0` release; no production deployment was performed.
- Receiver-Verified Content Ops Handoff: COMPLETE for the synthetic local acceptance. Radar/Content Ops v1 contract matched; receiver preview, explicit import, duplicate skip, A/B revision identity, reload, Brand isolation, provenance/evidence retention, and `needs_review` state were observed in the receiver UI. Existing limitation: receiver does not visually mark the earlier revision superseded.
- v0.4 acceptance DoD is recorded in `CONTEXT_SUMMARY.md` and passed for the listed rule, route, migration, persistence, responsive and browser-console checks. Owner authorized the `0.4.0` local release on 2026-10-11. This is not a production deployment; do not start another milestone without owner direction.
