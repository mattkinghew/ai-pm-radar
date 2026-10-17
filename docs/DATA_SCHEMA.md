# Universal Source Inbox Schema

## Purpose

AI PM Radar 目前的 daily JSON 仍然是發布格式；`SourceRecord` 是新的來源層 contract。它把 URL、貼上文字、字幕檔與 forwarded content 統一成同一種可審核資料，讓後續 enrichment 不必為 X、YouTube、Bilibili、Telegram 建立四套 pipeline。

```text
Source -> Adapter -> Normaliser -> SourceRecord -> Enrichment -> Review -> Library
```

目前仍使用 local JSON / in-memory object；瀏覽器工作台另外使用 IndexedDB 保存文字型草稿，不加入雲端 database。`SourceRecord.record_version=2` 是本輪最小、向前可辨識的 schema 擴充。

## P0 input mapping

| Input | `source_type` | Default handling | Status |
| --- | --- | --- | --- |
| Manual URL | `url` | 保留 URL，等待 metadata 或人工補充 | Stable |
| Paste Text | `text` | 保留 `raw_text` | Stable |
| Paste Transcript | `transcript` | 保留 `transcript`，origin=`user_pasted` | Stable |
| Markdown | `markdown` | 保留原文，讀取第一個 H1 作為候選 title | Stable |
| TXT | `txt` | 保留原文 | Stable |
| SRT | `srt` | 解析 cues、transcript 與 timestamps | Stable |
| VTT | `vtt` | 解析 cues、transcript 與 timestamps | Stable |
| Telegram forwarded content | `forwarded_content` | Collector Bot 有權限時 ingestion；否則 manual fallback | Stable / Manual fallback |

## SourceRecord fields

`lib/source-inbox.ts` 定義 runtime 使用的 TypeScript contract。未知值不捏造：metadata 使用 `null`，集合使用空陣列，AI enrichment 欄位在初始階段保持空值。

| Group | Fields | Rule |
| --- | --- | --- |
| Identity | `record_version`, `id`, `platform`, `source_type`, `source_url`, `source_url_original`, `source_url_final`, `creator`, `title`, `description` | `record_version` 目前為 `2`；`platform` 支援 `manual`, `x`, `youtube`, `bilibili`, `telegram`；URL 只接受 `http` / `https`；original/final URL 為 provenance 欄位 |
| Time / language | `published_at`, `captured_at`, `language` | `captured_at` 必須可解析；未知發布時間為 `null` |
| Original material | `raw_text`, `transcript`, `transcript_origin`, `access_method` | 保留原始輸入；不把第三方字幕下載當成必要條件 |
| AI extraction | `summary`, `key_points`, `key_claims` | 初始為 `null` / `[]`；AI 產生後仍需 review |
| Evidence | `evidence`, `timestamps`, `visual_moments` | 重要 claim 儘量保存 `source`, `timestamp`, `text_reference` |
| Analysis | `story_patterns`, `style_features`, `why_it_matters`, `business_implication`, `ai_pm_implication`, `video_implication` | 屬於 enrichment，不是來源事實本身 |
| Reuse | `content_ideas`, `case_candidate`, `library_targets`, `trend_tags`, `topic_tags` | 只作候選標記，不代表已核實或已發布；library targets 為 `trend`, `case`, `creator`, `video_reference`, `content_idea` |
| Governance | `confidence`, `evidence_grade`, `evidence`, `uncertainties`, `rights_note`, `material_status`, `review_status`, `approval_status` | `material_status` 分開表示 `captured`、`needs_manual_input`、`capture_failed`；初始 `confidence=0`, `evidence_grade=ungraded`, `review_status=needs_review`, `approval_status=not_approved`；禁止 `verified` |
| AI state | `analysis` | 版本 `1`；`status` 為 `not_requested`、`processing`、`draft` 或 `failed`。保存 provider/model、分析時間、輸入字元數、供應商回傳 usage、source facts、inferences、use cases、可選 `method_or_teaching_points` 與錯誤 code。方法片段必須可逐字定位到正文；`draft` 不代表 reviewed、approved 或 verified。 |

## Adapter capability contract

每個 adapter 必須回報：

```ts
{
  metadata_supported: boolean,
  text_supported: boolean,
  transcript_supported: boolean,
  media_supported: boolean,
  auth_required: boolean,
  manual_fallback: boolean
}
```

| Adapter | Stability | P0 scope | Manual fallback |
| --- | --- | --- | --- |
| Manual Input | Stable | 所有 P0 input | N/A |
| X Official API | Stable interface | Official API interface；只讀 `X_BEARER_TOKEN` environment variable | Disabled gracefully；不把 token 寫入 source code |
| Telegram Collector Bot | Stable interface | Collector Bot / forwarded content；只處理 bot 有權讀取的內容 | 不做 arbitrary public-channel scraping |
| YouTube Metadata | Stable | URL、creator、title、description；接受 user-pasted transcript、SRT、VTT、user-owned media transcript | 不假設可下載任意第三方字幕 |
| Bilibili Metadata | Experimental | 安全可取得的 URL metadata、manual transcript、uploaded subtitle | 不要求 browser cookies、SESSDATA 或 private session |

## Failure recovery

Adapter 失敗不會丟棄來源。`normaliseSourceInput()` 仍建立 `SourceRecord`，並回傳：

- `fallback_used`
- `warnings`
- `fallback_options`: `Paste transcript`、`Paste text`、`Upload subtitle`、`Add notes`

## Review boundary

AI enrichment 只代表草稿抽取，不代表事實驗證。任何 `SourceRecord` 初始都必須是 `needs_review` 且 `approval_status=not_approved`；重要 claim 應在 `key_claims[].evidence[]` 保存來源、時間戳或文字引用。

人工 review 要分開記錄兩件事：

- `review_status=reviewed`：人工已檢查原文、evidence、分析推論與未確定事項。
- `approval_status=approved`：只批准這筆資料進入 daily JSON 候選，不代表事實已被獨立驗證，也不會產生 `verified` 狀態。

`SourceRecord` 的 `key_points`、`key_claims` 與 `evidence` 用來保存原文事實；`why_it_matters`、`business_implication`、`ai_pm_implication`、`video_implication` 與 `content_ideas` 是分析或延伸角度；`uncertainties` 必須保留未能由原文證明的事項。

## v0.7 RSS／Atom collection extension

關注來源與 feed item 保存於目前瀏覽器的 IndexedDB，使用獨立 `SOURCE_FEED_STORAGE_VERSION=1` 備份 contract；不新增雲端 database。每個來源保存穩定 ID、顯示名稱、feed URL、可選專家名稱／原因／topic tags、enabled 狀態、最近同步時間、ETag／Last-Modified 與最近 20 次同步摘要。

`SourceRecord.collection` 是 `SourceRecord` v2 的可選 provenance extension，不改 daily JSON：

```ts
{
  version: 1,
  feed_url: string,
  source_id: string,
  item_id: string,
  content_kind: "metadata" | "summary" | "feed_content",
  discovered_at: string,
  feed_updated_at: string | null
}
```

`FeedItem` 另保存 `source_refs`，讓同一文章由其他 feed 發現時增加 provenance 而不複製素材；既有標題、正文、人工分析、review 或 approval 不會被 feed 更新覆寫。只有 `content_kind=feed_content` 的 feed 文字會直接進入素材正文；只有 description／summary 的項目會清楚標記為摘要，並提供用 article URL 取得正文，不能把摘要冒充全文或讓 AI 憑 URL 猜測。

Feed parser 使用 `fast-xml-parser` server-side，`processEntities=false`，明確拒絕 DTD／ENTITY、限制回應 1 MB、每來源最多採用 20 個項目；RSS 2.0 與 Atom 的相對 article URL 以 feed final URL 解析，只移除明確 tracking parameters。官方 parser 說明：[fast-xml-parser README](https://github.com/NaturalIntelligence/fast-xml-parser#readme)；entity expansion 風險以 parser security advisory 為依據，故不開啟 entity processing：[GHSA-jmr7-xgp7-cmfj](https://github.com/NaturalIntelligence/fast-xml-parser/security/advisories/GHSA-jmr7-xgp7-cmfj)。

## AI analysis boundary

本地 companion helper 只在使用者按下「AI 整理」後，把目前這筆正文 snapshot 送到 server-side provider；瀏覽器不接觸 API key，也不會因重新渲染或切換頁面自動呼叫。模型輸出使用 strict JSON Schema，並在套用前檢查每個 key claim 的 `text_reference` 是否為同一來源語言的連續原文片段。只允許 whitespace／換行差異，系統會將通過的引用還原為原文片段；翻譯、改寫、拼接、大小寫替換或不存在的 evidence 都會拒絕。回應也必須帶回相同的 source ID／正文版本，否則不套用。驗證失敗或 snapshot 過期時整份 AI 結果不套用，素材保留供重試或人工編輯。

目前可明確選擇 `gemini` 或保留的 `openai` adapter；沒有自動 fallback。Gemini 目前預設為 `gemini-3.5-flash-lite`，並已於 2026-09-20 用合成素材完成一次真實 runner `generateContent` 驗收；這不保證之後仍有免費 quota、帳戶權限或地區可用性。舊 `gemini-2.5-flash-lite` 雖可被當時的 `ListModels` 列出，實際 generateContent 回 `404 NOT_FOUND` 並指出不再提供給新使用者；這是歷史診斷，不代表目前 runtime。設定只放在本機 `.env.local`／shell environment：`AI_PROVIDER=gemini`、`GEMINI_API_KEY`、可選 `GEMINI_MODEL`；保留 `AI_PROVIDER=openai`、`OPENAI_API_KEY`、`OPENAI_MODEL` 的既有 adapter。helper 會載入專案根目錄 `.env.local`，已有 process environment 優先；不使用 `NEXT_PUBLIC_` key，不把 key 寫入 repository。`/status` 的 `configured` 只代表必要設定存在，不代表 key 有效或仍有額度。

## Local enrichment 到 daily candidate

本地可重現範例位於 `fixtures/source-inbox/`。`scripts/build-source-candidate.mjs` 會：

1. normalise 三組 fixture 成 `SourceRecord`。
2. 套用人工 enrichment 與 review decision。
3. 阻擋未批准、缺正文、缺 evidence 或缺 daily metadata 的資料。
4. 將完整且已批准的資料寫入 `fixtures/candidates/2026-09-19.json`。
5. 將完整 SourceRecord provenance 寫入 `fixtures/source-records/2026-09-19.json`。

## Downstream Handoff Contracts v1（Radar v0.2.0）

Approved SourceRecord 可建立四種下游交接：`content_candidate`、`learning_pack`、`creative_reference`、`case_reference`。交接使用 `lib/downstream-handoff.ts` 的共用 `BaseHandoff` 契約，包含 `schema_version=1`、類型、目標產品、來源 Record ID／fingerprint、來源 facts、逐 claim evidence references、provenance、下游分析欄位及獨立人工狀態。來源 facts／evidence 從已批准 SourceRecord 衍生；分析與人工備註分欄，不回寫來源。

SourceLibrary entry 由 v1 遷移至 v2，新增 `downstream_handoffs`；舊 Research Brief `handoffs` 和 `research_briefs` 關聯保留。IndexedDB database/store 版本不變。讀取會遷移並寫回原 key；匯入按 source identity 合併，既有本機版本優先。每份交接必須獨立 review 並明確 approve 才可匯出 JSON／Markdown；修改會使 review／approval 失效。交接 approval 不等同 source verification、daily candidate approval 或發布。

版本化 SourceLibrary backup 包含來源快照及所有交接。匯入會驗證版本、格式及來源關聯；不包含 API key 或原始 HTML，也不提供跨瀏覽器／裝置同步。

候選 daily JSON 只沿用現有欄位（例如 `source_name`、`source_url`、`published_at`）；不新增 source-record 欄位。若要追溯完整原文，使用同一輪輸出的 SourceRecord `id`、`source_url_original`、`source_url_final` 與 `source_url` 關聯。

## Intelligence Delivery & Consumer Compatibility v1（delivery contract v1）

資料仍保持三層，不建立第二個 SourceRecord：

```text
SourceRecord → approved Handoff → immutable DeliveryPackage → Consumer
```

`SourceLibraryEntry.version=3` 新增 `delivery_packages`；目前 entry schema 為 v4，另增 `intelligence_assessments`。既有 IndexedDB database/store schema 不變。Backup envelope 仍使用既有版本；v1／v2／v3 library entry 可遷移，unknown fields 會保留。舊 handoff schema v1 的文字、來源與 evidence 關聯會保留，但因舊格式沒有 approval fingerprint，舊 `approved` 狀態會降為 `needs_review`，必須重新批准後才能建立 package。

`DeliveryPackage` schema／package version 為 `1`，consumer contract version 為 `1`，包含 package id／建立時間、target、handoff type/id/fingerprint、SourceRecord id/fingerprint digest、manifest、source title／URL／source facts snapshot、provenance、evidence references、衍生 payload 與建立時批准狀態。Package 不包含完整 SourceRecord raw text 或原始 HTML；source fingerprint 使用 deterministic 64-bit digest，避免將現有 SourceLibrary 的 JSON fingerprint（內含 raw text）帶出。此 digest 用於穩定識別／變更偵測，不是簽章或防竄改認證。

Package builder 只複製已批准 Handoff，不呼叫模型、不補未知資料。建立後 package snapshot 欄位不可變；export/import lifecycle metadata 分開保存。Package fingerprint 覆蓋 canonical package snapshot，不含自身 fingerprint。SourceRecord 或 handoff fingerprint 變更時舊 package 顯示 `outdated` 並保留；新批准版本建立另一份 package，不覆寫舊版本。

Consumer profile 固定對應：`content_candidate → content_ops`、`learning_pack → cyber_kuma`、`creative_reference → storyworld`、`case_reference → diagnostic`。Export gate 檢查 SourceRecord／handoff approval、approval fingerprint、type-target mapping、contract version、provenance、evidence relationship 與 package fingerprint。未知 target／不相容 contract 不會被轉換或靜默 coercion。

Delivery lifecycle：`packaged`、`exported`、`import_confirmed`；若 source/handoff fingerprint 不同，顯示衍生狀態 `outdated`。`exported` 只表示使用者觸發了檔案匯出，不代表 receiver 收到。`import_confirmed` 只由明確人工確認設定，不代表自動 receiver acknowledgement；匯出不等於 approved source verified、daily approval 或 published。

Content Ops 現有 importer 接受其 `content-ops-handoff` v1。Radar 提供獨立 intake conversion，保留 `package_id`、source/handoff ids/digests、provenance 與 evidence references；不帶完整 source body。Content Ops importer 會把項目留在 `needs_review`。合成 fixture：`fixtures/content_ops_compatibility_fixture.json`；其他三個 profile fixture：`fixtures/delivery-packages/`。這些是 contract fixture，不代表已完成 Content Ops runtime import。

### Intelligence Assessment v1（Source Library entry v4）

Intelligence Assessment 是附加在已批准 Source Library entry 的評估快照，不建立第二份 `SourceRecord`，也不回寫來源欄位。entry `version=4` 新增 `intelligence_assessments[]`；Source Library v1／v2／v3 讀取及 backup import 時會保留既有資料並遷移為空陣列。IndexedDB database/store version 與 backup envelope version 不變。

每份 assessment 保存 `id`、`schemaVersion=1`、`sourceRecordId`、`sourceFingerprint`、建立／更新時間、`needs_review`／`reviewed` 狀態、解釋、0–1 assessment confidence、ruleset metadata、維度及 routes。Source fingerprint 必須等於同 entry 的已批准 SourceRecord fingerprint；不匹配的 assessment 不可保存或匯入。重跑評估會新增 assessment，保留舊評估和 route decisions。

目前 ruleset `radar-intelligence-rules-v4` 提供 0–100 的五個維度；validator 保留 v1／v2／v3 assessment snapshot 的可讀性。v4 加入繁中 focus-term 語意群組（每組最多計一次）、明確的來源 review／reuse approval workflow signal，並移除無 reuse evidence 時的基礎分數；舊評估不會自動重算：

- `source_quality`：來源 URL、requested/final URL provenance、作者／日期、正文、取得方式及人工 evidence grade 的欄位完整度；signals 會顯示缺失／未知欄位。這些是可靠度線索，不是來源可信度查證。
- `relevance`：在 SourceRecord 原文與已保存的標題／摘要／分析欄位中，與文件列出的 Radar focus 語意群組（英文及繁中詞／詞組）作完整詞／詞組邊界比對；同一群組即使命中多個詞亦只計一次，避免子字串及同義詞重複加分；目前是固定基線，未讀取使用者個人 profile。
- `evidence_strength`：SourceRecord evidence／claim references 是否可在正文定位及 evidence grade 是否已評估；不是 claim 是否被證明。
- `actionability`：已保存的業務／AI PM implications、use cases、content ideas 是否存在；不是成效評估。
- `reuse_potential`：case candidate、logical library targets、teaching/method、creative/video signals 的存在情況；沒有可觀察 reuse signal 時分數為 0。

`source_quality` 的既有基礎分數對應 SourceRecord 已通過人工 review 與 reuse approval workflow，不代表外部來源查證或可信度。validator 拒絕非有限 confidence、錯誤 route ID／signal 型別；Source Library validator 拒絕同一 entry 內重複 assessment IDs。

每個分數附 explanation 與可觀察 signals；整體 explanation 明示 rule-based、advisory。assessment confidence 是五個維度中具有可觀察 signals 的比例（0–1）；非模型機率、分數正確率或事實可信度。baseline score 本身不增加 confidence。規則只讀已批准 SourceRecord 快照，不呼叫 Gemini／OpenAI。

每份 assessment 提供 `research_brief`、`learning_pack`、`content_candidate`、`creative_reference`、`case_reference` 五項 route recommendations；各自含分數、原因、signals 與 `pending`／`accepted`／`rejected`／`overridden` human decision。Reject／override 必須寫原因；override 必須選另一個已支援 route。所有決定完成後 assessment 才是 `reviewed`。這不會把來源設成 `verified`，亦不會批准任何 handoff。

只有明確接受／覆寫 route 後才可建立相應草稿：Research Brief 使用既有 Research Brief contract，其餘使用既有四類 Handoff。assessment 記錄建立的 artifact ID；Library entry validator 會確認該 ID 指向同一 SourceRecord 下、route 類型相符的 Brief／Handoff，孤兒或錯 route 的連結不可保存或匯入。新 handoff 一律仍為 `draft`，沿用既有獨立 review／approval/fingerprint gate；router 不能批准、匯出或發布。拒絕的 route 不產生草稿。

## 本機公開文章 helper

在 Next `output: "export"` 下，URL 擷取不能由公開靜態站直接執行。`npm run dev:local` 會啟動只綁定 `127.0.0.1` 的 companion helper。它只接受本地 app origin，限制標準 HTTP/HTTPS、DNS 結果、redirect 次數、timeout、回應大小與 HTML content type；每次 redirect 都重新解析與驗證目標，不帶 cookies 或 credentials。首頁、空白／不足正文、登入／驗證頁與非 HTML 回應都會進入 manual fallback。公開部署或 helper 未啟動時，來源工作台會保留 URL 並要求貼正文。

```bash
npm run source:candidate
npm run validate:data -- fixtures/candidates
npm run validate:daily -- fixtures/candidates
```


URL-only 或缺 evidence 的來源會保留在 SourceRecord，並停在 recovery/review 階段；可補上 `Paste transcript`、`Paste text`、`Upload subtitle` 或 `Add notes` 後再重新處理。

## Validation

```bash
npm test
./node_modules/.bin/tsc --noEmit
npm run validate:data
npm run validate:daily
npm run validate:data -- fixtures/candidates
npm run validate:daily -- fixtures/candidates
```

## Local daily research runtime v3

每日研究 runner 是 Source Inbox 旁邊的本機 JSON 工作流，不改 `SourceRecord.record_version=2` 或 daily JSON schema。預設資料位於 `.runtime/research/`：`config.json` 保存明確交給 runner 的訂閱／專案卡與收集、分析、排程設定；`state.json` 保存來源素材、分析簡報草稿、每日用量、run history 與 feedback；`run.lock` 防止重複執行；`runner.log` 只保存有限執行摘要。runtime 的 `version=3` 可由既有 v1/v2 資料遷移；寫入採原子替換。本機備份可由研究簡報頁下載完整 JSON；目前沒有完整 runtime 的匯入／還原流程。

`ResearchBriefDraft.version=3` 保存 `material_id`、`source_record_id`、模型／來源範圍、published／updated／discovered／analyzed 日期、入選理由、摘要、claims 與各自的 evidence、來源逐字方法片段、適用情境、業務與 AI PM 推論、未確定事項、專案建議、人工採用決定、供應商回報 usage 與人工 feedback。日期未知時保持 `null`；source scope 為 `summary_only` 時不可冒充全文分析。簡報只作待人工核對草稿，永遠不自動變成 `reviewed`、`approved` 或 `verified`，也不直接寫入正式 daily data。

研究結果交接到 Source Inbox 時另比對 `material_id`、`source_version`、`result_version` 與 imported fingerprint。背景結果沒有本地衝突時可安全套用；本地表單已修改時必須由使用者選擇保留或套用，不會靜默覆寫。套用背景更新後，review 與 approval 必須重做。SourceRecord 仍使用既有 `key_claims[].evidence[]` 保存每項 claim 的來源引用；UI 的共用 evidence 欄位不得把第一項 evidence 覆蓋到其他 claims。

本機限制：每次最多 12 個來源、每 run 最多 10 筆素材、每天最多 10 次正文擷取、10 次模型請求（重試亦計）、5 份簡報及 1 個具來源依據的行動建議。只有模型回傳且通過逐字正文核對的 `method_or_teaching_points`，並且存在明確相符的專案卡，才可形成一個 30 分鐘限時實驗建議；缺少任一條件就不產生行動。時間是規劃估算，不是量度結果，也不會自動加入 active build。工作台手動 AI 分析不計入 runner 每日 10 次，但仍受供應商配額約束。執行與 UI 均保留 failed／manual-input 狀態；失敗素材需明確重試，不會無限自動重送。每日狀態混合成功與失敗時記為 `partial`，不把整批誤報為全數失敗。
