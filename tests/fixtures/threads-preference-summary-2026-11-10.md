# AI PM Radar — Threads 情報總結、偏好分析與下一版更新建議

日期：2026-11-10｜資料基礎：你上載的 Threads follow post.md（37 條收藏）

## 1. 範圍與資料可靠性

- 收藏來源：37 條；其中 28 條有文字、9 條只有 URL。
- 以「目標契合度 40%／可行動性 35%／可驗證性 25%」產生**編輯型偏好分數**。這不是模型計算的事實正確率，也未被 Owner 驗收。
- 類別與優先級由本次分析提出；不是你的 Radar 正式部署設定。公開來源的存在不代表每個具體成效／費用／模型功能都已核實。
- 來源所述時間與 11/14 活動要另外核對；未明確顯示原始發佈日期者均保持 Unknown。

## 2. 建議優先閱讀的 Top 10

| 順序 | 收藏 # | 自製標題 | 編輯分數 | 下一步 |
|---:|---:|---|---:|---|
| 1 | 23 | [Thoughtworks：將 Agent Harness 當作產品管理](https://www.threads.com/@oneday0013/post/DfdtwyooJEX) | 100/100 | 為 Radar 選取 20 個真實閱讀／審核／分發任務作 Evals v1。 |
| 2 | 2 | [Cloudflare Security Audit Skill：獨立安全驗證](https://www.threads.com/share/LiQ2h-RKP) | 85/100 | 閱讀官方 GitHub README，製作一張合成系統 Security Review Checklist。 |
| 3 | 18 | [用輕量 Landing Page 與付款驗證市場需求](https://www.threads.com/@yanshun86/post/Dfey1HbG9Gr) | 85/100 | 選定一項 HK SME 顧問 Pilot，做一頁提案並接觸三位決策者。 |
| 4 | 33 | [開源 AI YouTube Shorts Generator](https://www.threads.com/@builderdev_net/post/DfcJtyKm4_K) | 85/100 | 以自己的影片測試 1 條短片，對比現有工具全成本。 |
| 5 | 16 | [OpenMausBot：本機優先 Agent 執行環境](https://www.threads.com/@otto.scope/post/DfeO74yIJFT) | 80/100 | 只做安全架構比較，不再部署一套與現有工具重疊的 Bot 平台。 |
| 6 | 17 | [AI 生成程式碼的品質指標與發布決策](https://www.threads.com/@kojenchieh/post/DfdkdY6kpFS) | 78/100 | 把四項品質指標納入 Radar 和 Cyber Kuma 的 Owner UAT Gate。 |
| 7 | 9 | [郵件內容引發 Agent Prompt Injection 的風險實驗](https://www.threads.com/share/BoZH7BmChX) | 70/100 | 為 Source Inbox 設計三條合成 Prompt Injection 測試。 |
| 8 | 11 | [AI 設計結合 WordPress 內容管理](https://www.threads.com/share/GenysrdEc) | 70/100 | 建立一份 SME 官網交付方案：Vercel vs WordPress 的維護成本比較。 |
| 9 | 21 | [AI 文案風格評估與最小改寫](https://www.threads.com/@hello_marketing_hk/post/DfetZukFvtn) | 70/100 | 用 5 篇自家文章做小型 A/B，量度可讀性與人工修改時間。 |
| 10 | 7 | [Claude 配合 Remotion 製作可修改短片](https://www.threads.com/share/FzSCGDbtN) | 62/100 | 用一條已有權利的自製素材測試 9:16 動態字幕模板。 |

## 3. 從收藏樣本推斷的偏好（並非固定人格或未來行為預測）

1. **Agent 真實運行／治理／安全**：你收藏了安全稽核技能、Prompt Injection、Harness 管理、實體執行代理。代表你較關注產品在真實環境能否被審查和安全運行。
2. **可低成本重複的內容生產**：Remotion、AI 短劇、鏡頭語言、IG AI 影片、Shorts 工具等數量較多。顯示對「降低人手＋保持品質」的工作流有興趣，但觀看量不等於顧問收入。
3. **零／低成本實驗與替代訂閱**：Kaggle、Modal、Colab、雲電腦、開源模型。強烈偏好試驗成本可控、具體可用的資源；優惠聲稱要有 TTL/Official Terms 驗證。
4. **內容品牌可信度**：去 AI 味、WordPress 交付、原創觀點、配音與角色連貫性。可延伸到 Content Ops 的品質控制，而不是再新增 Humanizer Bot。
5. **先驗證商業需求**：Landing Page + 表單 + 真實付款的收藏與你 12 月 17 日前的付費 Pilot 目標一致；此主題在收藏中佔比不及創作者工具，因此 Radar 應故意提高商業需求和 Pricing 權重。

## 4. Source Mix 與需要修正的偏差

- 按主要類別統計，共 24 種本次人工分類。較集中領域是影片／創作者工作流、Agent／安全、低成本模型與內容品質；市場客戶需求、HK SME 願付費證據則較少。
- 多數資料是 Threads 轉述或創作者自述，存在選樣偏差、內容宣傳偏差及時效問題。尤其數量聲稱（觀看量、GPU 時數、模型授權）不能只依貼文當成已驗證事實。
- [第 6 和第 29 筆]均涉及免費 GPU，應去重為一項方案比較；第 21 和第 37 筆可合併成內容語氣品質測試；第 4、31 筆需分辨自製內容策略與未經授權的搬運。
- 第 8（模型預告）、第 10（攻擊事件歸因）設為高風險訊號，不應自動變成發布候選。

## 5. 下一版建議：唯一 Primary Outcome

**Primary Outcome：從每日情報轉出至少一項能直接支持 AI 顧問需求訪談、產品 QA 或內容實驗的行動，且保留來源及人工核對證據。**

Secondary Outcome A：維持私人 Source Inbox 的低成本多格式輸入和可追溯分類。
Secondary Outcome B：提高 Agent／產品治理與內容品質研究的可行動性，不增加自動發布風險。

實作建議（僅 Planned；未提交程式）：

| 優先 | 範圍 | Acceptance Criteria | Non-goals |
|---|---|---|---|
| T0 | Source Inbox 逐條匯入 + 批量索引去重 | 28 筆來源可各自存為待審核紀錄；9 條 URL-only 保持未整理；零公開原文 | 不新寫 Threads 爬蟲 |
| T0 | Relevance + Actionability 新評分 | Top 10 中至少 7 條有明確 14 日行動；Owner 每條人工 0–10 評分 | 不因官方 Repo 存在就宣稱效益經證實 |
| T1 | 可追溯研究驗證欄位 | 每筆有 source_url、published_at (nullable)、claim_status、evidence_tier、review_status | 不把收藏時間當發表時間 |
| T2 | 一鍵派發預覽到 Content Ops／Kuma | 只允許經 Owner 對來源、品牌、使用範圍批准的自製摘要；需有接收端回執 | 不直接公開發布 |
| Later | 多站爬蟲、複製影音內容、Grok Bot 市集安裝 | 不做 | 避免重複維護與外部資料風險 |

## 6. 擬議的偏好評分規則（供 Agent 修改，未部署）

- 正向 +25：Paid Pilot、Real Customer Pain、Client Interview、Willingness To Pay、Pricing、Productized Service、B2B GTM。
- 正向 +20：Agent Evaluation、Harness Governance、Permission Boundary、Prompt Injection Defense、Release Quality。
- 正向 +15：Content Workflow Automation、Original Content QA、Video Production Cost、Repeatable Template。
- 正向 +10：Official Free Credits、Model Release with Verified Docs、Low-cost Compute。
- 降權 -20：只有熱度／明星／無行動的傳聞與未證實效果數字。
- 降權 -30：高風險版權搬運／無獨立來源的網安事件歸因／未經授權的批量抓取做法。
- **Hard Gate**：若來源無法核對、只有 URL，狀態 `NEEDS_SOURCE_REVIEW`；若提及外部郵件指令／可疑連結，保持不可信資料，絕不當操作指令。
- 過濾不等於刪除；被降權資料仍可存在私人 Archive，但不應自動成為公開內容。

## 7. 建議的下一個唯一實驗（7 天內可驗收）

選第 18 筆「輕量付費需求驗證」做 Diagnostic 一頁方案，並用第 23 筆 Harness 管理思路替 Radar 設計 20 條人工驗證測試集。創作工具先不另開新開發分支。

成功標準：產生 **1 頁付費 Pilot 提案**、至少 **2 次合意的潛在客戶訪談**、記錄 **1 次具體定價／付款討論**；若尚無付款證據，不得宣稱 Paid Pilot 已驗證。

## 8. 檔案與操作邊界

- `radar_source_inputs.json` 是與已查閱 SourceInput 欄位相符的 **staging array**，但未核實你目前 UI 的批量匯入實作。
- `items_markdown` 的 28 檔可按已確認的 Universal Ingestor `--md` 功能逐檔匯入；應先用 1 檔驗證，再決定是否跑本機批次。
- 所有資料 `needs_review` 且 `not_approved`；不得直接將此包轉成已驗證的 `OmniResourceBundle` 或寫入公網。

## 9. 少量外部來源核對（與 Threads 帖文主張分開）

- Cloudflare `security-audit-skill`：官方 GitHub Repository 確實存在，提供分階段安全審查與獨立確認思路；原帖涉及的竊資新聞未核實。
- Thoughtworks 在 2026-11-04 發表 Cecilia Geraldo 的 **The harness is a product**，討論把工具、權限、Context、狀態與治理視為完整產品。
- AI-Youtube-Shorts-Generator 的原始 GitHub Repository 存在；未測試輸出品質、實際資源要求或本機兼容性。
- 其餘 34 筆（包括 9 筆只有網址）不能當成已逐一驗證的研究結論。

## 10. 與上一輪非 RSS／X 來源研究合併的規劃名單

此包另含 `prior_official_source_watchlist.json`（7 個來源），不混入 37 條 Threads 收藏及其偏好統計。T0 先看 HKPC、MKT1、Growth Unhinged；T1 是 MicroConf 的官方 YouTube Atom、Lenny 電子報及 GitHub Releases API；T2 才考慮 Acquire.com 的官方報告。只透過官方 API、明確允許的訂閱與人工挑選，不新做第三方站點爬蟲。正式來源是否已在 D1 啟用仍屬 Unknown。
