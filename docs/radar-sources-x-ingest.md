# 訊息源 + X 匯入 + 推薦（Radar cloud）

## 部署前 Matt 要做
1. 套用 D1 migration：`cd cloud && npx wrangler d1 migrations apply ai-pm-radar --remote`（新增 `sources` 表、items 加 external_id/metrics/reco_score/reco_reason）。
2. 設定 Jun 用嘅 bearer token（至少 32 字元，唔好貼喺對話入面）：
   `openssl rand -hex 32 | tee /dev/tty | npx wrangler secret put INGEST_TOKEN`
   將同一串 token 經安全途徑（例如密碼管理器）交畀 Jun。
3. Access 要讓 Jun 嘅自動化穿過（Access 保護成個 hostname，冇設定嘅話 bearer 請求會被擋喺 Access 登入頁）。建議用 **Service Token**（雙重保護），唔建議 Bypass：
   - Zero Trust →「存取」→「服務驗證」（Service Auth）→「服務權杖」→「建立服務權杖」，名：`jun-radar-ingest`，期限 1 年。複製 Client ID / Client Secret（只顯示一次）。
   - 「存取」→「應用程式」→ 新增「自行託管」app：網域 `radar-cloud.lamlab.cc`，路徑 `api/ingest`；再加一個網域 `radar-cloud.lamlab.cc` 路徑 `api/sources`（只 GET 由 Worker 限制）。
   - 原則：動作揀「Service Auth」，包含 →「服務權杖」= `jun-radar-ingest`。**唔好**加 Everyone。
   - 注意：`/api/sources` 路徑 app 會比主 app 更具體，所以你喺瀏覽器管理訊息源都會用呢個 app。解決：喺同一個 app 再加一條「允許」原則，包含 Emails = lamms280@gmail.com。
   - Jun 每次請求帶：`CF-Access-Client-Id`、`CF-Access-Client-Secret`、`Authorization: Bearer <INGEST_TOKEN>`。

## API
- `GET /api/sources?type=x`（bearer 或 owner）→ `{sources:[{type,value:"@handle",label,enabled}]}`
- `POST /api/ingest/x`（bearer）body `{posts:[{handle,post_id,text,url,created_at,metrics}]}`，每批 ≤200，按 post_id 去重 → `{inserted,duplicate,rejected}`。
  項目存為今日 daily，source=`x:@handle`，category=`X_POST`；AI 分析喺下次 08:00 排程（或撳 `POST /api/analyze`，owner）按額度做。
- Owner：`POST /api/sources {type:rss|x,value,label}`、`PATCH /api/sources/:id {enabled,label}`、`DELETE /api/sources/:id`。
- 每日排程會額外抓已啟用嘅自訂 RSS（最多 20 個，每個 5 篇）。

## 推薦
AI 整理時同一次呼叫多出 `reco_score`（0–10）同 `reco_reason`（繁中）——唔會多用 AI 次數。
「今日」頁頂顯示「推薦給你」（reco ≥7，最多 5 篇）同「只睇推薦」篩選。

## 物流署公開招標（未接入排程）
`cloud/src/gld-tenders.mjs` 可解析 DATA.GOV.HK 物流署 e-Tender Box XML（`TenderNoticeList` / `TenderNoticeRecord`）。只留狀態為已發出（`I`）、主題命中數碼／AI 關鍵字、而且連結是 http(s) 的招標。以招標編號去重，每天最多 10 則，並回報被留下的筆數。查詢電話同電郵不會寫進草稿。每日 cron 尚未呼叫呢個解析器，亦未下載線上 XML。接入排程要另一次 Owner GO。
