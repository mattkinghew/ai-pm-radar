# AI PM Radar 內容工作流

## Related SOP

For the reusable daily publishing checklist, see:

- `docs/DAILY_CONTENT_SOP.md`

## 每日內容生產流程
1. 收集候選文章
2. 依選文標準篩選 5 到 10 則候選
3. 逐篇整理摘要與欄位內容
4. 生成當日 JSON 草稿
5. 人工審核事實、風險與用戶相關性
6. 放入 `data/daily/YYYY-MM-DD.json`
7. 執行 `npm run build`
8. 通過後再部署靜態站

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
1. 人工閱讀候選文章
2. 先記錄來源名稱、URL、日期
3. 用自己的話寫摘要，不複製原文
4. 補上 `why_it_matters`、`business_angle`、`ai_pm_angle`
5. 加入保守的 `risk_note`
6. 用 template 建立當日 JSON
7. 本地 build 驗證頁面是否正常顯示

## 半自動工作流
1. 人工先選好來源文章
2. 使用 `prompts/article_summarizer.md` 逐篇生成單篇草稿
3. 使用 `prompts/daily_json_generator.md` 合併成當日 JSON
4. 使用 `prompts/content_reviewer.md` 做第二輪 AI 審查
5. 最後由人工確認後才寫入正式檔案

## AI Review 工作流
- 檢查是否有 hallucination 或補寫來源未提及的結論
- 檢查是否把資訊包裝成投資、法律或醫療建議
- 檢查 `source_url` 是否缺漏或不完整
- 檢查內容是否對目標受眾有清楚價值
- 檢查 `risk_note` 是否過弱或缺失
- 檢查 category 與 tags 是否一致

## 風險與 disclaimer 規則
- 不得把摘要寫成保證式結論
- 不得提供金融、法律、醫療建議
- 若來源不清或資訊不足，應明確標示限制
- 若內容帶有推測，必須用保守語氣表達
- 站內固定 disclaimer 應保持存在：
  - summaries are for learning and business awareness, not financial/legal/medical advice
