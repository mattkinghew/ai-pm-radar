# AI PM Radar 專案簡述

## 產品名稱
AI PM Radar

## 一句話摘要
一個以靜態網站形式發布的每日 AI / business radar，幫助非技術背景讀者快速理解重要 AI 動向、商業意義與產品管理思考。

## 目標用戶
- 非技術 AI PM 學習者
- NGO / 教育實務工作者
- 中小企（SME）決策者

## 使用者問題
- 每日 AI 新聞很多，但難以快速分辨哪些與工作決策真正有關。
- 非技術讀者常看得懂 headline，看不懂「為什麼重要」與「應怎樣行動」。
- NGO、教育與 SME 團隊通常沒有時間做完整研究與交叉比對。
- 一般 AI 內容容易過度技術化、過度投資導向，缺少風險提醒與產品視角。

## 核心價值主張
- 把零散 AI / business 訊號整理成可讀、可追蹤、可回顧的 daily radar。
- 每則內容不只摘要新聞，還補上 business angle、AI PM angle、risk note。
- 用低成本靜態架構先驗證資訊產品價值，不引入不必要的後端與 API 成本。

## MVP 功能
- 首頁顯示最新一期內容與 Top 5 daily section
- Archive 頁面依日期與分類瀏覽歷史內容
- Article detail 頁面顯示完整摘要與產品思考欄位
- Source link 以新分頁開啟
- 固定 disclaimer，避免被誤用為金融、法律或醫療建議

## 非目標
- 不做即時新聞抓取
- 不做使用者帳戶、收藏或推薦系統
- 不做付費牆、CMS 後台或多人編輯流程
- 不做投資研究、法律判斷或醫療建議產品
- 不在前端放 API key 或秘密資料

## 成功指標
- 能穩定以 `data/daily/YYYY-MM-DD.json` 發布每日內容
- 首頁與 Archive 能讓新使用者在 1 到 3 分鐘內找到當日重點
- 每篇內容都有明確來源、風險提醒與受眾相關性
- 作為 portfolio 專案時，能清楚展示內容產品設計、AI PM thinking 與品質控管能力

## 風險與緩解
- 內容失真或 hallucination
  - 緩解：保留 source URL、人工覆核摘要、禁止補寫未確認事實
- 內容過度像投資建議
  - 緩解：固定 disclaimer，避免使用保證式語句與買賣建議語氣
- 靜態更新流程過度手動
  - 緩解：先用 template 與 prompts 標準化，再於後續版本考慮半自動化
- 來源品質不穩
  - 緩解：優先使用官方、主流媒體、公司公告或可信研究機構

## Portfolio 定位
- 展示 AI PM / AI Product Builder 的資訊架構（information architecture）能力
- 展示把 AI 內容包裝成可用產品的 scope control 能力
- 展示內容品質控管、風險控管與 human-in-the-loop workflow 設計
- 展示以低成本 static MVP 驗證資訊產品價值，而不是過早加入 backend、CMS、帳戶系統或自動爬蟲
- 展示以 data validation、static export、local verification record 支撐 portfolio credibility
- 適合作為面試時說明「如何從使用者問題出發做低成本 MVP 驗證」的案例

## Portfolio 證據
- Live demo：`https://ai-pm-radar-pages.pages.dev/`
- 驗收紀錄：`docs/LOCAL_VERIFICATION_2026-07-01.md`
- 驗證項目：Next.js build、static export、daily JSON validation、local dev server response
- 產品證據：README 已列明目標用戶、使用者問題、MVP 範圍、非目標、部署方式與 portfolio value proposition
