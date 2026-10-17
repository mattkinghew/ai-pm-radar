# AI PM Radar 內容工作流

## Related SOP

For the reusable daily publishing checklist, see:

- `docs/DAILY_CONTENT_SOP.md`

## 每日內容生產流程
1. 將來源送入 Universal Source Inbox；可一次貼最多 5 個 URL，或貼正文／上傳 TXT、Markdown、SRT、VTT
2. 透過 adapter 與 normaliser 轉成 `SourceRecord`
3. 依選文標準篩選 5 到 10 則候選
4. 逐篇整理摘要與欄位內容
5. 素材取得、AI 分析與 daily candidate 是三個分開狀態；使用者按「AI 整理」後才送出正文，AI 只做可編輯 enrichment 草稿，狀態保持 `needs_review`
6. 人工審核事實、證據、風險與用戶相關性
7. 將已審核內容轉成既有 daily JSON
8. 放入 `data/daily/YYYY-MM-DD.json`
9. 執行 `npm run build`
10. 通過後再部署靜態站

## Universal Source Inbox

來源層不按平台複製 pipeline，而是採用：

```text
Source -> Adapter -> Normaliser -> SourceRecord -> Enrichment -> Review -> Library
```

P0 輸入包括 manual URL、paste text、paste transcript、Markdown、TXT、SRT、VTT。所有輸入都必須留下 `SourceRecord`；adapter 失敗時仍保留原始內容，並提供 `Paste transcript`、`Paste text`、`Upload subtitle`、`Add notes` 的 manual fallback。

平台邊界：

- X：只設計 official API interface；沒有 `X_BEARER_TOKEN` 時 graceful disabled。
- Telegram：優先 Collector Bot / forwarded content；不做 arbitrary public-channel scraping。
- YouTube：P0 接受 URL metadata、description、user-pasted transcript、SRT、VTT、user-owned media transcript；不假設可下載任意第三方字幕。
- Bilibili：Experimental；只做安全可取得的 URL metadata 與 manual transcript / uploaded subtitle，不依賴 cookies、SESSDATA 或 private session。

欄位 contract 與 adapter capability 詳見 `docs/DATA_SCHEMA.md`。

SourceRecord 可先以 `library_targets` 標記 logical collections：Trend Library、Case Library、Creator Library、Video Reference Library、Content Idea Library。這些在第一版仍是 JSON 分類，不代表已自動發布。

## 可重現的人工 enrichment / review 流程

本地示範使用三組 synthetic fixtures：

- `fixtures/source-inbox/paste-text.json`：有來源 URL、可追溯原文、key claims 與文字 evidence。
- `fixtures/source-inbox/srt.json`：保留 subtitle transcript、timestamps 與 timestamped evidence。
- `fixtures/source-inbox/url-only.json`：只有 URL，會顯示 recovery 需求並被候選輸出 gate 阻擋。

執行：

```bash
npm run source:candidate
npm run validate:data -- fixtures/candidates
npm run validate:daily -- fixtures/candidates
```

輸出分開保存：

- `fixtures/candidates/2026-09-19.json`：只含既有 daily JSON schema 的候選文章，不會覆寫 `data/daily/`。
- `fixtures/source-records/2026-09-19.json`：保存三筆 SourceRecord、原文、timestamps、evidence、uncertainties 與 review/approval 狀態。

只有同時符合 `review_status=reviewed`、`approval_status=approved`、有正文、至少一筆 evidence、每個 key claim 有 evidence，且有完整 daily metadata 的資料才會進入候選。人工批准不是 `verified`；daily candidate 的 `review_notes` 也會保留這個邊界。

若來源只有 URL 或 adapter 無法取得正文，先不要放入 `data/daily/`。保留 SourceRecord，依序嘗試 `Paste transcript`、`Paste text`、`Upload subtitle`、`Add notes`；補足原文與 evidence、完成人工 review 後，再重跑候選產生器。

## 瀏覽器來源工作台（URL / Paste Text P0）

本地開發時可由首頁主導覽進入 `/source-inbox/`，或直接開啟：

```bash
npm run dev
# http://localhost:3000/source-inbox/
```

如需在本機使用一般公開 HTML 文章的 URL 草稿擷取，使用同時啟動 Next dev server 與受限 helper 的命令：

```bash
npm run dev:local
# http://localhost:3000/source-inbox/
```

helper 只綁定 `127.0.0.1`，只接受目前 `AI_PM_RADAR_APP_PORT` 對應的 `localhost` 或 `127.0.0.1` 瀏覽器來源。它只處理 `http` / `https` 的一般公開 HTML 文章，會在每次 redirect 重新做 DNS 與私有／保留位址檢查，並以已驗證的 DNS address 連線，限制 redirect、timeout、回應大小與 content type，不帶 cookies 或登入資料。它不下載影片、不繞過登入／付費牆／驗證頁，也不使用公共 CORS proxy。按 `Ctrl-C` 會同時停止 app 與 helper。

### AI provider 設定

獨立 helper 不會由 Next.js 自動載入 `.env.local`；`scripts/source-fetch-helper.mjs` 會在啟動時讀取專案根目錄 `.env.local`，但不覆寫已存在的 process environment。請複製或建立本機設定（不要提交真實 key）：

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=本機 Gemini API key
GEMINI_MODEL=gemini-3.5-flash-lite
```

只在使用者按下「AI 整理」時呼叫目前選定 provider。Gemini 使用 `x-goog-api-key` server-side header、`generateContent` 與 JSON schema；OpenAI adapter 只有在明確設定 `AI_PROVIDER=openai` 時使用。沒有 fallback、不會因 Gemini 失敗自動呼叫 OpenAI，也不會使用 `NEXT_PUBLIC_` key。`/status` 只回報 provider、model、configured；configured 不等於認證成功或有剩餘額度。helper 與 `.env.example` 的目前預設是 `gemini-3.5-flash-lite`；2026-09-20 已以同一個本機 helper 完成一次真實 `generateContent` runner 驗收。舊 `gemini-2.5-flash-lite` 的 `404 NOT_FOUND` 只保留作歷史診斷，不代表目前服務，也不會觸發自動 fallback、改寫 `.env.local` 或啟用計費。

`npm run dev:local` 啟動前會檢查 app/helper port；若已被本專案的活躍程序佔用，會清楚停止並要求先停止舊程序或指定空閒 port，不會刪除 Next lock。runner 會同步傳遞 `NEXT_PUBLIC_AI_PM_RADAR_FETCH_PORT`，所以 app port 或 helper port override 後，前端請求與 helper allowlist 仍一致。

如 3000 已被佔用，可用 `AI_PM_RADAR_APP_PORT=3001 AI_PM_RADAR_FETCH_PORT=4311 npm run dev:local`；helper 會只允許同一個本機 app port。

公開靜態部署沒有這個本機 helper；UI 會明確提示「本機 URL helper 未啟動」並保留 URL，提供重試與改貼正文。helper 也會把拒絕存取／登入頁、逾時、非 HTML、回應過大、無可用正文分開回報。X、YouTube、Bilibili、Telegram 在嘗試擷取前直接顯示本輪不支援，會保留 URL 並進入補正文／字幕的 recovery 流程。

操作順序：

1. 在「匯入素材」選擇「貼連結」或「貼正文」。URL 模式按「讀取連結並建立草稿」；正文模式按「整理成草稿」。
2. 草稿會保留原始 URL、最終 URL、擷取時間與正文。URL 擷取取得的標題／作者／日期仍須人工核對；取不到的 metadata 保持未知，不會用網域冒充出版者。
3. 在正文段落清單直接選取原文摘錄作 evidence；這是規則預填，不是 AI 摘要。再展開人工分析與 daily candidate 欄位，補齊必要欄位。
4. 按「下一步：進入批准與下載」進入第三階段；先「完成核對並標記已審核」，再按「批准並下載候選檔」。兩個動作分開；批准不代表事實 `verified`。
5. candidate 通過既有 gate 後下載 daily candidate JSON；同時下載 SourceRecord 備份以保留全文、evidence、原始／最終 URL 與 provenance。

工作台使用現有 `normaliseSourceInput`、`applyManualEnrichment`、`applyManualReview`、`buildDailyCandidate`；URL 擷取與 AI 分析都只由本機 companion helper 執行。AI 分析不會在素材取得時自動觸發；使用者明確按下後才送出正文，並受輸入字數、有限重試、timeout 與輸出上限約束。模型沒有工具權限，來源文字只視為不可信資料。Gemini 回應會映射到既有 AI draft schema，再核對每個 evidence `text_reference` 是否存在於原文；輸出格式、模型拒絕、provider HTTP、認證、逾時與 evidence 失敗會分開回報，且不放寬驗證。瀏覽器只建立下載檔，不會寫入 `data/daily/`。Candidate 檔名與 SourceRecord 檔名共用日期與 `SourceRecord.id`，daily JSON 則沿用既有欄位，不新增 provenance 欄位。

### 關注來源與手動 RSS／Atom 同步

來源工作台的「關注來源」區域保存 RSS／Atom feed URL，不會把一般網站首頁或社交帳號 URL 當成 feed。第一次開啟不會自動新增來源或發出請求；使用者新增來源後按「立即同步」或「同步所有已啟用來源」。每次最多同步 12 個來源、並行最多 2 個來源、每來源最多採用 20 筆最新項目；本輪是手動同步，沒有 cron、通知或自動發布。

同步只收集 metadata／summary／feed content，不呼叫 AI、不批准、不發布。RSS／Atom 項目先加入既有素材卡片；只有摘要或 metadata 的卡片會顯示需要取得正文，使用者可沿用公開 HTML helper 或改貼正文。Feed 來源的 expert name 不會自動當成每篇文章作者；取不到作者／日期時保持未知。

同 feed 先以 GUID／item ID 去重，跨 feed 再以正規化 article URL 去重；只移除明確 tracking parameters。相同項目不覆寫既有正文、人工編輯、分析、review 或 approval；feed 顯示 updated 時只記錄待檢查更新。ETag／Last-Modified 只有在成功解析與保存後才保存，304 只表示沒有新內容。

Feed URL、XML、title、summary 與 article URL 都是不可信輸入。helper 只接受 http／https、重新驗證每次 redirect 的 DNS、拒絕私有／保留／link-local／metadata 位址、不帶 cookies 或 credentials、限制 timeout／redirect／回應大小／XML MIME，並拒絕 DTD／ENTITY；來源 HTML／script 不會直接插入頁面。helper 停止或 feed 失敗時，來源清單與既有素材仍保留，提供重試；匯入／匯出使用獨立版本化 backup contract。

### 素材收集與 AI 分析

工作台素材卡片分開顯示：`captured`／`needs_manual_input`／`capture_failed`、`not_requested`／`processing`／`draft`，以及 daily gate 的 `reviewed`／`approved`。一筆 URL 失敗不會阻擋同批其他 URL；失敗卡片保留 URL、可重試，或改貼正文／字幕。

AI 分析輸出包括摘要、來源明確內容、核心觀點、帶正文 evidence 的 claims、業務含意、AI PM 含意、情境、內容角度、未確定事項、建議標題／分類與帶理由的分數建議。模型分析與來源事實分開保存；模型引用的 evidence 不存在於正文時不套用結果。AI 草稿可編輯，但不會自動變成 `reviewed`、`approved` 或 `verified`。

本機設定（不要把真實 key 寫入 `.env.example` 或聊天）：

```bash
# 若 .env.local 已存在，不要覆寫；以本機編輯器更新，不要把 key 放進 shell history
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
npm run dev:local
```

公開靜態站沒有 companion helper 或 server-side key 時，仍可貼正文、上傳字幕、保存 IndexedDB 草稿、下載／匯入 JSON 備份及人工編輯；AI 分析按鈕會清楚顯示未設定或服務不可用，不會假裝完成。IndexedDB 只保存目前瀏覽器的文字型草稿與分析結果；清除網站資料可能遺失，沒有雲端同步或一鍵恢復服務。

本機目前選定 Gemini；`configured=true` 只代表必要設定存在，不代表 key 有效、模型可用或有免費 quota。Gemini 失敗不會自動呼叫 OpenAI；如需改 provider，必須由使用者明確修改本機設定。模型回報 usage 時顯示 token 數，不推算或捏造費用。

介面語言不會翻譯文章或保證模型輸出語言；工作台傳入的 `language` 是來源語言提示。2026-09-20 的 v0.8 合成繁中素材 live 驗收得到繁中摘要，英文 evidence 既有回歸案例也保持來源語言逐字引用；每次輸出仍須人工確認，不應把單次驗收視為語言保證。

若修改正文、evidence、metadata、enrichment 或日期，先前的 fingerprint approval 會失效，狀態回到 `needs_review` / `not_approved`。缺正文、evidence、必要 metadata、enrichment、URL 或未明確批准時，candidate 下載會被阻擋，頁面會列出具體原因；SourceRecord 仍可下載作為本地 recovery 備份。

語言預設為繁體中文，可由 header 切換「繁中＋英文」。語言偏好只存於瀏覽器 localStorage；素材草稿與分析結果另存於目前瀏覽器 IndexedDB，但仍應定期下載 JSON 備份。

繁中模式的操作介面只顯示繁體中文（AI PM、Radar、SourceRecord 等必要專有名詞除外）；雙語模式使用中文主標籤加英文副標籤。文章原文、使用者內容、JSON keys、ID 與 enum values 不翻譯。切換語言不會改變候選資料內容。

### 本輪資料來源界線

- 公開文章擷取：helper 取得 HTML、標題、可取得的作者／發布時間與正文；登入導覽本身不再代表阻擋，只有實際登入／驗證 interstitial 或拒絕狀態才 fallback；teaser／付費牆前言會標示可能不完整。這些都是「擷取結果」，仍需人工核對。
- 規則整理：正文首個非空行可作暫定標題，首段可作明確標示的原文摘錄；不稱為 AI 摘要。
- 人工分析：若未設定 provider，summary、why it matters、業務含意、AI PM 含意、content ideas、uncertainties 與 daily metadata 仍可人工填寫；設定 provider 並按 AI 整理後，這些欄位會成為可編輯的 AI 草稿，必須核對原文後才能進 review／candidate。
- helper 失敗或 metadata 不完整時，已輸入 URL 與正文不會清空；返回編輯區補正文即可。沒有重新匯入功能，不宣稱 SourceRecord 下載可一鍵恢復。
- 2026-09-19 實測：使用者提供的 Yipee 公開文章可經瀏覽器進入草稿，標題非空、正文 1374 字元、發布時間可取得、作者保持空白；helper 直接測試的 W3C 與 MDN 公開 HTML 文章也取得非空標題與正文。作者／日期缺漏不會清空正文，但 candidate gate 仍按既有規則要求人工補齊。

## 選文標準
- 與 AI 產品、AI 應用、商業決策、工作流程或 AI literacy 有直接關聯
- 對非技術 AI PM 學習者、NGO / 教育實務者、SME 決策者至少一類受眾有明確價值
- 可連回可信來源，不接受沒有明確 URL 的二手轉述
- 優先選擇能回答「為什麼重要」而非只追 headline 的內容
- 避免純市場炒作、無法驗證的傳聞、過度投資導向內容

## JSON Schema 說明
- `question_title`
  - 用問題形式表達該則內容的核心議題
- `short_title`
  - 給卡片與 slug 使用的短標題
- `summary`
  - 2 到 3 句摘要，不加入未確認事實
- `why_it_matters`
  - 解釋這則內容對目標用戶的重要性
- `business_angle`
  - 從組織、營運、決策或 ROI 角度解讀
- `ai_pm_angle`
  - 從產品管理、範圍界定、評估或 rollout 角度解讀
- `risk_note`
  - 明確寫出誤用、過度樂觀、來源限制或治理風險
- `category`
  - 建議使用穩定分類，例如 `AI PM Learning`、`Product Strategy`、`Governance`
- `tags`
  - 2 到 5 個簡短 tags
- `source_name`
  - 來源名稱
- `source_url`
  - 完整來源 URL
- `published_at`
  - ISO 時間格式
- `impact_score`
  - 1 到 10，表示潛在影響力
- `relevance_score`
  - 1 到 10，表示與目標受眾的相關性
- `trust_score`
  - 1 到 10，表示來源可信度

## 手動工作流
1. 先建立或匯入 `SourceRecord`
2. 人工閱讀候選來源
3. 先記錄來源名稱、URL、日期與 evidence reference
4. 用自己的話寫摘要，不複製原文
5. 補上 `why_it_matters`、`business_angle`、`ai_pm_angle`
6. 加入保守的 `risk_note`
7. 只有明確批准的 SourceRecord 才可用 template 或 candidate converter 建立當日 JSON
8. 候選先放在非正式路徑，通過兩個 daily validators 後才由人工決定是否複製到 `data/daily/YYYY-MM-DD.json`
9. 本地 build 驗證頁面是否正常顯示

## 半自動工作流
1. 人工先選好來源文章
2. 使用 `prompts/article_summarizer.md` 逐篇生成單篇草稿
3. 使用 `prompts/daily_json_generator.md` 合併成當日 JSON
4. 使用 `prompts/content_reviewer.md` 做第二輪 AI 審查
5. 最後由人工確認後才寫入正式檔案

## AI Review 工作流
- AI enrichment 只能產生 `summary`、`key_points`、`key_claims`、business / AI PM / video implications 與 content ideas 草稿
- AI 不得直接將 `review_status` 設為 `verified`；重要 claim 儘量保留 `source`、`timestamp`、`text_reference`
- `text_reference` 必須保留來源語言並逐字對應一個連續原文片段；只接受 whitespace／換行差異，禁止翻譯、改寫、拼接或省略號。通過後系統以原文片段保存 evidence，仍需人工判斷是否支持主張。
- 分析以不可變正文 snapshot 執行；若正文或素材識別在回應前改變，舊分析不會套用，需對目前正文重新分析。
- 檢查是否有 hallucination 或補寫來源未提及的結論
- 檢查是否把資訊包裝成投資、法律或醫療建議
- 檢查 `source_url` 是否缺漏或不完整
- 檢查內容是否對目標受眾有清楚價值
- 檢查 `risk_note` 是否過弱或缺失
- 檢查 category 與 tags 是否一致

## 本機每日研究簡報操作

研究簡報是 Source Inbox 的本機 research 工作流，不會改寫正式 daily JSON。先啟動 app 與 helper，再從首頁進入來源工作台；把已選 RSS／Atom 來源明確交給本機 runner 後，才可按「立即執行一次」。素材取得不會自動呼叫模型；AI 分析須在設定中明確啟用，且 runner 受每日用量上限約束。

```bash
npm run dev:local
npm run research:run
npm run research:run -- --retry-failed
npm run research:schedule -- status
npm run research:schedule -- enable
npm run research:schedule -- disable
npm run research:schedule -- remove
```

`research:run` 使用本機 runtime 訂閱與設定；自動收集與自動 AI 分析是獨立開關。關閉收集時不會自行發現來源，但可分析已保存且有正文的 pending 素材；關閉分析時仍可收集與保存正文。`--retry-failed` 才會重試先前失敗或 provider 停止的素材。工作台的手動「AI 整理」不計入 runner 每日 10 次上限，但仍受供應商配額約束。相似報導只作保守排序降權，不會刪除來源；一筆失敗不會阻擋其他素材。

macOS 排程預設關閉；只有檢查設定、來源範圍、provider/model 與每日上限後，才手動執行 `npm run research:schedule -- enable`。`disable` 關閉新排程請求並保留 plist；`remove` 卸載及刪除 plist，但不刪來源、設定或研究結果。若 runner 已在執行，停用會先關閉設定並顯示 PID，不強制殺掉當次工作；完成後再執行 disable 或 remove。排程以 `Asia/Hong_Kong` 每日 08:00 後首次 5 分鐘喚醒為準，不累積補跑所有錯過日期。

研究簡報位於 `/research/`，只顯示 AI／規則草稿、來源 dates／scope、evidence、用量、專案建議與人工 feedback。`summary_only` 表示只有摘要／metadata，需補全文才可視為全文分析；正文擷取失敗或無 article URL 的項目會標成待補正文，不送入模型。一筆來源失敗不阻擋同批其他項目。行動建議必須同時有可逐字定位的方法片段及明確相符的專案卡；只具方法、但沒有相關專案時不產生 action。

runner JSON 預設保存在 `.runtime/research/`，不使用 database；頁面可下載完整 backup，但目前沒有完整 runtime backup 匯入／還原功能。下載備份並保存在本機安全位置。研究結果交給 Source Inbox 時會比對 material ID、source/result version 與已匯入 fingerprint：未經本地修改可安全更新；若使用者已編輯則顯示「保留本地／套用背景結果」衝突選擇，不靜默覆寫。每項 claim 的 evidence 分開保留；任何套用更新都會讓既有 review／approval 失效。分析、來源選取、回饋或建議都不是批准；正式 daily candidate 仍須回到 Source Inbox，逐項核對原文並完成既有 review → approve gate。Candidate 只供下載，不會寫入 `data/daily/` 或自動發布。

2026-09-20 本機驗收使用隔離 runtime 完成一次真實 Gemini runner 分析、研究頁 feedback 儲存與 reload、完整備份下載、Source Inbox 衝突處理與逐 claim evidence 預覽；`analysis.analyzed_at` 已寫入，狀態仍為 `needs_review`／`not_approved`／`ungraded`。macOS LaunchAgent 只在隔離 HOME 完成 enable → status → disable → remove 生命週期；使用者目前排程仍為關閉且未載入。

### 首次設定與執行（五步）

1. 執行 `npm run dev:local`，開啟 `http://localhost:3000/source-inbox/`。
2. 在「關注來源」新增或啟用已確認的 RSS／Atom，設定主題、優先級與關注原因；也可只保留既有來源。
3. 在「本機每日研究 runner」分開勾選收集／AI 分析，核對顯示的 provider、model、來源範圍與每日上限，再按「交給本機 runner」。
4. 按「立即執行一次」或在 terminal 執行 `npm run research:run`；完成後開啟 `http://localhost:3000/research/`。
5. 核對 evidence、限制、專案建議及方法片段，保存採用／backlog／略過回饋；要加入 daily 時才開啟 Source Inbox，完成獨立 review → approve → candidate download。

## 下游交接（Downstream Handoff Contracts v1／Radar v0.2.0）

在 `/research/` 已批准來源 Library 中，可重用同一份來源建立 Content Candidate、Learning Pack、Creative Reference 或 Case Reference。選類型建立草稿後編輯下游欄位；來源 facts、逐 claim evidence 與 provenance 沿用同一個 SourceRecord snapshot，不必重貼。引用可定位只表示可回到原文，仍需人工判斷其是否支持主張。

每份交接各自遵循 draft → review → approval。內容修改會使舊 review／approval 失效；只有明確批准的交接可下載 JSON／Markdown。此批准不會改變 SourceRecord `verified`、daily candidate approval 或發布狀態。舊 Research Brief handoffs 保持相容，交接不寫入正式 `data/daily/`。

研究頁的 SourceLibrary backup 可匯出／匯入來源及四類交接；匯入按來源 ID／fingerprint 合併，既有本機版本優先。備份是使用者管理的本機檔案，不是雲端同步；IndexedDB 仍為 origin-local，清除網站資料可能遺失未匯出的素材。

## Intelligence Delivery & Consumer Compatibility v1（Radar v0.3.0 — RELEASED）

### Radar 內建立與匯出

1. 在 `/research/` 的已批准 SourceRecord 卡片選取一筆已批准 handoff。SourceRecord approval 不會自動批准 handoff。
2. 在 Delivery Outbox 按「建立 delivery package」。系統只做 deterministic snapshot，不呼叫 AI；建立時會檢查 SourceRecord/handoff approval fingerprint、target/type、contract version、provenance、evidence 關聯及 package fingerprint。
3. 打開 package 預覽，核對 target、版本、SourceRecord／handoff ID、fingerprint、evidence、provenance 與衍生分析。只有相容性通過且仍 current 的 package 才可匯出。
4. 匯出 canonical JSON 或 Markdown。Content Ops target 另可下載 `content-ops-intake.json`；其格式對應 Content Ops 現有 `content-ops-handoff` v1 file importer。Package 只含 source facts、必要 evidence excerpts、provenance 及衍生內容，不帶整篇 raw source。
5. 匯出後狀態為 `exported`，只表示檔案已匯出。若接收端已由人工確認匯入，再按「我已在接收產品確認匯入」記錄 `import_confirmed`；不要把這個人工記錄描述成自動回執。

### Content Ops pilot（file handoff）

在 Content Ops Studio 的 Inbox，展開「More intake options · manual form and handoff package」，選擇 `content-ops-intake.json`，按 Preview package，檢查 source system、種類、重複項目及 target brand，再明確按 Import to Inbox。Content Ops 當前 `normalizeHandoffItem` 會將匯入 Source status 設為 `needs_review`；Radar export 不會建立 Idea、批准來源、修改 Brand Memory、建立已發布內容或自動發布。

本 repo 的合成 intake fixture 是 `fixtures/content_ops_compatibility_fixture.json`；Content Ops contract 的 read-only 對照來自其 `src/handoff.ts` 與 handoff intake UI。此 fixture 通過 Radar 端 shape tests 不等於已在 Content Ops runtime 實際匯入；若沒有跨 app browser 驗收，狀態須標為 `Consumer Import — NOT VERIFIED`。Cyber Kuma、Storyworld、Diagnostic 只有版本化 profile 與 package fixtures，沒有 receiver importer。

### Revision、舊 package 及 backup

- 修改 handoff 會清除其 review／approval fingerprint。重審並重新批准後可建立新的 package revision；舊 package 不覆寫，依目前 SourceRecord/handoff fingerprint 顯示 `outdated`，仍可 inspect，但不能作 current package 匯出。
- `packaged` 不是已匯出；`exported` 不是已收到；`import_confirmed` 是操作者確認記錄；`outdated` 是依關聯 fingerprint 推導的狀態。
- Source Library backup 現已包含 intelligence assessments、package snapshots 與 lifecycle state。Source Library v1／v2／v3 backup entry 可遷移；舊 handoff v1 的內容與關聯保留，但因沒有批准 fingerprint，舊 approved handoff 會遷移至 `needs_review`，重新批准前不可 package。未知欄位不刻意丟棄。
- Source Library 仍只存在目前瀏覽器 IndexedDB；backup/import 是手動檔案交接，不建立跨裝置同步或雲端儲存。

### Intelligence Scoring & Routing（v0.4 work in progress）

在 `/research/` 的已批准 SourceRecord 卡片中，按「評估 intelligence value」才會建立 rule-based assessment。評估只讀該筆已批准 SourceRecord，保存於同一 Source Library entry（entry schema v4），不呼叫模型、不改來源內容、不替代來源／daily approval。Source Library v1–v3 的 entry 與既有 IndexedDB store 會在讀取／匯入時遷移；定期匯出 Source Library backup。

核對五個維度的分數、解釋及 signals。這些分數是 completeness／keyword／existing-field signals，不是事實、來源可信度認證或效果量測；`source_quality` 會把未知作者、日期及 provenance 欄位明確顯示為缺口，但不宣稱已獨立驗證來源。`relevance` 會搜尋 SourceRecord 原文及已保存欄位，按文件化的 AI PM、business/workflow、education/NGO/SME 繁中與英文 focus-term 語意群組作詞／詞組邊界比對；同一群組最多計一次，並非個人化 profile。Evidence 分數只檢查原文可定位性，不代表引文支持 claim。Assessment confidence 是五個維度中有可觀察 signals 的比例；baseline score 不會增加 confidence，且它不代表模型機率或事實可信度。Ruleset v4 修正繁中 relevance、明示來源 review／reuse workflow signal，並將無 reuse signal 的分數設為 0；validator 保留 v1／v2／v3 snapshots，既有評估不會自動重算。

逐項處理 Research Brief、Learning Pack、Content Candidate、Creative Reference、Case Reference 路由建議：接受、附原因拒絕，或附原因覆寫到另一項路由。每項決定獨立保存，未決項目保留 `pending`。接受／覆寫後可選擇建立草稿；assessment 的 artifact ID 必須對應同一 SourceRecord 下的正確 Brief／Handoff route，否則 Source Library validator 會拒絕保存／匯入。建立 Research Brief 或既有 handoff draft 不會自動 review、approve、verified、匯出或發布。其後仍須使用現有 handoff editor 完成獨立 review／approval。

若來源 fingerprint 改變，舊 assessment 不會被當成新來源評估使用；需對目前已批准的 SourceRecord 重新評估。評估與 route decision 只保存在目前 browser origin 的 IndexedDB；不同手機／桌面不會自動同步。

2026-10-09 隔離 Chromium 驗收：以合成英文素材完成 paste → SourceRecord → evidence／人工分析 → review → reusable-source approval → 五維評估 → 接受 Case Reference route → 建立未批准草稿；reload 後評估、route decision 與草稿關聯仍在。全程沒有 AI 呼叫、daily candidate 或發布；此為本機 browser acceptance，不代表真機／遠端部署驗收。截圖：`/private/tmp/radar-v04-acceptance.png`。

2026-10-09 後續同 context 驗收：沿用隔離 browser 的頁面導覽（不以新 `open` context 代替 reload），完成 Case Reference draft 的獨立人工 review／approval；重新載入後 IndexedDB 仍能讀回 accepted route、相符 artifact ID 及 `approved` handoff。360／390／768／1280px 的 document/body width 均等於 viewport。沒有 AI 呼叫、daily candidate 匯出、發布或正式資料修改。Console 有一個 `/favicon.ico` 404，未阻擋流程；完整 v0.4 規格仍待補齊。

2026-10-09 語言回歸驗收：Research 頁面的 assessment explanations、dimension explanations、signals 與 route recommendation 會依 zh-Hant／bilingual 偏好切換；合成 focus tokens 保留原文，不改寫已保存的 assessment 或 SourceRecord。`npm test` 119/119、typecheck、正式及 candidate validators、兩種 build 通過。既有 `/favicon.ico` 404 非阻斷且未修；版本維持 `0.3.0`，v0.4 完整規格／DoD 尚待補充。

### Release acceptance（2026-10-07）

- Radar Flow A–D 已在支援 IndexedDB 的隔離 Chromium 完成；JSON、Markdown、Content Ops intake 下載均讀回成功；backup 在新 browser context 匯入並 reload，SourceRecord、4 handoffs、5 packages 與 1 個 outdated revision 保留。
- 360／390／768／1280px Outbox viewport 均沒有水平溢出。`npm test`（105/105）、typecheck、正式與 candidate validators、兩種 build、`health:mobile` 通過；origin 無 Access JWT 時 fail-closed。
- Content Ops 接收端實際匯入為 `NOT VERIFIED`；Radar export 不代表已接收。`git diff --check` 仍會提示既有 dirty `tools/deal-radar-storage/` 空白格式，未修改該無關內容。

### Fresh release-gate recheck（2026-10-08）

隔離 Chromium 確認 `indexedDB` 可用；新 browser session 的 Source Library 起始為空。以合成 SourceRecord 完成四種已批准 handoff/package：Content Candidate、Learning Pack、Creative Reference、Case Reference。Content Candidate JSON、Markdown、Content Ops intake JSON 及其他三類 package JSON 均由 UI 下載並讀回；Content Ops receiver 並未實際匯入，狀態仍是 `NOT VERIFIED`。編輯已批准 Content Candidate 後 Package 1 ID／fingerprint 保持不變並標為 outdated；重新 review／approve 後 Package 2 為新 ID／fingerprint。Backup 在另一個空白 browser session 匯入並 reload，保留 1 SourceRecord、4 handoffs、5 packages、approval、evidence 關聯與舊／新 package 狀態。

360／390／768／1280px document/body 寬度均等於 viewport。初次 app 載入時 companion 未啟動，`/automation/state` 與 `/automation/status` 曾 connection refused；啟動本機 helper 後 reload，兩路徑回 200，Console errors／warnings 為 0。全程未呼叫模型、未觸發產品 receiver import、未修改正式 `data/daily/`。本機 browser viewport 驗收不等於遠端 HTTPS 或實體手機測試。

### Fresh release-gate recheck（2026-10-09）

隔離 Chromium 以合成來源完成四種 handoff/package 的 compatibility、預覽與匯出；下載的四種 package JSON 均通過 Radar package validator，Content Candidate 的 Delivery Package Markdown 與 Content Ops intake JSON 亦保留 source／handoff 關聯、evidence 及 provenance。舊 Content Candidate package 保持原 fingerprint 並標示 outdated，新 revision 使用新 fingerprint。備份匯入全新 browser context 並 reload 後，1 SourceRecord、4 approved handoffs、5 packages、evidence 關聯與 outdated/current 狀態均保留。

360／390／768／1280px 的 document width 均等於 viewport，target、compatibility、fingerprint、evidence、export disclosure 及 stale warning 可見；Console errors／warnings 為 0。`npm test` 114/114、typecheck、正式／fixture validators、`build`、`build:mobile`、`health:mobile` 通過；health 確認本機 production origin 無 Access JWT 時 fail-closed。Content Ops receiver import、公開 HTTPS 與實體手機驗收仍為 `NOT VERIFIED`；本輪未呼叫模型、未寫正式 daily data。版本已是 `0.3.0`，未改版號。

2026-10-09 fresh release-gate recheck：`npm test` 117/117、typecheck、正式及 candidate validators、`build`、`build:mobile`、`health:mobile` 通過；本機 production health 確認 origin 無 Access JWT 時 fail-closed。Playwright 隔離 context 的 IndexedDB synthetic open/write/reload/readback 通過並已刪除測試 DB；本次 360／390／768／1280px 無水平溢出檢查在 Research 頁面完成，完整 Outbox Flow A–D 沿用本文件前述同日驗收，未於此 recheck 重跑。Console 有一個非阻斷 `/favicon.ico` 404。版本維持 `0.3.0`；正式 daily data 未修改。

## 風險與 disclaimer 規則
- 不得把摘要寫成保證式結論
- 不得提供金融、法律、醫療建議
- 若來源不清或資訊不足，應明確標示限制
- 若內容帶有推測，必須用保守語氣表達
- 站內固定 disclaimer 應保持存在：
  - summaries are for learning and business awareness, not financial/legal/medical advice

## 私人手機遠端存取

遠端操作使用獨立 production 靜態輸出及同源 `/api/*`，目前網址為 [https://radar.lamlab.cc](https://radar.lamlab.cc/)。公開 Cloudflare Pages demo 不提供此 helper/runtime 能力。手機與桌面瀏覽器各自使用 IndexedDB；兩者不會同步素材或研究草稿，需由使用者透過既有 JSON backup/import 手動移轉。新 origin 沒有 localhost 草稿是正常情況；不要清除或誤以為已遷移原有資料。

遠端版本只有在 Cloudflare Access hostname-wide application 與單一明確身份的 Allow policy 建立後，才可掛上 Radar 專用 Tunnel。Tunnel route 需啟用 **Protect with Access**，以同一 team name／AUD 在流量到達 Mac 前驗證 JWT；Mac origin 仍會獨立驗證 Cloudflare JWT 簽章、issuer、AUD、期限及核准 email，再提供靜態頁面或 API。缺設定、過期登入、錯誤身份及未知 API 都會拒絕。API key 留在 server-side helper。操作、環境設定、啟動、健康檢查、停止及回滾步驟見 `docs/DEPLOYMENT.md`。

目前部署狀態（2026-09-21）：Cloudflare Access 已限制為單一使用者明確確認的 email identity；Radar 專用 Tunnel route 已啟用 Access JWT 驗證，origin 亦獨立驗 JWT。未登入請求在讀取研究資料或呼叫 helper 前被阻擋。已完成登入後 Research Brief、Source Inbox、合成素材 AI 分析、保存/reload、review gate 與候選下載驗收；使用者另回報手機遠端存取測試通過，惟設備、網路型態與 viewport 未記錄，360／390／768px 尺寸及 Console 尚未獨立驗證。啟停、health check 與回滾命令見 `docs/DEPLOYMENT.md`。Mac 睡眠、關機或斷網時服務不可用；排程／Runner AI 開關與 quota 沒有因部署改變。

## 快速收集與同頁核對（v0.9.2，2026-09-28）

本輪以合成英文短文實際量度本機工作台流程，目標是把「收集／分析」與「加入 daily」分開，而不是縮短 evidence 或 approval gate。可觀察的主要摩擦點有三個：舊版在主要輸入前展示 RSS／runner 等進階內容；素材卡只有泛用操作，下一步不隨狀態改變；AI 草稿的逐 claim evidence 沒有在同一頁集中核對。這是開發驗收觀察，不是正式使用者效率研究。

目前最短的 Paste Text 路徑是：

1. 從首頁進入「來源工作台」，選擇「貼正文」，貼入一個主要輸入，按「整理成草稿」。
2. 草稿建立後，素材卡只突出一個依狀態變化的下一步；按「AI 整理」才會明確傳送正文，結果在同頁顯示。
3. 在同頁展開逐 claim evidence、編輯原文／分析草稿；完成後才進入「核對草稿」及獨立的 review → approve → candidate download。

連結輸入會自動辨識單一 URL 或每行最多五個 URL；混合 URL 與文字時保留原輸入並切回貼正文模式，不丟棄內容。擷取失敗時原始 URL 保留在同一筆素材，提供貼正文／字幕的 recovery；不支援平台與暫時性服務失敗分開提示。這些輸入路徑仍沿用既有 SourceRecord、parser、provenance 及 candidate gate。

素材卡的狀態與下一步分開顯示：取得失敗先重試，只有正文不足才貼正文，已有正文但未分析才進行 AI 整理，已有 draft 才核對。AI 分析成功不等於 reviewed、approved 或 verified；缺少 daily 必填欄位仍只阻擋 candidate，不阻擋閱讀、保存或分析。重新整理後由 IndexedDB 恢復本機草稿，未建立跨裝置同步。

本輪同頁驗收包含：AI 草稿、可展開的逐 claim evidence、人工修改後 reload 保留、未批准 candidate 按鈕維持 disabled，以及 Research Brief 的「在來源工作台核對」直接帶入對應素材。390、360、768px 本機 viewport 均無水平溢出；公開 HTTPS／手機真機另依部署與使用者驗收紀錄分開標示。工作台仍顯示草稿尚未持久保存到雲端，需自行下載 backup。

## Reliable SourceRecord & Reuse v1（2026-10-04）

素材取得、分析草稿、SourceRecord 重用批准與 daily candidate 是彼此獨立的狀態。URL 取得失敗後可在同一素材卡補貼正文；系統保留原始／最終 URL 與 access method，不建立第二筆素材。重用 Library 僅接受已有正文或逐字稿、逐 claim 可定位原文 evidence、至少一項 evidence-backed claim，且完成人工 review 及明確 reuse approval 的 SourceRecord。可定位只代表引文回到來源，不代表主張已被事實查證；批准重用不把 `verified` 設為 true，也不批准 daily candidate。

Research Brief 的來源入口讀取目前瀏覽器 IndexedDB 中已批准的 SourceRecord snapshot，直接以同一份來源建立 synthesis 並保存來源 ID、fingerprint 與 handoff 關聯；不重新 fetch 或抽取來源。簡報內容屬分析，不回寫來源原文或冒充來源事實。使用者可在 Research Brief 的 approved library 查看與重用來源；不同瀏覽器／origin 間不會同步。

工作台及來源訂閱共用 `ai-pm-radar-source-inbox` IndexedDB，schema version 為 3；開啟端必須建立相同 object stores，版本變更時關閉舊連線，交易結束後關閉短期連線。若舊分頁仍阻止升級，關閉其他 Radar 分頁再重載；不要清除網站資料來排除升級問題。

使用者另回報測試通過。本機 E2E、360／390／768px viewport 與 Console 檢查記錄於 `docs/CONTEXT_SUMMARY.md`；外部 HTTPS／Access 與實體手機行動網路本輪未重新驗收。

### Reliable SourceRecord & Reuse v1 本機驗收（2026-10-04）

- 公開 URL 成功路徑已在本機 browser 完成：W3C 文章擷取後，Gemini draft 的逐 claim evidence 展開可見原文片段與來源 URL；編輯標題、標記 reviewed、批准進 Library 後，Research Brief 直接引用同一 SourceRecord。重新載入後 handoff、evidence 與 SourceRecord ID 仍存在。
- 失敗 fallback 已在本機 browser 完成：使用無效測試 URL 觸發明確 fetch failure；按「改貼正文」後 URL 仍保留，合成正文進入同一 SourceRecord，`access_method` 為 `manual_fallback`。AI 分析只在明確按鈕後執行，evidence 可逐字定位；人工修改、review、Library approval 及 reload 均保留。
- Library approval 與 daily candidate approval 是不同 gate。第二情境的 daily candidate 保持空白且按鈕停用，因作者／來源 metadata、evidence grade 及 daily approval 尚未完成；正式 `data/daily/` 不會由 Library handoff 修改。人工審核或批准均不會將分析自動標為 verified。
- browser QA 曾發現 Research Brief 的長 URL 撐寬素材卡；加入可換行及 `min-width: 0` 後，Research Brief 與 Source Inbox 在 360／390／768px 均量得 document/body 寬度等於 viewport。fresh browser session Console errors 為空；React DevTools／HMR info 不視為 app error。390px 完成合成文字 capture → evidence → review → reuse approval → Research Brief → reload，候選發布 gate 仍 disabled。
- 這是本機 browser viewport 驗收，不等同 production HTTPS 或實體手機行動網路驗收；使用者另回報手機測試通過，兩者分開記錄。外部 HTTPS 與真機仍待直接驗收。

### Intelligence Delivery v1 release acceptance（2026-10-11）

以合成 SourceRecord 完成 Radar Flow A–D：建立並下載 handoff/package、修改來源後保留舊 package 並產生新 fingerprint、對四種 consumer profile 匯出相容 package，以及在空白 browser context 匯入 Source Library 備份並 reload。回讀確認 SourceRecord、handoff、package、evidence references 與 stale/current 狀態仍關聯。Content Ops intake JSON 亦在接收端實際匯入驗證；Radar 的 `exported` 狀態本身仍不代表接收端已匯入。360／390／768／1280px 本機 browser viewport 通過，實體手機及外部 HTTPS 不在此驗收範圍。

### Receiver readback follow-up（2026-10-11）

- Content Ops Studio v0.9.5 的實際 UI 以明確 Brand 選擇匯入合成 A、B 兩個 package；預覽顯示 A 重匯為 1 個 possible duplicate，未選「Import anyway」時預設跳過。B 版 0 duplicates，作為新修訂匯入。
- reload 後兩筆均保留於 Synthetic Radar Receiver Alpha、狀態仍為 `needs_review`；同一 Radar SourceRecord／handoff ID、各自 package ID／fingerprint、不同 handoff fingerprint 及 evidence reference 均讀回。Synthetic Unrelated Brand Beta 的 Inbox 為 0；未建立 Content Item、strategy version 或 publication。
- 匯入只證明 receiver inbox acceptance，不代表來源事實已驗證或核准發布。Content Ops UI header 顯示 v0.9.4、package.json 為 v0.9.5，作為未修正的版本標籤差異記錄。

### Acceptance completion follow-up（2026-10-11）

- Receiver UI flow rechecked with synthetic A/B packages: explicit import confirmation, duplicate preview/default skip, B import as a distinct revision, reload and local readback. Both remain `needs_review`; no content item, publishing action, strategy mutation or brand-memory overwrite occurred. Revision links are recoverable from shared source/handoff IDs and distinct fingerprints, but the receiver does not label the older item superseded.
- v0.4 routing browser checklist completed with synthetic Traditional Chinese source text: relevance and once-per-synonym-group behavior, signal coverage/confidence explanation, accept/reject/override with reasons, route artifact identity, reload, and empty-context backup import. Route acceptance did not approve Research Brief/Learning Pack; downstream Learning Pack stayed draft with no review/approval timestamps. Browser widths 390/768/1280 had no horizontal overflow. Local companion automation status endpoints were unavailable (`ERR_CONNECTION_REFUSED`); unrelated to the completed local routing flow.
- PSPO I Learning Pack fixture passed current SourceRecord/handoff/delivery-package validation and `cyber_kuma` consumer compatibility. JSON fixtures parsed; handoff and delivery-package Markdown exporters produced provenance/evidence-linked Learning Pack output. This verifies contract/export only, not an importer run or complete PSPO I curriculum.
- No product/runtime changes, live model calls, production writes, deployment, publishing, or version bump. Overall v0.4 acceptance checklist is complete for the supplied scope; version/release remains subject to owner gate.
- Fresh verification on 2026-10-11: Radar tests 119/119, typecheck, formal daily validators and build passed; Content Ops tests 168/168, typecheck and build passed. Receiver duplicate A default-skip, B revision import, brand isolation, reload and `needs_review` readback passed. Routing backup recovered after reload; 390/768/1280 viewport widths had no horizontal overflow. Console contained only non-blocking favicon and unavailable local companion-automation requests. No deployment, live model call or publishing.
- `build:mobile` and `health:mobile` were also re-run successfully. `health:mobile` confirmed loopback origin fail-closed without Access JWT and helper status; no tunnel/deployment was started. The repo was already version `0.3.0` despite the attached task's `0.2.0` baseline, so no version mutation was made. Full `git diff --check` findings are limited to unrelated pre-existing dirty files under `tools/deal-radar-storage/`.
- Version decision: `0.3.0 — RELEASED` for the local Intelligence Delivery & Consumer Compatibility v1 acceptance gate; no production deployment or next milestone was started. v0.4 remains separately in progress.
- Receiver contract verification: Content Ops v1 envelope and item fields match Radar's converter; `externalId` maps to package ID, while SourceRecord/handoff IDs, fingerprints, provenance and evidence references are retained in `metadata.radarDelivery`. Synthetic receiver A duplicate re-import was skipped by default; B remained a separate item. Both persisted as `needs_review` after reload and stayed isolated to the explicitly selected synthetic Brand. No publish, Content Item, Strategy or Brand Memory mutation occurred. Receiver limitation: the older A item is not visually labelled superseded.
- v0.4 Definition of Done: Traditional Chinese relevance, once-per-synonym-group scoring, no unrelated substring false positive, observable-signal confidence, accept/reject/override reason gates, route/artifact/source identity, reload, backup import, v1-v3 migrations, responsive widths, and no blocking browser error all have passing test/browser evidence. This closes only the scoped acceptance; it does not authorize a 0.4.0 bump.
